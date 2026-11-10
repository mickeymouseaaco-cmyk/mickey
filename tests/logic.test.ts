/// <reference types="node" />
/** Unit tests for Together's pure logic. Run: npm run test:unit */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { QUICK_MESSAGES, empty, summaryLine } from '../src/lib/copy';
import { dayKey, lastNDays } from '../src/lib/dates';
import { projectDay } from '../src/lib/projection';
import { gentleAlert, isHighSteps, suggestionsFor } from '../src/lib/suggestions';
import { DEFAULT_SHARE, type DailyLog } from '../src/lib/types';

const day: DailyLog = {
  date: '2026-11-09',
  steps: 9000,
  stepGoal: 8000,
  mood: { emoji: '😢', label: 'Sad', stress: 4, note: 'rough meeting' },
};

describe('projectDay (what the partner may see)', () => {
  test('defaults: steps shared, mood private', () => {
    const p = projectDay('me', day, DEFAULT_SHARE);
    assert.equal(p.steps, 9000);
    assert.equal(p.mood, undefined);
  });

  test('mood shared only when toggled on, without the private timestamp', () => {
    const p = projectDay('me', { ...day, mood: { ...day.mood!, at: 'x' as never } }, { ...DEFAULT_SHARE, mood: true });
    assert.deepEqual(p.mood, { emoji: '😢', label: 'Sad', stress: 4, note: 'rough meeting' });
  });

  test('nothing shared when everything is off', () => {
    const off = { steps: false, mood: false, food: false, cycle: false, media: false };
    assert.deepEqual(projectDay('me', day, off), { ownerId: 'me', date: '2026-11-09' });
  });

  test('cycle and mood are private by default', () => {
    assert.equal(DEFAULT_SHARE.mood, false);
    assert.equal(DEFAULT_SHARE.cycle, false);
  });
});

describe('support suggestions', () => {
  test('high stress brings calming ideas and a gentle alert', () => {
    const shared = { ownerId: 'p', date: day.date, mood: { emoji: '😢', label: 'Sad', stress: 5 as const } };
    const ids = suggestionsFor('Blair', shared).map((s) => s.id);
    assert.ok(ids.includes('no-phone'));
    assert.ok(ids.includes('massage'));
    assert.equal(gentleAlert('Blair', shared)?.kind, 'stress');
  });

  test('very high steps suggest rest', () => {
    const shared = { ownerId: 'p', date: day.date, steps: 18000, stepGoal: 8000 };
    assert.ok(isHighSteps(shared));
    assert.ok(suggestionsFor('Blair', shared).some((s) => s.id === 'bath'));
    assert.equal(gentleAlert('Blair', shared)?.kind, 'steps');
  });

  test('nothing shared still gives kind defaults, and no alert', () => {
    const list = suggestionsFor('Blair', undefined);
    assert.ok(list.length >= 2);
    assert.equal(gentleAlert('Blair', undefined), null);
  });

  test('never more than five ideas, no duplicates', () => {
    const shared = { ownerId: 'p', date: day.date, steps: 20000, stepGoal: 8000, mood: { emoji: '😤', label: 'Frustrated', stress: 5 as const } };
    const list = suggestionsFor('Blair', shared);
    assert.ok(list.length <= 5);
    assert.equal(new Set(list.map((s) => s.id)).size, list.length);
  });
});

describe('tone', () => {
  const banned = /\b(fail|failed|failure|missed|behind|bad|should have|warning|error)\b/i;

  test('summary lines are kind at every step count', () => {
    for (const steps of [undefined, 0, 1200, 6000, 9000, 25000]) {
      for (const stress of [undefined, 1, 5]) {
        const line = summaryLine(steps, stress);
        assert.ok(line.length > 0);
        assert.doesNotMatch(line, banned, line);
      }
    }
    assert.equal(summaryLine(9000), 'You walked 9,000 steps today. Be gentle with yourself.');
  });

  test('empty states and quick messages carry no shame words', () => {
    const lines = [...Object.values(empty).map((v) => (typeof v === 'function' ? v('Blair') : v)), ...QUICK_MESSAGES];
    for (const l of lines) assert.doesNotMatch(l, banned, l);
  });
});

describe('dates', () => {
  test('lastNDays ends today, oldest first', () => {
    const d = lastNDays(7);
    assert.equal(d.length, 7);
    assert.equal(d[6], dayKey());
    assert.ok(d[0] < d[6]);
  });
});

