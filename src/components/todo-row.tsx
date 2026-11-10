import { Check, Star, Trash } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { gentleError } from '@/lib/copy';
import { haptic } from '@/lib/haptics';
import { dueLine, forLabel, removeTodo, setTodoDone, toggleTodoImportant, type Todo } from '@/lib/todos';
import { radius, space, useTheme } from '@/theme';

import { useCelebrate } from './celebrate';
import { useFeedback } from './feedback';
import { Row, T } from './ui';

/** One shared to-do: tap the circle to tick it, the star to mark it important. */
export function TodoRow({
  t,
  uid,
  cid,
  partnerName,
  compact,
}: {
  t: Todo;
  uid: string;
  cid: string;
  partnerName: string;
  /** On Today: no remove button, and a quieter meta line. */
  compact?: boolean;
}) {
  const { c } = useTheme();
  const { toast } = useFeedback();
  const celebrate = useCelebrate();
  const meta = t.done
    ? t.doneBy === uid
      ? 'Done by you'
      : `Done by ${partnerName}`
    : compact
      ? forLabel(t, uid, partnerName)
      : `${forLabel(t, uid, partnerName)} · ${dueLine(t.dueDate)}${t.addedBy !== uid ? ` · added by ${partnerName}` : ''}`;

  async function tick() {
    const done = !t.done;
    haptic.tap();
    try {
      await setTodoDone({ uid, cid }, t, done);
      if (done && t.important) celebrate('Done. One less thing to carry ✿');
      else if (done) toast('Done. One less thing to carry.');
    } catch {
      toast(gentleError.save);
    }
  }

  return (
    <Row gap={space.sm} style={{ minHeight: 56 }}>
      <Pressable
        testID="todo-tick"
        accessibilityRole="checkbox"
        accessibilityLabel={t.text}
        accessibilityHint={meta}
        accessibilityState={{ checked: t.done }}
        onPress={tick}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: radius.pill,
            borderWidth: t.done ? 0 : 2,
            borderColor: c.textMuted,
            backgroundColor: t.done ? c.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {t.done ? <Check color={c.onPrimary} size={16} strokeWidth={3} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <T testID="todo-text" muted={t.done} style={t.done ? { textDecorationLine: 'line-through' } : undefined}>
            {t.text}
          </T>
          <T variant="small" muted>
            {meta}
          </T>
        </View>
      </Pressable>
      {!t.done ? (
        <Pressable
          testID="todo-star"
          accessibilityRole="button"
          accessibilityLabel={t.important ? 'Unmark as important' : 'Mark as important'}
          accessibilityState={{ selected: t.important }}
          onPress={() => {
            haptic.tap();
            toggleTodoImportant(cid, t).catch(() => toast(gentleError.save));
          }}
          hitSlop={8}
          style={{ padding: 10 }}>
          <Star color={t.important ? c.onButter : c.textMuted} fill={t.important ? c.onButter : 'transparent'} size={20} />
        </Pressable>
      ) : null}
      {!compact ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${t.text}`}
          onPress={() => removeTodo(cid, t).catch(() => toast(gentleError.save))}
          hitSlop={8}
          style={{ padding: 10 }}>
          <Trash color={c.textMuted} size={16} />
        </Pressable>
      ) : null}
    </Row>
  );
}
