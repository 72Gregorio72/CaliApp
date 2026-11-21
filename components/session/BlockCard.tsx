import { onColor, onInk } from '@/components/ui/kit';
import { UI, themed } from '@/constants/theme';
import { useCustomTheme } from '@/context/CustomThemeContext';
import type { Exercise } from '@/context/WorkoutContext';
import type { BlockType } from '@/lib/blocks';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export const BLOCK_ICON = { superset: 'git-merge-outline', emom: 'alarm-outline', amrap: 'flame-outline' } as const;

/** Exercises of a superset / EMOM / AMRAP as one compact row of chips (the timer below needs the height): the one to do now is highlighted, tap another to switch. */
export function BlockCard({ type, label, caption, counter, members, currentId, doneOf, onPick }: {
  type: BlockType;
  label: string;
  caption?: string; // e.g. "Minuto 3 di 10"
  counter?: { text: string; onMinus: () => void; onPlus: () => void }; // rounds (superset/AMRAP), in the header so the timer keeps its height
  members: Exercise[];
  currentId: string;
  doneOf: (ex: Exercise) => number;
  onPick: (id: string) => void;
}) {
  const { primaryColor } = useCustomTheme();
  const fg = onColor(primaryColor);
  // an AMRAP has no planned set count worth showing: the rounds count is in the caption
  const showSets = type !== 'amrap';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name={BLOCK_ICON[type]} size={16} color={UI.text} />
        <Text style={styles.label} numberOfLines={1}>{label.toUpperCase()}</Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        {counter ? (
          <View style={styles.counter}>
            <Pressable onPress={counter.onMinus} hitSlop={8} style={styles.counterBtn} accessibilityRole="button" accessibilityLabel="Togli un giro">
              <Ionicons name="remove" size={18} color={UI.text} />
            </Pressable>
            <Text style={styles.counterText}>{counter.text}</Text>
            <Pressable onPress={counter.onPlus} hitSlop={8} style={[styles.counterBtn, { backgroundColor: UI.ink }]} accessibilityRole="button" accessibilityLabel="Giro completato">
              <Ionicons name="add" size={18} color={onInk(primaryColor)} />
            </Pressable>
          </View>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {members.map((ex, i) => {
        const now = ex.id === currentId;
        const done = doneOf(ex);
        const c = now ? fg : UI.text;
        return (
          <Pressable
            key={ex.id}
            onPress={() => onPick(ex.id)}
            style={[styles.row, now && { backgroundColor: primaryColor }]}
            accessibilityRole="button"
            accessibilityState={{ selected: now }}
            accessibilityLabel={`${ex.name}${now ? ', adesso' : ''}`}
          >
            <View style={styles.chipTop}>
              <View style={[styles.letter, { borderColor: c }]}>
                <Text style={[styles.letterText, { color: c }]}>{String.fromCharCode(65 + i)}</Text>
              </View>
              <Text style={[styles.target, { color: c }]}>{ex.durationSeconds ? `${ex.durationSeconds} s` : ex.reps > 0 ? `${ex.reps} rip` : 'max'}</Text>
              {showSets ? <Text style={[styles.sets, { color: now ? fg : UI.muted }]}>{`${Math.min(done, ex.sets)}/${ex.sets}`}</Text> : null}
            </View>
            <Text style={[styles.name, { color: c }]} numberOfLines={1}>{ex.name}</Text>
          </Pressable>
        );
      })}
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { backgroundColor: UI.card, borderRadius: 18, padding: 10, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: UI.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  chips: { flexGrow: 1, gap: 6 },
  chipTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { flex: 1, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: UI.text },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: UI.surface },
  counterText: { fontSize: 15, fontWeight: '800', color: UI.text, minWidth: 52, textAlign: 'center', fontVariant: ['tabular-nums'] },
  caption: { fontSize: 13, fontWeight: '700', color: UI.muted, fontVariant: ['tabular-nums'] },
  // grows to share the width when few, scrolls sideways when many
  row: { flexGrow: 1, flexBasis: 0, minWidth: 120, gap: 2, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12, backgroundColor: UI.surface },
  letter: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontSize: 12, fontWeight: '800' },
  name: { fontSize: 14, fontWeight: '700' },
  target: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sets: { flex: 1, fontSize: 12, fontWeight: '600', textAlign: 'right', fontVariant: ['tabular-nums'] },
}));
