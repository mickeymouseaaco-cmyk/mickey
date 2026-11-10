/** Pure helpers for the shared to-do list (no Firebase). Gentle by design: nothing is ever "overdue". */
import { addDays, dayKey, fromDayKey } from './dates';

/** Stored as a member's uid, or 'both'. */
export type TodoFor = string;
export type TodoWhen = 'today' | 'week' | 'someday';
export type TodoBucket = 'today' | 'soon' | 'someday' | 'done';

export type Todo = {
  id: string;
  text: string;
  forUid: TodoFor;
  /** YYYY-MM-DD, or null for "someday". */
  dueDate: string | null;
  important: boolean;
  done: boolean;
  doneBy?: string;
  addedBy: string;
  /** Set when the to-do was made from a love note. */
  fromMessageId?: string;
  /** Milliseconds, for sorting (from the server timestamp). */
  createdMs?: number;
};

/** The date stored for a "when" choice. "This week" means by the coming Sunday. */
export function dueDateFor(when: TodoWhen, today: Date = new Date()): string | null {
  if (when === 'someday') return null;
  if (when === 'today') return dayKey(today);
  const dow = today.getDay(); // 0 = Sunday
  const toSunday = dow === 0 ? 7 : 7 - dow;
  return dayKey(addDays(today, toSunday));
}

/** Which "when" a stored date reads as, for editing. */
export function whenFor(dueDate: string | null, todayKey: string = dayKey()): TodoWhen {
  if (!dueDate) return 'someday';
  return dueDate <= todayKey ? 'today' : 'week';
}

/** Anything due today or earlier simply shows under Today. No "late", no guilt. */
export function todoBucket(t: Pick<Todo, 'done' | 'dueDate'>, todayKey: string = dayKey()): TodoBucket {
  if (t.done) return 'done';
  if (!t.dueDate) return 'someday';
  return t.dueDate <= todayKey ? 'today' : 'soon';
}

export const BUCKET_LABEL: Record<TodoBucket, string> = {
  today: 'Today',
  soon: 'Coming up',
  someday: 'Someday',
  done: 'Done',
};

export function isForMe(t: Pick<Todo, 'forUid'>, uid: string): boolean {
  return t.forUid === uid || t.forUid === 'both';
}

export function forLabel(t: Pick<Todo, 'forUid'>, uid: string, partnerName: string): string {
  if (t.forUid === 'both') return 'For both of you';
  return t.forUid === uid ? 'For you' : `For ${partnerName}`;
}

/** Open before done; important first; then soonest date (someday last); then oldest first. */
export function sortTodos<T extends Todo>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.important !== b.important) return a.important ? -1 : 1;
    const ad = a.dueDate ?? '9999-12-31';
    const bd = b.dueDate ?? '9999-12-31';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return (a.createdMs ?? 0) - (b.createdMs ?? 0);
  });
}

/** What's on my plate today (mine or shared), open only, sorted. */
export function todayList<T extends Todo>(list: T[], uid: string, todayKey: string = dayKey()): T[] {
  return sortTodos(list.filter((t) => !t.done && isForMe(t, uid) && todoBucket(t, todayKey) === 'today'));
}

/** A friendly date for "Coming up" items, e.g. "by Sunday". */
export function dueLine(dueDate: string | null, todayKey: string = dayKey()): string {
  if (!dueDate) return 'Someday';
  if (dueDate <= todayKey) return 'Today';
  const tomorrow = dayKey(addDays(fromDayKey(todayKey), 1));
  if (dueDate === tomorrow) return 'Tomorrow';
  return `By ${fromDayKey(dueDate).toLocaleDateString(undefined, { weekday: 'long' })}`;
}
