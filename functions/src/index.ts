/**
 * Together: Cloud Functions.
 *
 * - onMessageCreated: gentle push to the recipient (respects their one-tap pause).
 * - onCoupleDeleted: when either partner unpairs, remove every shared doc and file.
 * - fadeDisappearingNotes: hourly, deletes disappearing notes (and their media) past their time.
 * - transcribeVoiceNote: if the sender opted in, adds a transcript to their voice note.
 * - onAccountDeleted: when someone deletes their account, remove all their data and files.
 */
import { initializeApp } from 'firebase-admin/app';
import { v2 as speech } from '@google-cloud/speech';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { defineString } from 'firebase-functions/params';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
// Auth deletion triggers only exist in the 1st-gen API.
import { auth as authV1 } from 'firebase-functions/v1';

initializeApp();
const db = getFirestore();

type Message = {
  fromUid: string;
  toUid: string;
  kind: 'text' | 'photo' | 'voice' | 'video' | 'hug' | 'quick';
  viewOnce?: boolean;
  text?: string;
  voiceHug?: boolean;
};

/** Notification copy. Warm, short, and never reveals content for sensitive kinds. */
export function notificationFor(msg: Message, fromName: string): { title: string; body: string } {
  // View-once notes never preview their content, not even the caption.
  if (msg.viewOnce) return { title: `${fromName} sent you something to view once`, body: 'Open it when you\u2019re ready.' };
  switch (msg.kind) {
    case 'hug':
      return { title: `${fromName} sent you a hug`, body: 'Hold your phone close for a moment.' };
    case 'photo':
      return { title: `${fromName} sent you a photo`, body: 'A little moment, just for you.' };
    case 'video':
      return { title: `${fromName} sent you a video`, body: 'Watch it when you have a quiet minute.' };
    case 'voice':
      return msg.voiceHug
        ? { title: `${fromName} sent you a voice hug`, body: 'Ten warm seconds are waiting.' }
        : { title: `${fromName} sent you a voice note`, body: 'Have a listen when you have a quiet minute.' };
    case 'quick':
    case 'text':
    default:
      return { title: `A love note from ${fromName}`, body: (msg.text ?? '').slice(0, 120) || 'Open to read it.' };
  }
}

export const onMessageCreated = onDocumentCreated('couples/{cid}/messages/{messageId}', async (event) => {
  const msg = event.data?.data() as Message | undefined;
  if (!msg) return;

  const [recipientSnap, coupleSnap] = await Promise.all([
    db.doc(`users/${msg.toUid}`).get(),
    db.doc(`couples/${event.params.cid}`).get(),
  ]);
  const recipient = recipientSnap.data();
  if (!recipient || recipient.notificationsPaused) return; // one-tap pause wins, always
  const tokens: string[] = Array.isArray(recipient.pushTokens) ? recipient.pushTokens : [];
  if (tokens.length === 0) return;

  const fromName: string = coupleSnap.data()?.names?.[msg.fromUid] ?? 'Your partner';
  const { title, body } = notificationFor(msg, fromName);

  const payload = tokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    channelId: msg.kind === 'hug' ? 'hugs' : 'love-notes',
    data: { url: msg.kind === 'hug' ? '/' : '/notes', messageId: event.params.messageId },
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) logger.warn('Expo push failed', { status: res.status });
});

export const onCoupleDeleted = onDocumentDeleted('couples/{cid}', async (event) => {
  const { cid } = event.params;
  const ref = db.doc(`couples/${cid}`);
  await db.recursiveDelete(ref);
  await getStorage().bucket().deleteFiles({ prefix: `couples/${cid}/` });

  // Clear the pointer on both profiles so neither app keeps a stale link.
  const members: string[] = event.data?.data()?.members ?? [];
  await Promise.all(
    members.map(async (uid) => {
      const userRef = db.doc(`users/${uid}`);
      const snap = await userRef.get();
      if (snap.exists && snap.data()?.coupleId === cid) await userRef.update({ coupleId: null });
    }),
  );
});

/**
 * "Delete my account" (Settings). The app unpairs first; this removes whatever
 * is left: the couple space if it still exists, the private profile, logs,
 * settings and vault, private files, and any open invite.
 */
