import { Button, Field, Row, Sheet, Txt } from '@/components/ui/kit';
import { useWorkouts, type Exercise } from '@/context/WorkoutContext';
import { useState } from 'react';
import { Alert, View } from 'react-native';

const SINGLE = 'Esercizio singolo';
const EMPTY_FORM = { name: '', sets: '3', reps: '10', rest: '90', hold: '' };
const newId = () => `single_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** All exercises across your workouts plus the standalone ones (one entry per id), searchable by exercise or workout name. */
export function ExercisePicker({ visible, title, inUse = [], onPick, canCreate, onClose }: {
  visible: boolean;
  title: string;
  inUse?: string[]; // ids already in this workout/session: still pickable, just marked
  onPick: (ex: Exercise) => void;
  canCreate?: boolean; // offers a form for a new standalone exercise, saved so later pickers list it too
  onClose: () => void;
}) {
  const { workouts, exercises, addExercise } = useWorkouts();
  const [q, setQ] = useState('');
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  const all = new Map<string, { ex: Exercise; from: string[] }>();
  for (const w of workouts) {
    for (const e of w.exercises) {
      const x = all.get(e.id);
      if (x) x.from.push(w.title);
      else all.set(e.id, { ex: e, from: [w.title] });
    }
  }
  // a standalone exercise later saved into a workout shows once, under that workout
  for (const e of exercises) if (!all.has(e.id)) all.set(e.id, { ex: e, from: [SINGLE] });
  const needle = q.trim().toLowerCase();
  const list = [...all.values()]
    .filter(({ ex, from }) => (!needle || ex.name.toLowerCase().includes(needle) || from.some(t => t.toLowerCase().includes(needle))))
    .sort((a, b) => a.ex.name.localeCompare(b.ex.name, 'it'));
  const close = () => {
    setQ('');
    setForm(null);
    onClose();
  };
  const pick = (ex: Exercise) => {
    onPick(ex);
    close();
  };

  const create = () => {
    if (!form) return;
    const name = form.name.trim();
    const sets = parseInt(form.sets, 10);
    const reps = parseInt(form.reps || '0', 10);
    const rest = parseInt(form.rest || '0', 10);
    const hold = parseInt(form.hold || '0', 10);
    if (!name) return Alert.alert('Nome mancante', "Dai un nome all'esercizio.");
    // same name = same exercise: reuse it so its history stays in one place
    const existing = [...all.values()].find(({ ex }) => ex.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) return Alert.alert('Esiste già', `"${existing.ex.name}" è già tra i tuoi esercizi.`, [{ text: 'Annulla', style: 'cancel' }, { text: 'Usalo', onPress: () => pick(existing.ex) }]);
    if (!(sets > 0) || reps < 0 || rest < 0 || hold < 0 || [reps, rest, hold].some(Number.isNaN)) return Alert.alert('Valori non validi', 'Serie deve essere almeno 1; ripetizioni, recupero e tenuta numeri positivi.');
    const ex: Exercise = {
      id: newId(),
      name,
      sets,
      reps,
      restSeconds: rest,
      ...(hold > 0 ? { durationSeconds: hold } : {}),
    };
    addExercise(ex);
    pick(ex);
  };

  if (form) {
    const set = (k: keyof typeof EMPTY_FORM) => (t: string) => setForm({ ...form, [k]: t });
    return (
      <Sheet visible={visible} onClose={close} title="Nuovo esercizio">
        <Field label="Nome" value={form.name} onChangeText={set('name')} autoFocus />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Serie" keyboardType="number-pad" value={form.sets} onChangeText={set('sets')} /></View>
          <View style={{ flex: 1 }}><Field label="Ripetizioni" keyboardType="number-pad" placeholder="0 = max" value={form.reps} onChangeText={set('reps')} /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Recupero (s)" keyboardType="number-pad" value={form.rest} onChangeText={set('rest')} /></View>
          <View style={{ flex: 1 }}><Field label="Tenuta (s)" keyboardType="number-pad" placeholder="facoltativa" value={form.hold} onChangeText={set('hold')} /></View>
        </View>
        <Txt v="muted">Resta tra i tuoi esercizi come esercizio singolo, anche senza un allenamento.</Txt>
        <Button title="Crea e aggiungi" icon="add" onPress={create} />
        <Button title="Indietro" variant="secondary" onPress={() => setForm(null)} />
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={close} title={title}>
      <Field placeholder="Cerca esercizio o allenamento" value={q} onChangeText={setQ} autoCorrect={false} />
      {canCreate ? <Row icon="add" title={needle ? `Crea "${q.trim()}"` : 'Crea nuovo esercizio'} subtitle="Esercizio singolo, resta salvato" onPress={() => setForm({ ...EMPTY_FORM, name: q.trim() })} /> : null}
      {list.map(({ ex, from }) => (
        <Row
          key={ex.id}
          icon="barbell-outline"
          title={ex.name}
          subtitle={`${ex.sets} × ${ex.reps || 'max'}${ex.durationSeconds ? ` · tenuta ${ex.durationSeconds}s` : ''} · ${from.join(', ')}${inUse.includes(ex.id) ? ' · già presente' : ''}`}
          onPress={() => pick(ex)}
        />
      ))}
      {list.length === 0 ? <Txt v="muted">{needle ? `Nessun esercizio trovato per "${q.trim()}".` : 'Nessun altro esercizio salvato.'}</Txt> : null}
    </Sheet>
  );
}
