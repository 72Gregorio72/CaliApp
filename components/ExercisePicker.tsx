import { Field, Row, Sheet, Txt } from '@/components/ui/kit';
import { useWorkouts, type Exercise } from '@/context/WorkoutContext';
import { useState } from 'react';

/** All exercises across your workouts (one entry per exercise id), searchable by exercise or workout name. */
export function ExercisePicker({ visible, title, inUse = [], onPick, onClose }: {
  visible: boolean;
  title: string;
  inUse?: string[]; // ids already in this workout/session: still pickable, just marked
  onPick: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const { workouts } = useWorkouts();
  const [q, setQ] = useState('');
  const all = new Map<string, { ex: Exercise; from: string[] }>();
  for (const w of workouts) {
    for (const e of w.exercises) {
      const x = all.get(e.id);
      if (x) x.from.push(w.title);
      else all.set(e.id, { ex: e, from: [w.title] });
    }
  }
  const needle = q.trim().toLowerCase();
  const list = [...all.values()]
    .filter(({ ex, from }) => (!needle || ex.name.toLowerCase().includes(needle) || from.some(t => t.toLowerCase().includes(needle))))
    .sort((a, b) => a.ex.name.localeCompare(b.ex.name, 'it'));
  const close = () => {
    setQ('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={title}>
      <Field placeholder="Cerca esercizio o allenamento" value={q} onChangeText={setQ} autoCorrect={false} />
      {list.map(({ ex, from }) => (
        <Row
          key={ex.id}
          icon="barbell-outline"
          title={ex.name}
          subtitle={`${ex.sets} × ${ex.reps || 'max'} · ${from.join(', ')}${inUse.includes(ex.id) ? ' · già presente' : ''}`}
          onPress={() => {
            onPick(ex);
            close();
          }}
        />
      ))}
      {list.length === 0 ? <Txt v="muted">{needle ? `Nessun esercizio trovato per "${q.trim()}".` : 'Nessun altro esercizio nei tuoi allenamenti.'}</Txt> : null}
    </Sheet>
  );
}