export const onAccountDeleted = authV1.user().onDelete(async (user) => {
  const uid = user.uid;
  const userRef = db.doc(`users/${uid}`);
  const cid = (await userRef.get()).data()?.coupleId as string | null | undefined;
  if (cid) {
    const couple = await db.doc(`couples/${cid}`).get();
    // Deleting the couple doc runs onCoupleDeleted, which removes the shared space for both.
    if (couple.exists && (couple.data()?.members ?? []).includes(uid)) await couple.ref.delete();
  }
  await db.recursiveDelete(userRef);
  await getStorage().bucket().deleteFiles({ prefix: `users/${uid}/` });
  const invites = await db.collection('invites').where('fromUid', '==', uid).where('status', '==', 'open').get();
  await Promise.all(invites.docs.map((d) => d.ref.update({ status: 'cancelled' })));
  logger.info('Account data removed', { uid });
});

async function deleteMediaDoc(cid: string, mediaId: string) {
  const ref = db.doc(`couples/${cid}/media/${mediaId}`);
  const snap = await ref.get();
  const data = snap.data();
  if (!data) return;
  const bucket = getStorage().bucket();
  for (const path of [data.storagePath, data.thumbPath].filter(Boolean) as string[]) {
    await bucket.file(path).delete({ ignoreNotFound: true });
  }
  await ref.delete();
}

/**
 * Disappearing notes: clients already hide them after `expiresAt`; this makes
 * sure they are really gone. (A Firestore TTL policy on messages.expiresAt is a
 * good extra safety net; see README.)
 */
export const fadeDisappearingNotes = onSchedule('every 60 minutes', async () => {
  const due = await db.collectionGroup('messages').where('expiresAt', '<=', Timestamp.now()).limit(500).get();
  for (const doc of due.docs) {
    const cid = doc.ref.parent.parent?.id;
    const mediaId = doc.get('mediaId') as string | undefined;
    if (cid && mediaId) await deleteMediaDoc(cid, mediaId);
    await doc.ref.delete();
  }
  if (due.size) logger.info(`Faded ${due.size} disappearing notes`);
});

const TRANSCRIBE_LANGUAGE = defineString('TRANSCRIBE_LANGUAGE', { default: 'en-US' });

/**
 * Opt-in transcription for voice notes (Settings, "Transcribe my voice notes").
 * Never for view-once notes, vent recordings (never uploaded), or check-ins
 * (private storage). Requires the Speech-to-Text API on the project.
 */
export const transcribeVoiceNote = onDocumentCreated(
  { document: 'couples/{cid}/media/{mediaId}', timeoutSeconds: 300, memory: '512MiB' },
  async (event) => {
    const media = event.data?.data();
    if (!media || media.type !== 'voice' || media.visibility === 'viewOnce') return;
    const owner = (await db.doc(`users/${media.ownerId}`).get()).data();
    if (!owner?.transcribeVoice) return;

    const bucket = getStorage().bucket();
    const project = process.env.GCLOUD_PROJECT;
    const client = new speech.SpeechClient();
    try {
      const [operation] = await client.batchRecognize({
        recognizer: `projects/${project}/locations/global/recognizers/_`,
        config: {
          autoDecodingConfig: {},
          languageCodes: [TRANSCRIBE_LANGUAGE.value()],
          model: 'long',
          features: { enableAutomaticPunctuation: true },
        },
        files: [{ uri: `gs://${bucket.name}/${media.storagePath}` }],
        recognitionOutputConfig: { inlineResponseConfig: {} },
      });
      const [response] = await operation.promise();
      const results = Object.values(response.results ?? {})[0]?.transcript?.results ?? [];
      const transcript = results
        .map((r) => r.alternatives?.[0]?.transcript?.trim())
        .filter(Boolean)
        .join(' ')
        .slice(0, 5000);
      // The note may have been taken back while we were listening.
      if (transcript && (await event.data!.ref.get()).exists) await event.data!.ref.update({ transcript });
    } catch (e) {
      logger.warn('Transcription skipped', { mediaId: event.params.mediaId, error: String(e) });
    }
  },
);

// ------------------------------------------------------------ Phase 3

