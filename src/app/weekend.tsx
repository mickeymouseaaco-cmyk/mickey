/** A simple planner for the coming weekend: morning, afternoon and evening, for both of you. */
import { CalendarRange, Moon, Send, Sun, Sunrise, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Chip, Gap, Row, Screen, Segmented, T, useInputStyle } from '@/components/ui';
import { empty, gentleError } from '@/lib/copy';
import { haptic } from '@/lib/haptics';
import { DATE_IDEAS } from '@/lib/ideas';
import { sendText } from '@/lib/messages';
import { usePaired } from '@/lib/session';
import { isForMe, useTodos } from '@/lib/todos';
import {
  SLOTS,
  addPlan,
  balanceLine,
  shortDayLabel,
  freeSlots,
  planSummary,
  plansIn,
  removePlan,
  upcomingWeekend,
  usePlans,
  weekdayName,
  type Plan,
  type Slot,
} from '@/lib/weekend';
import { radius, space, useTheme } from '@/theme';

const SLOT_ICON = { morning: Sunrise, afternoon: Sun, evening: Moon };
const GENTLE_IDEAS = ['Rest, nothing planned', 'A slow breakfast', 'Walk somewhere green', 'Call family'];

export default function Weekend() {
  const { c } = useTheme();
  const input = useInputStyle();
  const who = usePaired();
  const { uid, cid, partnerName } = who;
  const { toast } = useFeedback();
  const [days] = useState(() => upcomingWeekend());
  const { plans, error } = usePlans(cid, days);
  const { todos } = useTodos(cid);
  const [day, setDay] = useState(days[0]);
  const [slotChoice, setSlotChoice] = useState<Slot | null>(null);
  const [text, setText] = useState('');
  const [sharing, setSharing] = useState(false);

  const firstFree = SLOTS.find((s) => plansIn(plans, day, s.value).length === 0)?.value ?? 'morning';
  const slot = slotChoice ?? firstFree;
  const free = freeSlots(plans, days);
  const total = days.length * SLOTS.length;
  const [dateIdea] = useState(() => DATE_IDEAS[new Date().getDate() % DATE_IDEAS.length]);
  const todoIdeas = todos.filter((t) => !t.done && isForMe(t, uid) && !plans.some((p) => p.todoId === t.id)).slice(0, 3);

  async function add(body: string, todoId?: string): Promise<boolean> {
    if (!body.trim()) return false;
    try {
      await addPlan({ uid, cid }, { date: day, slot, text: body, todoId });
      haptic.soft();
      setSlotChoice(null);
      toast(`Added to ${weekdayName(day)} ${slot}.`);
      return true;
    } catch {
      toast(gentleError.save);
      return false;
    }
  }

  async function addTyped() {
    if (await add(text)) setText('');
  }

  async function share() {
    setSharing(true);
    try {
      await sendText(who, planSummary(plans, days));
      haptic.success();
      toast(`Sent to ${partnerName}. They can add to it too.`);
    } catch {
      toast(gentleError.send);
    } finally {
      setSharing(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Row gap={space.sm} style={{ marginBottom: space.md }}>
        <CalendarRange color={c.primary} size={20} />
        <T testID="weekend-balance" muted style={{ flex: 1 }}>
          {error ? gentleError.load : `${free} of ${total} slots free. ${balanceLine(free, total)}`}
        </T>
      </Row>

      <Segmented
        value={day}
        onChange={(d) => {
          setDay(d);
          setSlotChoice(null);
        }}
        options={days.map((d) => ({ value: d, label: shortDayLabel(d) }))}
      />
      <Gap />

      <View style={{ gap: space.md }}>
        {SLOTS.map((s) => {
          const items: Plan[] = plansIn(plans, day, s.value);
          const Icon = SLOT_ICON[s.value];
          return (
            <Card key={s.value} style={{ padding: space.lg }}>
              <Row gap={space.sm}>
                <Icon color={c.primary} size={18} />
                <T variant="heading" style={{ flex: 1 }}>
                  {s.label}
                </T>
                {items.length === 0 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Plan something for ${s.label.toLowerCase()}`} onPress={() => setSlotChoice(s.value)} hitSlop={8} style={{ minHeight: 32, justifyContent: 'center' }}>
                    <T variant="small" color={c.primary}>
                      Add something?
                    </T>
                  </Pressable>
                ) : null}
              </Row>
              {items.length === 0 ? (
                <T variant="small" muted style={{ marginTop: space.xs }}>
                  {empty.weekendSlot}
                </T>
              ) : (
                <View style={{ gap: space.sm, marginTop: space.sm }}>
                  {items.map((p) => {
                    const mine = p.addedBy === uid;
                    return (
                      <Row key={p.id} gap={space.sm} style={{ backgroundColor: mine ? c.peach : c.sage, borderRadius: radius.md, paddingLeft: space.md, minHeight: 52 }}>
                        <View style={{ flex: 1, paddingVertical: space.sm }}>
                          <T testID="weekend-plan" color={mine ? c.onPeach : c.onSage}>
                            {p.text}
                          </T>
                          <T variant="small" color={mine ? c.onPeach : c.onSage}>
                            {mine ? 'You added this' : `${partnerName} added this`}
                            {p.todoId ? ' · from to-dos' : ''}
                          </T>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Take ${p.text} off the plan`}
                          onPress={() => removePlan(cid, p).catch(() => toast(gentleError.save))}
                          hitSlop={8}
                          style={{ padding: space.md }}>
                          <X color={mine ? c.onPeach : c.onSage} size={16} />
                        </Pressable>
                      </Row>
                    );
                  })}
                </View>
              )}
            </Card>
          );
        })}
      </View>

      <Gap />
      <Card tone="lavender">
        <T variant="label" muted>
          ADD TO {weekdayName(day).toUpperCase()}
        </T>
        <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
          {SLOTS.map((s) => (
            <Chip key={s.value} testID={`weekend-slot-${s.value}`} label={s.label} selected={slot === s.value} onPress={() => setSlotChoice(s.value)} />
          ))}
        </Row>
        <Gap h={space.md} />
        <Row gap={space.sm}>
          <TextInput
            testID="weekend-input"
            value={text}
            onChangeText={setText}
            placeholder="Brunch, a walk, a lazy nap…"
            placeholderTextColor={c.textMuted}
            maxLength={200}
            returnKeyType="done"
            onSubmitEditing={addTyped}
            accessibilityLabel="A plan for the weekend"
            style={[input, { flex: 1 }]}
          />
          <Button testID="weekend-add" small label="Add" disabled={!text.trim()} onPress={addTyped} />
        </Row>
        <Gap h={space.md} />
        <T variant="small" muted>
          Or tap an idea
        </T>
        <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
          {GENTLE_IDEAS.map((idea) => (
            <Chip key={idea} label={`+ ${idea}`} onPress={() => add(idea)} />
          ))}
          <Chip label={`+ Date: ${dateIdea.title}`} onPress={() => add(dateIdea.title)} />
          {todoIdeas.map((t) => (
            <Chip key={t.id} label={`+ ${t.text}`} onPress={() => add(t.text, t.id)} />
          ))}
        </Row>
      </Card>

      <Gap />
      <Button testID="weekend-share" kind="soft" icon={Send} label={`Send the plan to ${partnerName}`} loading={sharing} onPress={share} />
      <Gap h={space.sm} />
      <T variant="small" muted center>
        You both see this plan live, and either of you can change it.
      </T>
    </Screen>
  );
}
