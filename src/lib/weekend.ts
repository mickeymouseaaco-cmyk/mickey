/** The weekend planner: couples/{cid}/plans/{id}, one small plan per doc. */
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where, type Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from './firebase';
import { care } from './together-data';
import type { Plan, Slot } from './weekend-pure';

export * from './weekend-pure';

type Ctx = { uid: string; cid: string };

const plansCol = (cid: string) => collection(db, 'couples', cid, 'plans');

export function usePlans(cid: string | null, days: string[]) {
  const key = days.join(',');
  const [state, setState] = useState<{ key: string; data: Plan[]; error: boolean } | null>(null);
  useEffect(() => {
    if (!cid || !key) return;
    const id = `${cid}|${key}`;
    return onSnapshot(
      query(plansCol(cid), where('date', 'in', key.split(','))),
      (s) =>
        setState({
          key: id,
          error: false,
          data: s.docs.map((d) => {
            const v = d.data({ serverTimestamps: 'estimate' });
            return {
              id: d.id,
              date: v.date,
              slot: v.slot,
              text: v.text,
              addedBy: v.addedBy,
              todoId: v.todoId,
              createdMs: (v.createdAt as Timestamp | undefined)?.toMillis?.(),
            } satisfies Plan;
          }),
        }),
      () => setState({ key: id, data: [], error: true }),
    );
  }, [cid, key]);
  const mine = state?.key === `${cid}|${key}` ? state : null;
  return { plans: mine?.data ?? [], ready: !!mine, error: !!mine?.error };
}

export async function addPlan(ctx: Ctx, input: { date: string; slot: Slot; text: string; todoId?: string }) {
  const text = input.text.trim().slice(0, 200);
  if (!text) return;
  await setDoc(doc(plansCol(ctx.cid)), {
    date: input.date,
    slot: input.slot,
    text,
    addedBy: ctx.uid,
    ...(input.todoId ? { todoId: input.todoId } : null),
    createdAt: serverTimestamp(),
  });
  void care(ctx);
}

export async function removePlan(cid: string, p: Plan) {
  await deleteDoc(doc(db, 'couples', cid, 'plans', p.id));
}