// ---------------------------------------------------------------- Phase 2

import { cycleToday, partnerCycleTips, phaseFor, predictionLine } from '../src/lib/cycle';
import { weeklyAppreciation } from '../src/lib/gratitude-summary';

describe('cycle', () => {
  const s = { enabled: true, lastStart: '2026-11-01', cycleLength: 28, periodLength: 5 };

  test('phases across a 28-day cycle', () => {
    assert.equal(phaseFor(1, 28, 5), 'menstrual');
    assert.equal(phaseFor(5, 28, 5), 'menstrual');
    assert.equal(phaseFor(8, 28, 5), 'follicular');
    assert.equal(phaseFor(14, 28, 5), 'ovulation');
    assert.equal(phaseFor(20, 28, 5), 'luteal');
  });

  test('day number, wrap-around and prediction', () => {
    assert.deepEqual(cycleToday(s, '2026-11-01'), { phase: 'menstrual', day: 1, daysUntilNext: 28, symptoms: [] });
    assert.equal(cycleToday(s, '2026-11-29')?.day, 1); // next cycle
    const late = cycleToday(s, '2026-11-27')!;
    assert.equal(late.daysUntilNext, 2);
    assert.match(predictionLine(late), /about 2 days/);
  });

  test('disabled or future start shows nothing', () => {
    assert.equal(cycleToday({ ...s, enabled: false }, '2026-11-05'), null);
    assert.equal(cycleToday(s, '2026-10-20'), null);
  });

  test('partner tips follow phase and symptoms', () => {
    const tips = partnerCycleTips('Alex', { phase: 'menstrual', day: 2, daysUntilNext: 27, symptoms: ['Cramps', 'Tired'] });
    const ids = tips.map((t) => t.id);
    assert.ok(ids.includes('warm'));
    assert.ok(ids.includes('chores'));
    assert.ok(tips.length <= 4);
  });
});

describe('Phase 2 sharing', () => {
  const full: DailyLog = {
    date: '2026-11-09',
    food: { meals: [{ id: 'a', kind: 'lunch', text: 'Soup', at: 1 }], water: 3 },
    cycle: { phase: 'luteal', day: 20, daysUntilNext: 9, symptoms: ['Moody'] },
    checkIn: { text: 'private good moment' },
  };

  test('food is shared by default without ids or times; cycle is not', () => {
    const p = projectDay('me', full, DEFAULT_SHARE);
    assert.deepEqual(p.food, { meals: [{ kind: 'lunch', text: 'Soup' }], water: 3 });
    assert.equal(p.cycle, undefined);
  });

  test('cycle shared only when on; check-ins never', () => {
    const p = projectDay('me', full, { ...DEFAULT_SHARE, cycle: true });
    assert.equal(p.cycle?.phase, 'luteal');
    assert.equal(JSON.stringify(p).includes('private good moment'), false);
  });
});

describe('gratitude summary', () => {
  const week = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'];
  test('counts both directions and stays warm', () => {
    const items = [
      { ownerId: 'me', date: '2026-11-09' },
      { ownerId: 'them', date: '2026-11-09' },
      { ownerId: 'them', date: '2026-11-04' },
      { ownerId: 'them', date: '2026-10-01' }, // outside the week
    ];
    const s = weeklyAppreciation(items, 'me', 'Blair', week);
    assert.equal(s.mine, 1);
    assert.equal(s.theirs, 2);
    assert.match(s.line, /thanked each other 3 times/);
  });
  test('an empty week is a fresh start, not a failure', () => {
    assert.match(weeklyAppreciation([], 'me', 'Blair', week).line, /fresh week/);
  });
});

// ---------------------------------------------------------------- Phase 3

import { DATE_IDEAS, daysUntil, matchingIdeas, nextOccurrence, pickIdea, planningPrompt } from '../src/lib/ideas';
import { suggestionsFor as suggest } from '../src/lib/suggestions';
import { coupleStreak, plantStage } from '../src/lib/together-data-pure';
import { countdownLine, miniTaskFor, moodRecap, packingFor, suggestRestDays, tripPhase, weatherFromChoice } from '../src/lib/trip-logic';

