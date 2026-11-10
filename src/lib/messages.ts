import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from './firebase';
import { deleteMedia } from './media';
import { care } from './together-data';
import type { Media, Message, MessageKind } from './types';

type Ctx = { cid: string; uid: string; partnerId: string };

const messagesCol = (cid: string) => collection(db, 'couples', cid, 'messages');

export async function sendText(
  ctx: Ctx,
  text: string,
  kind: Extract<MessageKind, 'text' | 'quick'> = 'text',
  opts: { important?: boolean } = {},
) {
  const body = text.trim();
  if (!body) return;
  await setDoc(doc(messagesCol(ctx.cid)), {
    fromUid: ctx.uid,
    toUid: ctx.partnerId,
    kind,
    text: body.slice(0, 2000),
    favoriteBy: [],
    ...(opts.important ? { important: true, importantBy: ctx.uid } : null),
    createdAt: serverTimestamp(),
  });
  void care(ctx);
}

export async function sendHug(ctx: Ctx) {
  await setDoc(doc(messagesCol(ctx.cid)), {
    fromUid: ctx.uid,
    toUid: ctx.partnerId,
    kind: 'hug',
    favoriteBy: [],
    createdAt: serverTimestamp(),
  });
  void care(ctx);
}

export async function toggleFavorite(cid: string, uid: string, m: Message) {
  const on = !m.favoriteBy.includes(uid);
  await updateDoc(doc(db, 'couples', cid, 'messages', m.id), {
    favoriteBy: on ? arrayUnion(uid) : arrayRemove(uid),
  });
}

/** Star a note as important (pinned for both of you), or unstar it. Either person can. */
export async function toggleImportant(cid: string, uid: string, m: Message) {
  await updateDoc(doc(db, 'couples', cid, 'messages', m.id), {
    important: !m.important,
    importantBy: uid,
  });
}

/** Starred notes, newest first, that can still be read (not faded, not view-once). */
export function starredNotes(messages: Message[], now: number = Date.now()): Message[] {
  return messages.filter((m) => m.important && !m.viewOnce && !isFaded(m, now));
}

export async function markRead(cid: string, m: Message) {
  await updateDoc(doc(db, 'couples', cid, 'messages', m.id), { readAt: serverTimestamp() });
}

/** The sender takes a note back: the note and its media vanish for both people. */
export async function deleteMessage(cid: string, m: Message) {
  if (m.mediaId) {
    const snap = await getDoc(doc(db, 'couples', cid, 'media', m.mediaId));
    if (snap.exists()) await deleteMedia(cid, { id: snap.id, storagePath: (snap.data() as Media).storagePath });
  }
  await deleteDoc(doc(db, 'couples', cid, 'messages', m.id));
}

export function useMessages(cid: string | null, max = 150) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!cid) return;
    const q = query(messagesCol(cid), orderBy('createdAt', 'desc'), limit(max));
    return onSnapshot(
      q,
      { includeMetadataChanges: false },
      (snap) => {
        setMessages(
          snap.docs.map((d) => {
            const data = d.data({ serverTimestamps: 'estimate' });
            return { id: d.id, ...data } as Message;
          }),
        );
        setReady(true);
        setError(false);
      },
      () => {
        setReady(true);
        setError(true);
      },
    );
  }, [cid, max]);
  return { messages, ready, error };
}

/**
 * The recipient closes a view-once note: mark it opened, then delete the file
 * and its record (security rules allow this only for view-once media).
 */
export async function finishViewOnce(cid: string, m: Message, media: Pick<Media, 'id' | 'storagePath'>) {
  await updateDoc(doc(db, 'couples', cid, 'messages', m.id), { viewedAt: serverTimestamp() });
  await deleteMedia(cid, media);
}

/** Disappearing notes fade after their time, even before the cleanup job runs. */
export function isFaded(m: Message, now: number = Date.now()): boolean {
  return !!m.expiresAt && m.expiresAt.toMillis() <= now;
}