/** Send a gentle push to one person, unless they've paused notifications. */
async function pushTo(uid: string, title: string, body: string, url: string, channelId = 'love-notes') {
  const user = (await db.doc(`users/${uid}`).get()).data();
  if (!user || user.notificationsPaused) return;
  const tokens: string[] = Array.isArray(user.pushTokens) ? user.pushTokens : [];
  if (!tokens.length) return;
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body, sound: 'default', channelId, data: { url } }))),
  });
  if (!res.ok) logger.warn('Expo push failed', { status: res.status });
}

/** A gentle reset was started: invite the other partner, softly. */
export const onResetStarted = onDocumentCreated('couples/{cid}/resets/{date}', async (event) => {
  const reset = event.data?.data();
  if (!reset) return;
  const couple = (await db.doc(`couples/${event.params.cid}`).get()).data();
  if (!couple) return;
  const other = (couple.members as string[]).find((m) => m !== reset.startedBy);
  if (!other) return;
  const name = couple.names?.[reset.startedBy] ?? 'Your partner';
  await pushTo(other, `${name} would like a gentle reset`, 'Pause, have some water, then share one thing you appreciate.', '/reset');
});

/**
 * Scheduled notes and date surprises: let the recipient know when one arrives.
 * ("Next open" surprises don't notify; they're found when the app opens.)
 */
export const deliverScheduledNotes = onSchedule('every 10 minutes', async () => {
  const due = await db
    .collectionGroup('scheduled')
    .where('deliverAt', '<=', Timestamp.now())
    .where('notified', '==', false)
    .limit(200)
    .get();
  for (const d of due.docs) {
    const n = d.data();
    await d.ref.update({ notified: true });
    if (n.surprise === 'open') continue;
    const cid = d.ref.parent.parent?.id;
    const couple = cid ? (await db.doc(`couples/${cid}`).get()).data() : null;
    const name = couple?.names?.[n.fromUid] ?? 'Your partner';
    if (n.surprise === 'date') await pushTo(n.toUid, `${name} left you a surprise`, 'It just unlocked. Open it when you’re ready.', '/notes');
    else await pushTo(n.toUid, `A love note from ${name}`, (n.text ?? '').slice(0, 120) || 'Open to read it.', '/notes');
  }
});

/** Tag new scheduled notes so the delivery job can find them. */
export const onScheduledCreated = onDocumentCreated('couples/{cid}/scheduled/{id}', async (event) => {
  await event.data?.ref.update({ notified: false });
});

function nextOccurrence(date: string, yearly: boolean, today: string): string | null {
  if (!yearly) return date >= today ? date : null;
  const [, m, d] = date.split('-');
  const year = Number(today.slice(0, 4));
  const thisYear = `${year}-${m}-${d}`;
  return thisYear >= today ? thisYear : `${year + 1}-${m}-${d}`;
}

/** Milestone reminders for both partners: a week before, the day before, and on the day. */
export const milestoneReminders = onSchedule({ schedule: 'every day 09:00', timeZone: 'UTC' }, async () => {
  const today = new Date().toISOString().slice(0, 10);
  const all = await db.collectionGroup('milestones').get();
  for (const d of all.docs) {
    const m = d.data();
    const next = nextOccurrence(m.date, m.yearly !== false, today);
    if (!next) continue;
    const days = Math.round((Date.parse(next) - Date.parse(today)) / 86_400_000);
    if (![7, 1, 0].includes(days)) continue;
    const cid = d.ref.parent.parent?.id;
    const couple = cid ? (await db.doc(`couples/${cid}`).get()).data() : null;
    if (!couple) continue;
    const when = days === 0 ? 'is today' : days === 1 ? 'is tomorrow' : 'is in a week';
    const body = days === 7 ? 'Plenty of time for a little plan.' : days === 1 ? 'A card tonight would be lovely.' : 'Enjoy it together.';
    for (const uid of couple.members as string[]) {
      // Don't spoil a birthday surprise for the birthday person.
      if (m.kind === 'birthday' && m.personUid === uid && days > 0) continue;
      await pushTo(uid, `${m.title} ${when}`, body, '/milestones');
    }
  }
});