describe('trips', () => {
  test('countdown and phases', () => {
    assert.equal(countdownLine('2026-11-20', '2026-11-25', '2026-11-09'), '11 days to go');
    assert.equal(countdownLine('2026-11-10', '2026-11-12', '2026-11-09'), 'Tomorrow!');
    assert.equal(tripPhase('2026-11-01', '2026-11-12', '2026-11-09'), 'during');
    assert.match(countdownLine('2026-11-01', '2026-11-12', '2026-11-09'), /Day 9/);
  });
  test('one small mini task for every day, none with pressure words', () => {
    for (let d = 0; d <= 60; d++) {
      const t = miniTaskFor(d);
      assert.ok(t.length > 0);
      assert.doesNotMatch(t, /overdue|late|must|failed/i);
    }
  });
  test('packing adapts to the weather', () => {
    const hot = packingFor(weatherFromChoice('hot', 6));
    assert.ok(hot.includes('Sunscreen') && hot.includes('Swimsuit') && hot.includes('Small laundry bag'));
    assert.ok(!hot.includes('Warm coat, hat and gloves'));
    const cold = packingFor(weatherFromChoice('cold', 3));
    assert.ok(cold.includes('Warm coat, hat and gloves'));
    assert.ok(packingFor(weatherFromChoice('rainy', 4)).includes('Rain jacket or umbrella'));
  });
  test('rest days: about one in four, never on the last day', () => {
    assert.deepEqual(suggestRestDays('2026-12-01', '2026-12-02'), []);
    assert.deepEqual(suggestRestDays('2026-12-01', '2026-12-10'), ['2026-12-04', '2026-12-08']);
  });
  test('trip mood recap counts and sorts', () => {
    assert.deepEqual(moodRecap(['😍', '😊', '😍', undefined]), [
      { emoji: '😍', count: 2 },
      { emoji: '😊', count: 1 },
    ]);
  });
});

describe('date ideas & milestones', () => {
  test('filters by budget ceiling, energy and time', () => {
    const free = matchingIdeas({ budget: 0, energy: 'cozy' });
    assert.ok(free.length > 0);
    assert.ok(free.every((i) => i.budget === 0 && i.energy === 'cozy'));
  });
  test('never repeats the idea just shown', () => {
    const first = pickIdea({}, undefined, () => 0)!;
    const second = pickIdea({}, first.id, () => 0)!;
    assert.notEqual(first.id, second.id);
    assert.equal(DATE_IDEAS.length > 15, true);
  });
  test('yearly milestones roll over to next year', () => {
    assert.equal(nextOccurrence('2021-06-14', true, '2026-11-09'), '2027-06-14');
    assert.equal(nextOccurrence('2021-11-09', true, '2026-11-09'), '2026-11-09');
    assert.equal(nextOccurrence('2026-01-01', false, '2026-11-09'), null);
    assert.equal(daysUntil('2026-11-16', '2026-11-09'), 7);
    assert.match(planningPrompt('anniversary', 7), /Book a table/);
  });
});

describe('love languages, plant, streaks', () => {
  test('love language ideas come first', () => {
    const list = suggest('Blair', undefined, ['service', 'touch']);
    assert.equal(list[0].id, 'll-service');
    assert.equal(list[1].id, 'll-touch');
  });
  test('the plant only grows through stages', () => {
    assert.equal(plantStage(0).name, 'Seed');
    assert.equal(plantStage(5).name, 'Sprout');
    assert.equal(plantStage(200).name, 'Flourishing');
    assert.equal(plantStage(200).next, null);
  });
  test('couple streak needs both people, and today in progress does not break it', () => {
    const keys = ['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'];
    const days = { '2026-11-06': ['a'], '2026-11-07': ['a', 'b'], '2026-11-08': ['b', 'a'], '2026-11-09': ['a'] };
    assert.equal(coupleStreak(days, ['a', 'b'], keys), 2);
    assert.equal(coupleStreak({ ...days, '2026-11-09': ['a', 'b'] }, ['a', 'b'], keys), 3);
  });
});

import { dueDateFor, isForMe, sortTodos, todayList, todoBucket, whenFor, type Todo } from '../src/lib/todos-pure';
import { balanceLine, freeSlots, planSummary, plansIn, upcomingWeekend } from '../src/lib/weekend-pure';

const todo = (over: Partial<Todo>): Todo => ({ id: 'x', text: 'x', forUid: 'both', dueDate: null, important: false, done: false, addedBy: 'a', ...over });

