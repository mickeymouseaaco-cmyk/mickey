/**
 * The shared to-do list. One doc per item at couples/{cid}/todos/{id}, so both
 * people can add and tick at the same time without conflicts.
 */
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from './firebase';
import { care } from './together-data';
import type { Todo } from './todos-pure';

export * from './todos-pure';

type Ctx = { uid: string; cid: string };

const todosCol = (cid: string) => collection(db, 'couples', cid, 'todos');

export function useTodos(cid: string | null) {
  const [state, setState] = useState<{ cid: string; data: Todo[]; error: boolean } | null>(null);
  useEffect(() => {
    if (!cid) return;
    return onSnapshot(
      todosCol(cid),
      (s) =>
        setState({
          cid,
          error: false,
          data: s.docs.map((d) => {
            const v = d.data({ serverTimestamps: 'estimate' });
            return {
              id: d.id,
              text: v.text,
              forUid: v.forUid,
              dueDate: v.dueDate ?? null,
              important: !!v.important,
              done: !!v.done,
              doneBy: v.doneBy,
              addedBy: v.addedBy,
              fromMessageId: v.fromMessageId,
              createdMs: (v.createdAt as Timestamp | undefined)?.toMillis?.(),
            } satisfies Todo;
          }),
        }),
      () => setState({ cid, data: [], error: true }),
    );
  }, [cid]);
  const mine = state?.cid === cid ? state : null;
  return { todos: mine?.data ?? [], ready: !!mine, error: !!mine?.error };
}

export async function addTodo(
  ctx: Ctx,
  input: { text: string; forUid: string; dueDate: string | null; important?: boolean; fromMessageId?: string },
) {
  const text = input.text.trim().slice(0, 300);
  if (!text) return;
  await setDoc(doc(todosCol(ctx.cid)), {
    text,
    forUid: input.forUid,
    dueDate: input.dueDate,
    important: !!input.important,
    done: false,
    addedBy: ctx.uid,
    ...(input.fromMessageId ? { fromMessageId: input.fromMessageId } : null),
    createdAt: serverTimestamp(),
  });
}

export async function setTodoDone(ctx: Ctx, t: Todo, done: boolean) {
  await updateDoc(doc(db, 'couples', ctx.cid, 'todos', t.id), done ? { done: true, doneBy: ctx.uid, doneAt: serverTimestamp() } : { done: false });
  if (done) void care(ctx);
}

export async function toggleTodoImportant(cid: string, t: Todo) {
  await updateDoc(doc(db, 'couples', cid, 'todos', t.id), { important: !t.important });
}

export async function updateTodo(cid: string, t: Todo, patch: Partial<Pick<Todo, 'text' | 'forUid' | 'dueDate'>>) {
  const out: Record<string, unknown> = { ...patch };
  if (typeof patch.text === 'string') out.text = patch.text.trim().slice(0, 300);
  await updateDoc(doc(db, 'couples', cid, 'todos', t.id), out);
}

export async function removeTodo(cid: string, t: Todo) {
  await deleteDoc(doc(db, 'couples', cid, 'todos', t.id));
}
