import { SessionVideos } from '@/components/SessionVideos';
import { WeightModal } from '@/components/session/WeightModal';
import { Button, Card, Delta, Empty, IconButton, Pill, Screen, Txt } from '@/components/ui/kit';
import { UI, themed } from '@/constants/theme';
import { useHistory } from '@/context/HistoryContext';
import { useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { dayKey, fmtSets, lastFor, unitOf, type LoggedExercise, type SessionLog } from '@/lib/stats';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

/** Everything trained on one calendar day (key from dayKey), with the change since the previous time. */
export default function DayHistoryScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const { sessions, updateSession, removeSession } = useHistory();
  const [editing, setEditing] = useState<{ s: SessionLog; e: LoggedExercise } | null>(null);
  const { plans } = useWeeklyPlans();
  const [y, m, d] = (day ?? '').split('-').map(Number);
  const title = new Date(y, m, d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const logs = sessions.filter(s => dayKey(new Date(s.date)) === day);

  const confirmDelete = (s: SessionLog) =>
    Alert.alert('Elimina allenamento', `Vuoi eliminare "${s.title}" da questo giorno? Grafici e record verranno ricalcolati.`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => removeSession(s.id) },
    ]);

  // a corrected value replaces the per-set values, which no longer match it
  const saveEdit = (v: number, unit: LoggedExercise['unit']) => {
    if (!editing) return;
    const { s, e } = editing;
    updateSession({ ...s, exercises: s.exercises.map(x => (x.exerciseId === e.exerciseId ? { ...x, weightKg: v, unit: unit === 'kg' ? undefined : unit, sets: undefined } : x)) });
  };

  if (!logs.length) {
    return (
      <Screen title="Giornata">
        <Txt v="h2" style={{ textTransform: 'capitalize' }}>{title}</Txt>
        <Empty icon="calendar-outline" title="Nessun allenamento" text="In questo giorno non hai registrato allenamenti." />
      </Screen>
    );
  }

  return (
    <Screen title="Giornata">
      <Txt v="h2" style={{ textTransform: 'capitalize' }}>{title}</Txt>
      {logs.map(s => {
        const plan = plans.find(p => p.id === s.planId);
        const older = sessions.slice(sessions.indexOf(s) + 1); // stored newest first
        return (
          <Card key={s.id}>
            <Txt v="h2">{s.title}</Txt>
            <View style={styles.pills}>
              <Pill icon="time-outline" text={`${Math.round(s.durationSec / 60)} min`} />
              <Pill icon="time" text={new Date(s.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} />
              {plan ? <Pill tone="accent" icon="calendar-outline" text={plan.name} /> : null}
            </View>
            {s.note ? <Txt v="muted">{`📝 ${s.note}`}</Txt> : null}
            {s.exercises.map(e => {
              const unit = unitOf(e);
              const prev = lastFor(older, e.exerciseId);
              const comparable = prev && unitOf(prev) === unit ? prev.weightKg : undefined;
              return (
                <Pressable
                  key={e.exerciseId}
                  disabled={!e.weightKg}
                  onPress={() => router.push({ pathname: '/weekly-plans/exercise-chart', params: plan ? { exerciseId: e.exerciseId, planId: plan.id } : { exerciseId: e.exerciseId } })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.exRow, pressed && { opacity: 0.6 }]}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt numberOfLines={1} style={{ fontWeight: '600' }}>{e.name}</Txt>
                    <View style={styles.pills}>
                      <Txt v="muted">{`${e.setsDone} serie × ${e.reps || 'max'}${e.weightKg ? ` · ${fmtSets(e)}` : ''}`}</Txt>
                      {e.weightKg ? <Delta from={comparable} to={e.weightKg} unit={unit} /> : null}
                    </View>
                  </View>
                  {e.weightKg ? <Ionicons name="stats-chart-outline" size={18} color={UI.subtle} /> : null}
                  <IconButton icon="create-outline" label={`Correggi valore di ${e.name}`} onPress={() => setEditing({ s, e })} />
                </Pressable>
              );
            })}
            <View style={styles.videos}>
              <Txt v="label">Video</Txt>
              <SessionVideos session={s} onChange={videos => updateSession({ ...s, videos })} />
            </View>
            <View style={styles.pills}>
              <IconButton icon="trash-outline" tone="danger" label="Elimina allenamento" onPress={() => confirmDelete(s)} />
            </View>
            {plan ? (
              <Button
                title="Vedi storico della scheda"
                icon="calendar-outline"
                variant="secondary"
                small
                onPress={() => router.push({ pathname: '/weekly-plans/history', params: { planId: plan.id, sessionId: s.id } })}
              />
            ) : null}
          </Card>
        );
      })}
      <Txt v="muted">La variazione è rispetto alla volta precedente. Tocca un esercizio per il grafico, la matita per correggere il valore.</Txt>
      <WeightModal
        visible={!!editing}
        title={editing?.e.name ?? ''}
        value={editing?.e.weightKg}
        unit={editing ? unitOf(editing.e) : 'kg'}
        onSave={saveEdit}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  videos: { gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: UI.border },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: UI.border },
}));
