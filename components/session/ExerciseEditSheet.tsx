import { Button, Field, Sheet, Txt, onInk } from '@/components/ui/kit';
import { UI, themed } from '@/constants/theme';
import { useCustomTheme } from '@/context/CustomThemeContext';
import type { Exercise } from '@/context/WorkoutContext';
import type { Block } from '@/lib/blocks';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

type Mode = 'none' | Block['type'];

/** Edit one exercise mid-session: values, link to the next one, mode of its block (set on the block's first exercise). */
export function ExerciseEditSheet({ exercise, canLink, block, blockSize, onSave, onClose }: {
  exercise: Exercise | null; // null = closed
  canLink: boolean; // there is a next exercise to link to
  block?: Block; // current mode of the block this exercise is in
  blockSize: number;
  onSave: (patch: Partial<Exercise>, block: Block | undefined) => void;
  onClose: () => void;
}) {
  const { primaryColor } = useCustomTheme();
  const [f, setF] = useState({ name: '', sets: '', reps: '', rest: '', hold: '', linked: false, mode: 'none' as Mode, minutes: '10' });
  useEffect(() => {
    if (!exercise) return;
    setF({
      name: exercise.name,
      sets: String(exercise.sets),
      reps: String(exercise.reps),
      rest: String(exercise.restSeconds),
      hold: exercise.durationSeconds ? String(exercise.durationSeconds) : '',
      linked: !!exercise.supersetWithNext,
      mode: block?.type ?? 'none',
      minutes: String(block?.minutes ?? 10),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when another exercise is opened
  }, [exercise?.id]);

  const save = () => {
    const name = f.name.trim();
    const [sets, reps, rest, hold, minutes] = [f.sets, f.reps || '0', f.rest || '0', f.hold || '0', f.minutes].map(t => parseInt(t, 10));
    if (!name) return Alert.alert('Nome mancante', "Dai un nome all'esercizio.");
    if (!(sets > 0) || [reps, rest, hold].some(n => !(n >= 0))) return Alert.alert('Valori non validi', 'Serie almeno 1; ripetizioni, recupero e tenuta numeri positivi.');
    if (f.mode !== 'none' && !(minutes > 0)) return Alert.alert('Minuti non validi', 'Indica quanti minuti dura il blocco.');
    onSave(
      { name, sets, reps, restSeconds: rest, durationSeconds: hold > 0 ? hold : undefined, supersetWithNext: canLink && f.linked },
      f.mode === 'none' ? undefined : { type: f.mode, minutes },
    );
    onClose();
  };

  const field = (k: 'sets' | 'reps' | 'rest' | 'hold', label: string, placeholder?: string) => (
    <View style={{ flex: 1 }}>
      <Field label={label} keyboardType="number-pad" placeholder={placeholder} value={f[k]} onChangeText={t => setF(p => ({ ...p, [k]: t }))} />
    </View>
  );

  return (
    <Sheet visible={!!exercise} onClose={onClose} title="Modifica esercizio">
      <Field label="Nome" value={f.name} onChangeText={t => setF(p => ({ ...p, name: t }))} />
      <View style={styles.row}>
        {field('sets', 'Serie')}
        {field('reps', 'Ripetizioni', '0 = max')}
      </View>
      <View style={styles.row}>
        {field('rest', 'Recupero (s)')}
        {field('hold', 'Tenuta (s)', 'facoltativa')}
      </View>
      {canLink ? (
        <View style={styles.switchRow}>
          <Txt v="body">Collega al successivo</Txt>
          <Switch value={f.linked} onValueChange={v => setF(p => ({ ...p, linked: v }))} trackColor={{ true: UI.ink, false: UI.border }} thumbColor={f.linked ? primaryColor : '#fff'} />
        </View>
      ) : null}
      <Txt v="label">{blockSize > 1 ? `Modalità del blocco (${blockSize} esercizi)` : 'Modalità'}</Txt>
      <View style={styles.row}>
        {([['none', blockSize > 1 || f.linked ? 'Superserie' : 'Normale', 'git-merge-outline'], ['emom', 'EMOM', 'alarm-outline'], ['amrap', 'AMRAP', 'flame-outline']] as const).map(([key, label, icon]) => {
          const on = f.mode === key;
          return (
            <Pressable key={key} onPress={() => setF(p => ({ ...p, mode: key }))} style={[styles.choice, on && { backgroundColor: UI.ink, borderColor: UI.ink }]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <Ionicons name={icon} size={18} color={on ? onInk(primaryColor) : UI.text} />
              <Txt v="label" color={on ? onInk(primaryColor) : UI.text}>{label}</Txt>
            </Pressable>
          );
        })}
      </View>
      {f.mode !== 'none' ? <Field label="Durata (minuti)" keyboardType="number-pad" value={f.minutes} onChangeText={t => setF(p => ({ ...p, minutes: t }))} /> : null}
      <Button title="Salva" icon="checkmark" onPress={save} />
    </Sheet>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choice: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: UI.border },
}));
