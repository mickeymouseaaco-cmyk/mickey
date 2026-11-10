/** Pure helpers for the weekend planner (no Firebase). */
import { addDays, dayKey, fromDayKey } from './dates';

export type Slot = 'morning' | 'afternoon' | 'evening';
export const SLOTS: { value: Slot; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

export type Plan = {
  id: string;
  date: string;
  slot: Slot;
  text: string;
  addedBy: string;
  todoId?: string;
  createdMs?: number;
};

/**
 * The weekend to plan: this one while it's happening (Saturday or Sunday),
 * otherwise the coming one. Returns [saturday, sunday] day keys.
 */
export function upcomingWeekend(today: Date = new Date()): [string, string] {
  const dow = today.getDay(); // 0 = Sunday, 6 = Saturday
  const sat = dow === 0 ? addDays(today, -1) : addDays(today, 6 - dow);
  return [dayKey(sat), dayKey(addDays(sat, 1))];
}

export function plansIn<T extends Pick<Plan, 'date' | 'slot' | 'createdMs'>>(plans: T[], date: string, slot: Slot): T[] {
  return plans.filter((p) => p.date === date && p.slot === slot).sort((a, b) => (a.createdMs ?? 0) - (b.createdMs ?? 0));
}

/** How many of the weekend's six slots have nothing planned. */
export function freeSlots(plans: Pick<Plan, 'date' | 'slot'>[], days: string[]): number {
  let n = 0;
  for (const d of days) for (const s of SLOTS) if (!plans.some((p) => p.date === d && p.slot === s.value)) n++;
  return n;
}

/** A kind nudge about balance. Rest counts as a plan too. */
export function balanceLine(free: number, total: number): string {
  if (free === total) return 'A whole open weekend. Rest is a plan too.';
  if (free === 0) return 'Every slot is full. Maybe keep one empty, just to rest?';
  if (free >= total / 2) return 'Lots of open space. Lovely.';
  return 'A little planned, a little open. A nice balance.';
}

export function weekdayName(key: string): string {
  return fromDayKey(key).toLocaleDateString(undefined, { weekday: 'long' });
}

export function shortDayLabel(key: string): string {
  return `${fromDayKey(key).toLocaleDateString(undefined, { weekday: 'short' })} ${fromDayKey(key).getDate()}`;
}

export function dayLabel(key: string): string {
  return fromDayKey(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

/** A short text version of the plan, to send as a love note. */
export function planSummary(plans: Pick<Plan, 'date' | 'slot' | 'text'>[], days: string[]): string {
  const lines: string[] = [];
  for (const d of days) {
    const name = fromDayKey(d).toLocaleDateString(undefined, { weekday: 'long' });
    const parts = SLOTS.map((s) => {
      const here = plans.filter((p) => p.date === d && p.slot === s.value).map((p) => p.text);
      return here.length ? `${s.label.toLowerCase()}: ${here.join(', ')}` : null;
    }).filter(Boolean);
    lines.push(`${name}: ${parts.length ? parts.join('; ') : 'nothing planned, just us'}`);
  }
  return `Our weekend plan ♡\n${lines.join('\n')}`;
}
