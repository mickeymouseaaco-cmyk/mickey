import { router } from 'expo-router';
import { CalendarHeart, ChevronRight, Eye, Footprints, Lock, Moon, Pencil, Wind } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { ProgressRing, WeekBars } from '@/components/charts';
import { FoodCardBody } from '@/components/food-card';
import { StoredPrivateImage, StoredPrivateVoice } from '@/components/media-view';
import { TodoRow } from '@/components/todo-row';
import { DaySwitch, TopBar } from '@/components/headers';
import { Button, Card, Gap, Row, Screen, SectionTitle, T } from '@/components/ui';
import { STRESS_LABELS, empty, greeting, streakLine, summaryLine } from '@/lib/copy';
import { dayKey, lastNDays, timeOfDay } from '@/lib/dates';
import { PHASE_LABEL, cycleToday, predictionLine } from '@/lib/cycle';
import { syncCycleDay, useCycleSettings, useMyDays, useShareSettings } from '@/lib/logs';
import { usePaired } from '@/lib/session';
import { todayList, useTodos } from '@/lib/todos';
import { space, useTheme } from '@/theme';

/** Consecutive days (ending today or yesterday) with any check-in. Celebration only. */
function streak(days: Record<string, unknown>, keys: string[]): number {
  let n = 0;
  const list = [...keys].reverse();
  const start = days[list[0]] ? 0 : 1; // today not logged yet doesn't break a streak
  for (let i = start; i < list.length; i++) {
    if (days[list[i]]) n++;
    else break;
  }
  return n;
}

function ShareNote({ shared, partnerName }: { shared: boolean; partnerName: string }) {
  const { c } = useTheme();
  const Icon = shared ? Eye : Lock;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={shared ? `Shared with ${partnerName}. Change in privacy settings` : 'Just for you. Change in privacy settings'}
      onPress={() => router.push('/privacy')}
      hitSlop={8}
      style={{ minHeight: 32, justifyContent: 'center' }}>
      <Row gap={6}>
        <Icon color={c.textMuted} size={14} />
        <T variant="small" muted>
          {shared ? `Shared with ${partnerName}` : 'Just for you'}
        </T>
      </Row>
    </Pressable>
  );
}

