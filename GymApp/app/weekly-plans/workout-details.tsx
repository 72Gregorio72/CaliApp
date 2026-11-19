import { Button, Card, Empty, HeroCard, IconButton, Pill, Screen, Sparkline, Txt, onColor, onInk } from '@/components/ui/kit';
import { UI } from '@/constants/theme';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { useHistory } from '@/context/HistoryContext';
import { useWorkouts } from '@/context/WorkoutContext';
import { bestKg, fmtVal, lastFor, parseKg, unitOf, weightSeries } from '@/lib/stats';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

export default function WorkoutDetailsScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const { workouts } = useWorkouts();
  const { sessions } = useHistory();
  const { primaryColor } = useCustomTheme();
  const workout = workouts.find(w => w.id === workoutId);

  if (!workout) {
    return (
      <Screen title="Dettagli">
        <Empty icon="alert-circle-outline" title="Allenamento non trovato" action="Torna indietro" actionIcon="arrow-back" onAction={() => router.back()} />
      </Screen>
    );
  }

  const sets = workout.exercises.reduce((n, e) => n + (e.sets || 0), 0);
  const fg = onColor(primaryColor);

  return (
    <Screen
      title="Dettagli"
      footer={
        <View style={styles.footer}>
          <IconButton icon="create-outline" label="Modifica" onPress={() => router.push({ pathname: '/workouts/edit', params: { workoutId: workout.id } })} />
          <Button
            title="Inizia allenamento"
            icon="play"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/workouts/session', params: { workoutId: workout.id } })}
          />
        </View>
      }
    >
      <HeroCard>
        <Txt v="label" color={fg} style={{ opacity: 0.8 }}>Allenamento</Txt>
        <Txt v="h1" color={fg}>{workout.title}</Txt>
        <View style={styles.pills}>
          <Pill tone="onAccent" icon="barbell-outline" text={`${workout.exercises.length} esercizi`} />
          <Pill tone="onAccent" icon="layers-outline" text={`${sets} serie`} />
        </View>
      </HeroCard>

      {workout.exercises.map((ex, i) => {
        const last = lastFor(sessions, ex.id);
        const unit = last ? unitOf(last) : 'kg';
        const record = bestKg(sessions, ex.id, unit) ?? (unit === 'kg' ? parseKg(ex.maxWeight) : undefined);
        const series = weightSeries(sessions, ex.id);
        return (
        <Card key={ex.id || `ex_${i}`}>
          <View style={styles.head}>
            <View style={[styles.num, { backgroundColor: UI.ink }]}>
              <Txt v="h3" color={onInk(primaryColor)}>{i + 1}</Txt>
            </View>
            <Txt v="h3" style={{ flex: 1 }}>{ex.name}</Txt>
          </View>
          <View style={styles.pills}>
            <Pill tone="accent" text={`${ex.sets} × ${ex.reps}`} />
            <Pill icon="time-outline" text={`${ex.restSeconds}s recupero`} />
            {ex.durationSeconds ? <Pill icon="stopwatch-outline" text={`${ex.durationSeconds}s`} /> : null}
            {record ? <Pill icon="trophy-outline" text={fmtVal(record, unit)} /> : ex.maxWeight ? <Pill icon="trophy-outline" text={ex.maxWeight} /> : null}
            {ex.supersetWithNext ? <Pill icon="link-outline" text="Superserie con il successivo" /> : null}
          </View>
          {last ? <Txt v="muted">{`Ultima volta: ${last.setsDone}×${last.reps}${last.weightKg ? ` · ${fmtVal(last.weightKg, unit)}` : ''} (${new Date(last.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })})`}</Txt> : null}
          {series.length >= 2 ? (
            <Pressable onPress={() => router.push({ pathname: '/weekly-plans/exercise-chart', params: { exerciseId: ex.id } })} accessibilityRole="button" accessibilityLabel={`${ex.name}, apri grafico`}>
              <Sparkline values={series} color={primaryColor} />
            </Pressable>
          ) : null}
          {ex.description ? <Txt v="muted">{ex.description}</Txt> : null}
        </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  num: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
