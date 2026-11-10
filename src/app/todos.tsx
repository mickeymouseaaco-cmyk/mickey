/** Shared to-dos: things to do for each other or together. Gentle by design: nothing is ever "overdue". */
import { ListTodo, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { TodoRow } from '@/components/todo-row';
import { Button, Card, Chip, EmptyState, Field, Gap, Row, Screen, Segmented, SectionTitle, T, ToggleRow, useInputStyle } from '@/components/ui';
import { empty, gentleError } from '@/lib/copy';
import { dayKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { usePaired } from '@/lib/session';
import { BUCKET_LABEL, addTodo, dueDateFor, isForMe, sortTodos, todoBucket, useTodos, type TodoBucket, type TodoWhen } from '@/lib/todos';
import { space, useTheme } from '@/theme';

type Filter = 'all' | 'mine' | 'theirs' | 'starred';
const ORDER: TodoBucket[] = ['today', 'soon', 'someday'];
const WHEN: { value: TodoWhen; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'someday', label: 'Someday' },
];

export default function Todos() {
  const { c } = useTheme();
  const input = useInputStyle();
  const { uid, cid, partnerId, partnerName } = usePaired();
  const { toast } = useFeedback();
  const { todos, ready, error } = useTodos(cid);
  const [filter, setFilter] = useState<Filter>('all');
  const [text, setText] = useState('');
  const [forUid, setForUid] = useState<string>('both');
  const [when, setWhen] = useState<TodoWhen>('today');
  const [important, setImportant] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const today = dayKey();

  const filtered = sortTodos(
    todos.filter((t) =>
      filter === 'mine' ? isForMe(t, uid) : filter === 'theirs' ? isForMe(t, partnerId) : filter === 'starred' ? t.important : true,
    ),
  );
  const open = filtered.filter((t) => !t.done);
  const done = filtered.filter((t) => t.done);

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await addTodo({ uid, cid }, { text, forUid, dueDate: dueDateFor(when), important });
      haptic.success();
      setText('');
      setImportant(false);
      toast(forUid === uid ? 'Added to your list.' : `Added. ${partnerName} can see it too.`);
    } catch {
      toast(gentleError.save);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Card>
        <Field label="Something to do">
          <TextInput
            testID="todo-input"
            value={text}
            onChangeText={setText}
            placeholder="Book the ryokan, buy kuih for Mum…"
            placeholderTextColor={c.textMuted}
            maxLength={300}
            returnKeyType="done"
            onSubmitEditing={add}
            style={input}
          />
        </Field>
        <Gap h={space.md} />
        <T variant="label" muted>
          WHO
        </T>
        <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
          <Chip testID="todo-for-me" label="Me" selected={forUid === uid} onPress={() => setForUid(uid)} />
          <Chip testID="todo-for-partner" label={partnerName} selected={forUid === partnerId} onPress={() => setForUid(partnerId)} />
          <Chip testID="todo-for-both" label="Both of us" selected={forUid === 'both'} onPress={() => setForUid('both')} />
        </Row>
        <Gap h={space.md} />
        <T variant="label" muted>
          WHEN
        </T>
        <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
          {WHEN.map((w) => (
            <Chip key={w.value} testID={`todo-when-${w.value}`} label={w.label} selected={when === w.value} onPress={() => setWhen(w.value)} />
          ))}
        </Row>
        <ToggleRow testID="todo-important" title="Important" detail="Starred to-dos stay at the top for both of you." value={important} onChange={setImportant} />
        <Gap h={space.sm} />
        <Button testID="todo-add" label="Add to our list" icon={Plus} loading={busy} disabled={!text.trim()} onPress={add} />
      </Card>
      <Gap />

      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'mine', label: 'Mine' },
          { value: 'theirs', label: `${partnerName}’s` },
          { value: 'starred', label: 'Starred' },
        ]}
      />
      <Gap />

      {ready && open.length === 0 ? <EmptyState icon={ListTodo} line={error ? gentleError.load : empty.todos} /> : null}

      {ORDER.map((b) => {
        const items = open.filter((t) => todoBucket(t, today) === b);
        if (!items.length) return null;
        return (
          <View key={b} style={{ marginBottom: space.lg }}>
            <SectionTitle>{BUCKET_LABEL[b]}</SectionTitle>
            <Card style={{ paddingVertical: space.sm }}>
              {items.map((t) => (
                <TodoRow key={t.id} t={t} uid={uid} cid={cid} partnerName={partnerName} />
              ))}
            </Card>
          </View>
        );
      })}

      {done.length ? (
        <>
          <Button
            testID="todo-show-done"
            kind="ghost"
            small
            label={showDone ? 'Hide what’s done' : `See what’s done (${done.length})`}
            onPress={() => setShowDone((v) => !v)}
          />
          {showDone ? (
            <Card style={{ paddingVertical: space.sm, marginTop: space.md }}>
              {done.map((t) => (
                <TodoRow key={t.id} t={t} uid={uid} cid={cid} partnerName={partnerName} />
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      <Gap />
      <T variant="small" muted center>
        Shared with {partnerName}. No deadlines to miss, just a gentle list.
      </T>
    </Screen>
  );
}