export default function Today() {
  const { c } = useTheme();
  const { uid, cid, myName, partnerName, profile } = usePaired();
  const month = useMemo(() => lastNDays(30), []);
  const week = month.slice(-7);
  const today = dayKey();
  const { days, ready } = useMyDays(uid, month[0]);
  const share = useShareSettings(uid);
  const day = days[today];
  const goal = day?.stepGoal ?? profile?.stepGoal ?? 8000;
  const streakText = streakLine(streak(days, month));
  const cycleSettings = useCycleSettings(uid);
  const cycle = day?.cycle ?? (cycleSettings ? cycleToday(cycleSettings, today) : null);
  const { todos, ready: todosReady } = useTodos(cid);
  const myToday = todayList(todos, uid, today);

  // Keep today's cycle day fresh (it changes at midnight, not when you log).
  const needsCycleSync = ready && !!cycleSettings?.enabled && !day?.cycle;
  useEffect(() => {
    if (needsCycleSync && cycleSettings) syncCycleDay({ uid, cid }, cycleSettings, undefined).catch(() => {});
  }, [needsCycleSync, cycleSettings, uid, cid]);

  return (
    <Screen>
      <TopBar
        subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        title={greeting(myName, timeOfDay())}
      />
      <DaySwitch value="mine" />

      <Card tone="peach">
        <T testID="summary-line" variant="heading" color={c.onPeach}>
          {ready ? summaryLine(day?.steps, day?.mood?.stress) : ' '}
        </T>
        {streakText ? (
          <T variant="small" color={c.onPeach} style={{ marginTop: space.xs }}>
            {streakText}
          </T>
        ) : null}
      </Card>
      <Gap />

      <Card>
        <SectionTitle right={<ShareNote shared={!!share?.steps} partnerName={partnerName} />}>Steps</SectionTitle>
        <Row gap={space.lg} style={{ alignItems: 'center' }}>
          <ProgressRing value={day?.steps ?? 0} goal={goal} size={132} stroke={13} />
          <View style={{ flex: 1 }}>
            <WeekBars days={week} values={week.map((k) => days[k]?.steps)} goal={goal} height={84} />
          </View>
        </Row>
        <Gap h={space.md} />
        <T muted>{day?.steps ? 'Nice and steady. Add more any time.' : empty.steps}</T>
        <Gap h={space.md} />
        <Button testID="log-steps" small kind="soft" icon={Footprints} label="Log steps" onPress={() => router.push('/log-steps')} />
        <Gap h={space.sm} />
        <T variant="small" muted>
          Apple Health and Google Fit syncing is coming soon.
        </T>
      </Card>
      <Gap />

      <Card>
        <SectionTitle right={<ShareNote shared={!!share?.mood} partnerName={partnerName} />}>Mood</SectionTitle>
        {day?.mood ? (
          <Row gap={space.lg}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              {day.mood.media?.type === 'photo' ? (
                <StoredPrivateImage path={day.mood.media.path} size={72} alt="Your mood selfie" />
              ) : (
                <T style={{ fontSize: 40, lineHeight: 48 }} accessibilityElementsHidden>
                  {day.mood.emoji}
                </T>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <T testID="my-mood" variant="heading">
                {day.mood.label}
              </T>
              <T muted>Stress: {STRESS_LABELS[day.mood.stress].toLowerCase()}</T>
              {day.mood.media?.type === 'voice' ? (
                <View style={{ marginTop: space.xs }}>
                  <StoredPrivateVoice path={day.mood.media.path} durationMs={day.mood.media.durationMs} />
                </View>
              ) : null}
              {day.mood.note ? (
                <T variant="small" muted numberOfLines={2} style={{ marginTop: 2 }}>
                  &ldquo;{day.mood.note}&rdquo;
                </T>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Update mood" onPress={() => router.push('/log-mood')} hitSlop={8} style={{ padding: space.sm }}>
              <Pencil color={c.primary} size={22} />
            </Pressable>
          </Row>
        ) : (
          <View style={{ gap: space.md }}>
            <T muted>{empty.mood}</T>
            <Button testID="log-mood" small kind="soft" label="Check in" onPress={() => router.push('/log-mood')} />
          </View>
        )}
      </Card>
      <Gap />

      <Card>
        <SectionTitle
          right={
            <Pressable testID="open-todos" accessibilityRole="link" onPress={() => router.push('/todos')} hitSlop={8} style={{ minHeight: 32, justifyContent: 'center' }}>
              <T variant="small" color={c.primary}>
                {myToday.length > 3 ? `See all ${myToday.length}` : 'See all'}
              </T>
            </Pressable>
          }>
          Today&apos;s to-dos
        </SectionTitle>
        {myToday.slice(0, 3).map((t) => (
          <TodoRow key={t.id} t={t} uid={uid} cid={cid} partnerName={partnerName} compact />
        ))}
        {todosReady && myToday.length === 0 ? (
          <View style={{ gap: space.md }}>
            <T muted>{empty.todosToday}</T>
            <Button testID="add-todo-today" small kind="soft" label="Add a to-do" onPress={() => router.push('/todos')} />
          </View>
        ) : null}
      </Card>
      <Gap />

      <Card>
        <SectionTitle right={<ShareNote shared={!!share?.food} partnerName={partnerName} />}>Food &amp; water</SectionTitle>
        <FoodCardBody ctx={{ uid, cid }} food={day?.food} />
      </Card>
      <Gap />

      {cycleSettings?.enabled && cycle ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Open cycle tracker" onPress={() => router.push('/cycle')}>
            <Card tone="rose">
              <SectionTitle right={<ShareNote shared={!!share?.cycle} partnerName={partnerName} />}>Cycle</SectionTitle>
              <Row gap={space.md}>
                <CalendarHeart color={c.heart} size={24} />
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong">
                    {PHASE_LABEL[cycle.phase]} · day {cycle.day}
                  </T>
                  <T variant="small" muted>
                    {predictionLine(cycle)}
                    {cycle.symptoms.length ? ` · ${cycle.symptoms.join(', ').toLowerCase()}` : ''}
                  </T>
                </View>
                <ChevronRight color={c.textMuted} size={20} />
              </Row>
            </Card>
          </Pressable>
          <Gap />
        </>
      ) : null}

      <Card tone="lavender">
        <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
          <Moon color={c.primary} size={24} />
          <View style={{ flex: 1, gap: space.xs }}>
            <T variant="heading">Evening check-in</T>
            {day?.checkIn && (day.checkIn.text || day.checkIn.voicePath || day.checkIn.memoryId) ? (
              <T testID="checkin-summary" muted numberOfLines={2}>
                {day.checkIn.text ? `\u201C${day.checkIn.text}\u201D` : 'You saved a voice moment tonight.'}
              </T>
            ) : (
              <T muted>What was one good moment today?</T>
            )}
          </View>
        </Row>
        <Gap h={space.md} />
        <Button testID="open-checkin" small kind="soft" label={day?.checkIn ? 'See tonight\u2019s moment' : 'Answer'} onPress={() => router.push('/check-in')} />
      </Card>
      <Gap />

      <Card tone="sage">
        <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
          <Wind color={c.onSage} size={26} />
          <View style={{ flex: 1, gap: space.xs }}>
            <T variant="heading" color={c.onSage}>
              Calm Corner
            </T>
            <T color={c.onSage}>Two minutes of breathing, soft sounds, or a private vent that&apos;s never saved.</T>
          </View>
        </Row>
        <Gap h={space.md} />
        <Row gap={space.sm}>
          <Button testID="open-calm" kind="quiet" small label="Breathe" style={{ flex: 1 }} onPress={() => router.push('/calm')} />
          <Button testID="open-vent" kind="quiet" small label="Vent" style={{ flex: 1 }} onPress={() => router.push('/vent')} />
        </Row>
      </Card>

      {!cycleSettings?.enabled ? (
        <>
          <Gap />
          <Button kind="ghost" small label="Track your cycle (optional, private)" onPress={() => router.push('/cycle')} />
        </>
      ) : null}
    </Screen>
  );
}