describe('shared to-dos (gentle, never overdue)', () => {
  test('"this week" means by the coming Sunday; today and someday as expected', () => {
    const tue = new Date(2026, 10, 10); // Tuesday 10 Nov 2026
    assert.equal(dueDateFor('today', tue), '2026-11-10');
    assert.equal(dueDateFor('week', tue), '2026-11-15');
    assert.equal(dueDateFor('someday', tue), null);
    // On a Sunday, "this week" rolls to the next Sunday rather than today.
    assert.equal(dueDateFor('week', new Date(2026, 10, 15)), '2026-11-22');
  });

  test('anything due earlier simply shows under Today, with no "late" bucket', () => {
    assert.equal(todoBucket({ done: false, dueDate: '2026-11-01' }, '2026-11-10'), 'today');
    assert.equal(todoBucket({ done: false, dueDate: '2026-11-12' }, '2026-11-10'), 'soon');
    assert.equal(todoBucket({ done: false, dueDate: null }, '2026-11-10'), 'someday');
    assert.equal(todoBucket({ done: true, dueDate: '2026-11-01' }, '2026-11-10'), 'done');
    assert.equal(whenFor('2026-11-01', '2026-11-10'), 'today');
  });

  test('important first, then soonest, done last', () => {
    const list = sortTodos([
      todo({ id: 'done', done: true, important: true }),
      todo({ id: 'someday' }),
      todo({ id: 'soon', dueDate: '2026-11-12' }),
      todo({ id: 'star', important: true, dueDate: '2026-11-14' }),
    ]);
    assert.deepEqual(list.map((t) => t.id), ['star', 'soon', 'someday', 'done']);
  });

  test("today's list is mine or shared, open, and due by today", () => {
    const list = [
      todo({ id: 'mine', forUid: 'a', dueDate: '2026-11-10' }),
      todo({ id: 'both', dueDate: '2026-11-09' }),
      todo({ id: 'theirs', forUid: 'b', dueDate: '2026-11-10' }),
      todo({ id: 'later', forUid: 'a', dueDate: '2026-11-12' }),
      todo({ id: 'ticked', forUid: 'a', dueDate: '2026-11-10', done: true }),
    ];
    assert.deepEqual(todayList(list, 'a', '2026-11-10').map((t) => t.id).sort(), ['both', 'mine']);
    assert.equal(isForMe(todo({ forUid: 'b' }), 'a'), false);
  });
});

describe('weekend planner', () => {
  test('plans the coming weekend, or this one while it is happening', () => {
    assert.deepEqual(upcomingWeekend(new Date(2026, 10, 10)), ['2026-11-14', '2026-11-15']); // Tuesday
    assert.deepEqual(upcomingWeekend(new Date(2026, 10, 14)), ['2026-11-14', '2026-11-15']); // Saturday
    assert.deepEqual(upcomingWeekend(new Date(2026, 10, 15)), ['2026-11-14', '2026-11-15']); // Sunday
    assert.deepEqual(upcomingWeekend(new Date(2026, 10, 16)), ['2026-11-21', '2026-11-22']); // Monday
  });

  test('counts free slots and nudges kindly toward rest', () => {
    const days = ['2026-11-14', '2026-11-15'];
    const plans = [
      { date: '2026-11-14', slot: 'morning' as const, text: 'Slow breakfast' },
      { date: '2026-11-14', slot: 'morning' as const, text: 'Market' },
      { date: '2026-11-15', slot: 'evening' as const, text: 'Mum’s dinner' },
    ];
    assert.equal(freeSlots(plans, days), 4);
    assert.equal(plansIn(plans, '2026-11-14', 'morning').length, 2);
    assert.match(balanceLine(0, 6), /keep one empty/);
    assert.match(balanceLine(6, 6), /Rest is a plan too/);
    const summary = planSummary(plans, days);
    assert.match(summary, /Slow breakfast, Market/);
    assert.match(summary, /Mum’s dinner/);
  });

  test('to-do and weekend copy stays gentle', () => {
    const lines = [empty.todos, empty.todosToday, empty.weekendSlot, empty.starred, balanceLine(0, 6), balanceLine(3, 6)];
    for (const l of lines) assert.doesNotMatch(l, /overdue|late|failed|missed|must/i);
  });
});
