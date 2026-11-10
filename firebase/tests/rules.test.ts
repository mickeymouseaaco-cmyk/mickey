/**
 * Security-rule tests for Together's privacy promises.
 * Run: cd firebase/tests && npm test   (starts the Firestore + Storage emulators)
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

const A = 'alex';
const B = 'blair';
const EVE = 'eve';
const CID = 'couple1';
const CODE = 'ABC234';

let env: RulesTestEnvironment;

const db = (uid: string | null) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const storage = (uid: string) => env.authenticatedContext(uid).storage();

async function seedCouple() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'couples', CID), {
      members: [A, B],
      names: { [A]: 'Alex', [B]: 'Blair' },
      createdAt: Timestamp.now(),
      createdBy: B,
      inviteCode: CODE,
    });
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-together',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('../storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
});

describe('private data stays private', () => {
  test('owner can read and write their own day', async () => {
    await assertSucceeds(setDoc(doc(db(A), `users/${A}/days/2026-11-09`), { steps: 4000, mood: { emoji: '😢' } }));
    await assertSucceeds(getDoc(doc(db(A), `users/${A}/days/2026-11-09`)));
  });

  test('partner cannot read private days, share settings or profile', async () => {
    await seedCouple();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${A}/days/2026-11-09`), { mood: { emoji: '😢', stress: 5 } });
      await setDoc(doc(ctx.firestore(), `users/${A}/settings/share`), { mood: false });
    });
    await assertFails(getDoc(doc(db(B), `users/${A}/days/2026-11-09`)));
    await assertFails(getDoc(doc(db(B), `users/${A}/settings/share`)));
    await assertFails(getDoc(doc(db(B), `users/${A}`)));
    await assertFails(getDocs(collection(db(B), `users/${A}/days`)));
  });

  test('partner cannot write into my private space', async () => {
    await assertFails(setDoc(doc(db(B), `users/${A}/days/2026-11-09`), { steps: 1 }));
  });
});

describe('shared projections', () => {
  test('owner writes, partner reads, outsiders cannot', async () => {
    await seedCouple();
    const id = `${A}_2026-11-09`;
    await assertSucceeds(
      setDoc(doc(db(A), `couples/${CID}/shared/${id}`), {
        ownerId: A,
        date: '2026-11-09',
        steps: 9000,
        stepGoal: 8000,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(getDoc(doc(db(B), `couples/${CID}/shared/${id}`)));
    await assertSucceeds(
      getDocs(query(collection(db(B), `couples/${CID}/shared`), where('ownerId', '==', A))),
    );
    await assertFails(getDoc(doc(db(EVE), `couples/${CID}/shared/${id}`)));
  });

  test('partner cannot forge or edit my shared day', async () => {
    await seedCouple();
    await assertFails(
      setDoc(doc(db(B), `couples/${CID}/shared/${A}_2026-11-09`), { ownerId: A, date: '2026-11-09', steps: 1 }),
    );
    await assertFails(
      setDoc(doc(db(B), `couples/${CID}/shared/${B}_2026-11-09`), { ownerId: A, date: '2026-11-09', steps: 1 }),
    );
  });

  test('shared docs cannot carry unexpected fields (e.g. vent notes)', async () => {
    await seedCouple();
    await assertFails(
      setDoc(doc(db(A), `couples/${CID}/shared/${A}_2026-11-09`), {
        ownerId: A,
        date: '2026-11-09',
        vent: 'should never be shared',
      }),
    );
  });
});

describe('pairing requires acceptance', () => {
  async function seedInvite(overrides: Record<string, unknown> = {}) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'invites', CODE), {
        fromUid: A,
        fromName: 'Alex',
        status: 'open',
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() + 3600_000),
        ...overrides,
      });
    });
  }

  function acceptBatch(uid: string, members: string[]) {
    const d = db(uid);
    const batch = writeBatch(d);
    batch.set(doc(d, 'couples', CID), {
      members,
      names: { [members[0]]: 'Alex', [members[1]]: 'Someone' },
      createdAt: serverTimestamp(),
      createdBy: uid,
      inviteCode: CODE,
    });
    batch.update(doc(d, 'invites', CODE), { status: 'accepted', acceptedBy: uid, coupleId: CID });
    return batch.commit();
  }

  test('inviter can create an invite', async () => {
    await assertSucceeds(
      setDoc(doc(db(A), 'invites', CODE), {
        fromUid: A,
        fromName: 'Alex',
        status: 'open',
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 47 * 3600_000),
      }),
    );
  });

  test('nobody can list other people\'s invite codes', async () => {
    await seedInvite();
    await assertFails(getDocs(collection(db(EVE), 'invites')));
  });

  test('invitee accepts: couple + invite in one batch', async () => {
    await seedInvite();
    await assertSucceeds(acceptBatch(B, [A, B]));
    await assertSucceeds(getDoc(doc(db(A), 'couples', CID)));
  });

  test('a couple cannot be created without accepting a real invite', async () => {
    const d = db(B);
    await assertFails(
      setDoc(doc(d, 'couples', CID), {
        members: [A, B],
        names: {},
        createdAt: serverTimestamp(),
        createdBy: B,
        inviteCode: CODE,
      }),
    );
  });

  test('inviter cannot accept their own invite', async () => {
    await seedInvite();
    await assertFails(acceptBatch(A, [B, A]));
  });

  test('expired or cancelled invites cannot be accepted', async () => {
    await seedInvite({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    await assertFails(acceptBatch(B, [A, B]));
    await env.clearFirestore();
    await seedInvite({ status: 'cancelled' });
    await assertFails(acceptBatch(B, [A, B]));
  });

  test('an outsider cannot add themselves to an existing couple', async () => {
    await seedCouple();
    await assertFails(updateDoc(doc(db(EVE), 'couples', CID), { members: [A, EVE] }));
    await assertFails(updateDoc(doc(db(B), 'couples', CID), { members: [B, EVE] }));
  });
});

describe('love notes', () => {
  test('send, heart only yourself, sender can delete, recipient cannot', async () => {
    await seedCouple();
    const ref1 = doc(db(A), `couples/${CID}/messages/m1`);
    await assertSucceeds(
      setDoc(ref1, { fromUid: A, toUid: B, kind: 'text', text: 'Proud of you', favoriteBy: [], createdAt: serverTimestamp() }),
    );
    await assertSucceeds(updateDoc(doc(db(B), `couples/${CID}/messages/m1`), { favoriteBy: arrayUnion(B) }));
    await assertFails(updateDoc(doc(db(B), `couples/${CID}/messages/m1`), { favoriteBy: [A, B] }));
    await assertFails(updateDoc(doc(db(B), `couples/${CID}/messages/m1`), { text: 'edited' }));
    await assertFails(deleteDoc(doc(db(B), `couples/${CID}/messages/m1`)));
    await assertSucceeds(deleteDoc(ref1));
  });

  test('cannot impersonate the partner', async () => {
    await seedCouple();
    await assertFails(
      setDoc(doc(db(B), `couples/${CID}/messages/m2`), {
        fromUid: A,
        toUid: B,
        kind: 'text',
        text: 'fake',
        favoriteBy: [],
        createdAt: serverTimestamp(),
      }),
    );
  });

  test('outsiders cannot read notes', async () => {
    await seedCouple();
    await assertFails(getDocs(collection(db(EVE), `couples/${CID}/messages`)));
  });

  test('photo note: media + message in one batch', async () => {
    await seedCouple();
    const d = db(A);
    const batch = writeBatch(d);
    batch.set(doc(d, `couples/${CID}/media/p1`), {
      ownerId: A,
      type: 'photo',
      storagePath: `couples/${CID}/media/${A}/p1.jpg`,
      contentType: 'image/jpeg',
      bytes: 1000,
      visibility: 'couple',
      allowSave: false,
      parent: { kind: 'message', id: 'm3' },
      createdAt: serverTimestamp(),
    });
    batch.set(doc(d, `couples/${CID}/messages/m3`), {
      fromUid: A,
      toUid: B,
      kind: 'photo',
      mediaId: 'p1',
      favoriteBy: [],
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
    await assertFails(deleteDoc(doc(db(B), `couples/${CID}/media/p1`)));
    await assertSucceeds(deleteDoc(doc(db(A), `couples/${CID}/media/p1`)));
  });

  test('unpairing (deleting the couple) cuts off access immediately', async () => {
    await seedCouple();
    await assertSucceeds(
      setDoc(doc(db(A), `couples/${CID}/messages/m4`), {
        fromUid: A, toUid: B, kind: 'hug', favoriteBy: [], createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(deleteDoc(doc(db(B), 'couples', CID)));
    await assertFails(getDoc(doc(db(A), `couples/${CID}/messages/m4`)));
    await assertFails(getDoc(doc(db(B), `couples/${CID}/messages/m4`)));
  });
});

describe('storage', () => {
  const bytes = new Uint8Array([1, 2, 3]);

  test('owner uploads, partner reads, outsider cannot', async () => {
    await seedCouple();
    const path = `couples/${CID}/media/${A}/p1.jpg`;
    await assertSucceeds(uploadBytes(ref(storage(A), path), bytes, { contentType: 'image/jpeg' }));
    // Before its record exists (mid-send), only the owner can fetch it.
    await assertSucceeds(getBytes(ref(storage(A), path)));
    await assertFails(getBytes(ref(storage(B), path)));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `couples/${CID}/media/p1`), { ownerId: A, visibility: 'couple', storagePath: path });
    });
    await assertSucceeds(getBytes(ref(storage(B), path)));
    await assertFails(getBytes(ref(storage(EVE), path)));
  });

  test('partner cannot upload into my folder or delete my file', async () => {
    await seedCouple();
    const path = `couples/${CID}/media/${A}/p2.jpg`;
    await assertFails(uploadBytes(ref(storage(B), path), bytes, { contentType: 'image/jpeg' }));
    await uploadBytes(ref(storage(A), path), bytes, { contentType: 'image/jpeg' });
    await assertFails(deleteObject(ref(storage(B), path)));
    await assertSucceeds(deleteObject(ref(storage(A), path)));
  });

  test('rejects unexpected content types', async () => {
    await seedCouple();
    await assertFails(
      uploadBytes(ref(storage(A), `couples/${CID}/media/${A}/x.bin`), bytes, { contentType: 'application/octet-stream' }),
    );
  });
});

// ---------------------------------------------------------------- Phase 2

describe('gratitude wall', () => {
  const g = (owner: string, to: string, date: string) => ({
    ownerId: owner,
    toUid: to,
    date,
    text: 'Thank you for the tea',
    createdAt: serverTimestamp(),
  });

  test('one per person per day, under their own id', async () => {
    await seedCouple();
    await assertSucceeds(setDoc(doc(db(A), `couples/${CID}/gratitude/${A}_2026-11-09`), g(A, B, '2026-11-09')));
    await assertFails(setDoc(doc(db(A), `couples/${CID}/gratitude/${A}_extra`), g(A, B, '2026-11-09')));
    await assertFails(setDoc(doc(db(A), `couples/${CID}/gratitude/${B}_2026-11-09`), g(B, A, '2026-11-09')));
    await assertSucceeds(getDoc(doc(db(B), `couples/${CID}/gratitude/${A}_2026-11-09`)));
    await assertFails(getDoc(doc(db(EVE), `couples/${CID}/gratitude/${A}_2026-11-09`)));
  });

  test('a second thank-you the same day overwrites nothing (create only)', async () => {
    await seedCouple();
    await setDoc(doc(db(A), `couples/${CID}/gratitude/${A}_2026-11-09`), g(A, B, '2026-11-09'));
    await assertFails(setDoc(doc(db(A), `couples/${CID}/gratitude/${A}_2026-11-09`), g(A, B, '2026-11-09')));
  });
});

describe('view-once and disappearing notes', () => {
  async function sendViewOnce(path = `couples/${CID}/media/${A}/v1.jpg`) {
    await uploadBytes(ref(storage(A), path), new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg' });
    const d = db(A);
    const batch = writeBatch(d);
    batch.set(doc(d, `couples/${CID}/media/v1`), {
      ownerId: A,
      type: 'photo',
      storagePath: path,
      contentType: 'image/jpeg',
      bytes: 3,
      visibility: 'viewOnce',
      allowSave: false,
      parent: { kind: 'message', id: 'mv' },
      createdAt: serverTimestamp(),
    });
    batch.set(doc(d, `couples/${CID}/messages/mv`), {
      fromUid: A,
      toUid: B,
      kind: 'photo',
      mediaId: 'v1',
      viewOnce: true,
      favoriteBy: [],
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    return path;
  }

  test('recipient opens once: marks viewed, then deletes file and record', async () => {
    await seedCouple();
    const path = await sendViewOnce();
    await assertSucceeds(updateDoc(doc(db(B), `couples/${CID}/messages/mv`), { viewedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(B), `couples/${CID}/messages/mv`), { viewedAt: serverTimestamp() })); // only once
    await assertSucceeds(deleteObject(ref(storage(B), path)));
    await assertSucceeds(deleteDoc(doc(db(B), `couples/${CID}/media/v1`)));
  });

  test('the sender cannot mark it opened for them', async () => {
    await seedCouple();
    await sendViewOnce();
    await assertFails(updateDoc(doc(db(A), `couples/${CID}/messages/mv`), { viewedAt: serverTimestamp() }));
  });

  test('view-once media can never be saveable', async () => {
    await seedCouple();
    await assertFails(
      setDoc(doc(db(A), `couples/${CID}/media/v2`), {
        ownerId: A,
        type: 'photo',
        storagePath: `couples/${CID}/media/${A}/v2.jpg`,
        contentType: 'image/jpeg',
        bytes: 3,
        visibility: 'viewOnce',
        allowSave: true,
        parent: { kind: 'message', id: 'x' },
        createdAt: serverTimestamp(),
      }),
    );
  });

  test('partner still cannot delete ordinary (non view-once) media', async () => {
    await seedCouple();
    const path = `couples/${CID}/media/${A}/n1.jpg`;
    await uploadBytes(ref(storage(A), path), new Uint8Array([1]), { contentType: 'image/jpeg' });
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `couples/${CID}/media/n1`), { ownerId: A, visibility: 'couple', storagePath: path });
    });
    await assertFails(deleteObject(ref(storage(B), path)));
    await assertFails(deleteDoc(doc(db(B), `couples/${CID}/media/n1`)));
  });

  test('disappearing notes must fade within a day', async () => {
    await seedCouple();
    const base = { fromUid: A, toUid: B, kind: 'text', text: 'psst', favoriteBy: [], createdAt: serverTimestamp() };
    await assertSucceeds(
      setDoc(doc(db(A), `couples/${CID}/messages/d1`), { ...base, expiresAt: Timestamp.fromMillis(Date.now() + 24 * 3600_000) }),
    );
    await assertFails(
      setDoc(doc(db(A), `couples/${CID}/messages/d2`), { ...base, expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 3600_000) }),
    );
  });
});

describe('private files (voice check-ins)', () => {
  test('owner only, never the partner', async () => {
    await seedCouple();
    const path = `users/${A}/private/c1.m4a`;
    await assertSucceeds(uploadBytes(ref(storage(A), path), new Uint8Array([1]), { contentType: 'audio/mp4' }));
    await assertSucceeds(getBytes(ref(storage(A), path)));
    await assertFails(getBytes(ref(storage(B), path)));
    await assertFails(uploadBytes(ref(storage(B), `users/${A}/private/c2.m4a`), new Uint8Array([1]), { contentType: 'audio/mp4' }));
  });
});

describe('shared projections (Phase 2 fields)', () => {
  test('food and cycle may be shared; check-ins may not', async () => {
    await seedCouple();
    const id = `${A}_2026-11-09`;
    await assertSucceeds(
      setDoc(doc(db(A), `couples/${CID}/shared/${id}`), {
        ownerId: A,
        date: '2026-11-09',
        food: { meals: [{ kind: 'lunch', text: 'Soup' }], water: 2 },
        cycle: { phase: 'luteal', day: 20, daysUntilNext: 9, symptoms: [] },
      }),
    );
    await assertFails(
      setDoc(doc(db(A), `couples/${CID}/shared/${id}`), { ownerId: A, date: '2026-11-09', checkIn: { text: 'private' } }),
    );
  });
});

// ---------------------------------------------------------------- Phase 3

describe('scheduled sends and surprise notes', () => {
  const base = (deliverAt: Timestamp, surprise = 'date') => ({
    fromUid: A,
    toUid: B,
    kind: 'text',
    text: 'Happy birthday!',
    surprise,
    deliverAt,
    favoriteBy: [],
    createdAt: serverTimestamp(),
  });

  test('recipient cannot see a surprise before it unlocks; can after', async () => {
    await seedCouple();
    await assertSucceeds(setDoc(doc(db(A), `couples/${CID}/scheduled/future`), base(Timestamp.fromMillis(Date.now() + 86_400_000))));
    await assertSucceeds(setDoc(doc(db(A), `couples/${CID}/scheduled/due`), base(Timestamp.fromMillis(Date.now() - 120_000), 'open')));
    await assertFails(getDoc(doc(db(B), `couples/${CID}/scheduled/future`)));
    await assertSucceeds(getDoc(doc(db(B), `couples/${CID}/scheduled/due`)));
    // The "only what's due" query the app uses is allowed and returns only the due one.
    const cutoff = Timestamp.fromMillis(Date.now() - 60_000);
    const q = query(collection(db(B), `couples/${CID}/scheduled`), where('toUid', '==', B), where('deliverAt', '<=', cutoff));
    const res = await assertSucceeds(getDocs(q));
    assert.deepEqual(res.docs.map((d) => d.id), ['due']);
    // Asking for everything addressed to me is refused (it would include hidden ones).
    await assertFails(getDocs(query(collection(db(B), `couples/${CID}/scheduled`), where('toUid', '==', B))));
    // The sender sees their own, waiting or not.
    await assertSucceeds(getDocs(query(collection(db(A), `couples/${CID}/scheduled`), where('fromUid', '==', A))));
  });

  test('recipient can open and heart only once delivered; cannot edit text', async () => {
    await seedCouple();
    await setDoc(doc(db(A), `couples/${CID}/scheduled/due`), base(Timestamp.fromMillis(Date.now() - 120_000), 'open'));
    await setDoc(doc(db(A), `couples/${CID}/scheduled/future`), base(Timestamp.fromMillis(Date.now() + 86_400_000)));
    await assertSucceeds(updateDoc(doc(db(B), `couples/${CID}/scheduled/due`), { openedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(B), `couples/${CID}/scheduled/future`), { openedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(B), `couples/${CID}/scheduled/due`), { text: 'changed' }));
  });

  test('surprise media stays hidden from the partner until it unlocks', async () => {
    await seedCouple();
    const path = `couples/${CID}/media/${A}/s1.jpg`;
    await uploadBytes(ref(storage(A), path), new Uint8Array([1]), { contentType: 'image/jpeg' });
    await setDoc(doc(db(A), `couples/${CID}/media/s1`), {
      ownerId: A,
      type: 'photo',
      storagePath: path,
      contentType: 'image/jpeg',
      bytes: 1,
      visibility: 'couple',
      allowSave: false,
      hiddenUntil: Timestamp.fromMillis(Date.now() + 86_400_000),
      parent: { kind: 'scheduled', id: 'x' },
      createdAt: serverTimestamp(),
    });
    await assertFails(getDoc(doc(db(B), `couples/${CID}/media/s1`)));
    await assertFails(getBytes(ref(storage(B), path)));
    await assertSucceeds(getDoc(doc(db(A), `couples/${CID}/media/s1`)));
  });
});

describe('argument reset', () => {
  test("you can read your partner's appreciation only after sharing yours", async () => {
    await seedCouple();
    await assertSucceeds(setDoc(doc(db(A), `couples/${CID}/resets/2026-11-09`), { startedBy: A, date: '2026-11-09', createdAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db(A), `couples/${CID}/resets/2026-11-09/notes/${A}`), { text: 'Your patience', createdAt: serverTimestamp() }));
    await assertFails(getDoc(doc(db(B), `couples/${CID}/resets/2026-11-09/notes/${A}`)));
    await assertFails(setDoc(doc(db(B), `couples/${CID}/resets/2026-11-09/notes/${A}`), { text: 'forged', createdAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db(B), `couples/${CID}/resets/2026-11-09/notes/${B}`), { text: 'Your humor', createdAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(db(B), `couples/${CID}/resets/2026-11-09/notes/${A}`)));
  });
});

describe('love languages, plant, trips', () => {
  test('each person edits only their own love languages', async () => {
    await seedCouple();
    await assertSucceeds(updateDoc(doc(db(A), 'couples', CID), { [`loveLanguages.${A}`]: ['words', 'time'] }));
    await assertFails(updateDoc(doc(db(A), 'couples', CID), { [`loveLanguages.${B}`]: ['gifts'] }));
  });

  test('the plant only grows, a little at a time', async () => {
    await seedCouple();
    const p = doc(db(A), `couples/${CID}/garden/plant`);
    await assertSucceeds(setDoc(p, { points: 1, updatedAt: serverTimestamp(), lastCareBy: A }));
    await assertSucceeds(updateDoc(doc(db(B), `couples/${CID}/garden/plant`), { points: 2, updatedAt: serverTimestamp(), lastCareBy: B }));
    await assertFails(updateDoc(p, { points: 50, updatedAt: serverTimestamp(), lastCareBy: A }));
    await assertFails(updateDoc(p, { points: 1, updatedAt: serverTimestamp(), lastCareBy: A }));
  });

  test('care days: you can only add yourself', async () => {
    await seedCouple();
    await assertSucceeds(setDoc(doc(db(A), `couples/${CID}/care/2026-11-09`), { who: [A] }));
    await assertFails(updateDoc(doc(db(A), `couples/${CID}/care/2026-11-09`), { who: [A, B] }));
    await assertSucceeds(updateDoc(doc(db(B), `couples/${CID}/care/2026-11-09`), { who: [A, B] }));
  });

  test('trips: both can tick the shared checklist; outsiders cannot see it', async () => {
    await seedCouple();
    await assertSucceeds(
      setDoc(doc(db(A), `couples/${CID}/trips/t1`), { title: 'Lisbon', startDate: '2026-12-01', endDate: '2026-12-05', createdBy: A, createdAt: serverTimestamp() }),
    );
    await assertSucceeds(
      setDoc(doc(db(A), `couples/${CID}/trips/t1/items/i1`), { text: 'Passports', category: 'documents', done: false, addedBy: A, createdAt: serverTimestamp() }),
    );
    await assertSucceeds(updateDoc(doc(db(B), `couples/${CID}/trips/t1/items/i1`), { done: true, doneBy: B }));
    await assertFails(getDoc(doc(db(EVE), `couples/${CID}/trips/t1/items/i1`)));
    // Stress check: each person sets only their own.
    await assertSucceeds(updateDoc(doc(db(B), `couples/${CID}/trips/t1`), { [`stress.${B}`]: 4 }));
    await assertFails(updateDoc(doc(db(B), `couples/${CID}/trips/t1`), { [`stress.${A}`]: 1 }));
  });
});

describe('starred notes, shared to-dos and the weekend planner', () => {
  test('either partner can star a note as important; only as themselves', async () => {
    await seedCouple();
    await assertSucceeds(
      setDoc(doc(db(A), `couples/${CID}/messages/s1`), {
        fromUid: A, toUid: B, kind: 'text', text: 'Mum’s dinner, Sunday at 7', favoriteBy: [], important: true, importantBy: A, createdAt: serverTimestamp(),
      }),
    );
    // Can't send a note pretending the partner starred it.
    await assertFails(
      setDoc(doc(db(A), `couples/${CID}/messages/s2`), {
        fromUid: A, toUid: B, kind: 'text', text: 'x', favoriteBy: [], important: true, importantBy: B, createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(updateDoc(doc(db(B), `couples/${CID}/messages/s1`), { important: false, importantBy: B }));
    await assertFails(updateDoc(doc(db(B), `couples/${CID}/messages/s1`), { important: true, importantBy: A }));
    await assertFails(updateDoc(doc(db(B), `couples/${CID}/messages/s1`), { important: true, importantBy: B, text: 'edited' }));
    await assertFails(updateDoc(doc(db(EVE), `couples/${CID}/messages/s1`), { important: true, importantBy: EVE }));
  });

  test('to-dos: both add, tick and star; ticks are signed by whoever ticks; outsiders see nothing', async () => {
    await seedCouple();
    const t = doc(db(A), `couples/${CID}/todos/t1`);
    await assertSucceeds(
      setDoc(t, { text: 'Book the ryokan', forUid: 'both', dueDate: '2026-11-15', important: true, done: false, addedBy: A, createdAt: serverTimestamp() }),
    );
    await assertSucceeds(
      setDoc(doc(db(A), `couples/${CID}/todos/t2`), { text: 'Someday', forUid: B, dueDate: null, important: false, done: false, addedBy: A, createdAt: serverTimestamp() }),
    );
    // Not for strangers, not pre-ticked, not added in someone else's name.
    await assertFails(
      setDoc(doc(db(A), `couples/${CID}/todos/t3`), { text: 'x', forUid: EVE, dueDate: null, important: false, done: false, addedBy: A, createdAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(db(A), `couples/${CID}/todos/t4`), { text: 'x', forUid: 'both', dueDate: null, important: false, done: true, addedBy: A, createdAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(db(A), `couples/${CID}/todos/t5`), { text: 'x', forUid: 'both', dueDate: null, important: false, done: false, addedBy: B, createdAt: serverTimestamp() }),
    );
    await assertSucceeds(updateDoc(doc(db(B), `couples/${CID}/todos/t1`), { done: true, doneBy: B, doneAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(B), `couples/${CID}/todos/t1`), { doneBy: A }));
    await assertSucceeds(updateDoc(doc(db(B), `couples/${CID}/todos/t1`), { important: false }));
    await assertFails(updateDoc(doc(db(B), `couples/${CID}/todos/t1`), { addedBy: B }));
    await assertFails(getDoc(doc(db(EVE), `couples/${CID}/todos/t1`)));
    await assertSucceeds(deleteDoc(doc(db(B), `couples/${CID}/todos/t1`)));
  });

  test('weekend plans: both add and remove, only in real slots; outsiders see nothing', async () => {
    await seedCouple();
    await assertSucceeds(
      setDoc(doc(db(A), `couples/${CID}/plans/p1`), { date: '2026-11-14', slot: 'morning', text: 'Slow breakfast', addedBy: A, createdAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(db(A), `couples/${CID}/plans/p2`), { date: '2026-11-14', slot: 'midnight', text: 'x', addedBy: A, createdAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(db(A), `couples/${CID}/plans/p3`), { date: '2026-11-14', slot: 'evening', text: 'x', addedBy: B, createdAt: serverTimestamp() }),
    );
    await assertSucceeds(getDocs(query(collection(db(B), `couples/${CID}/plans`), where('date', 'in', ['2026-11-14', '2026-11-15']))));
    await assertSucceeds(updateDoc(doc(db(B), `couples/${CID}/plans/p1`), { slot: 'afternoon' }));
    await assertFails(getDoc(doc(db(EVE), `couples/${CID}/plans/p1`)));
    await assertSucceeds(deleteDoc(doc(db(B), `couples/${CID}/plans/p1`)));
  });
});
