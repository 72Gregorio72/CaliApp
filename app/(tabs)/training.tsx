import { Button, Card, Empty, IconButton, Pill, Screen, Txt } from '@/components/ui/kit';
import { useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { useWorkouts, type Workout } from '@/context/WorkoutContext';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';

export default function TrainingScreen() {
  const { workouts, addWorkout, deleteWorkout } = useWorkouts();
  const { plans, updatePlan } = useWeeklyPlans();

  const confirmDelete = (id: string, title: string) => {
    const usedIn = plans.filter(p => p.days?.some(d => d.workoutId === id));
    Alert.alert(
      'Elimina allenamento',
      `Vuoi eliminare "${title}"?${usedIn.length ? `\n\nÈ usato in: ${usedIn.map(p => p.name).join(', ')}. Quei giorni diventeranno di riposo.` : ''}`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => {
            usedIn.forEach(p => updatePlan(p.id, { name: p.name, days: p.days.map(d => (d.workoutId === id ? { ...d, workoutId: null } : d)) }));
            deleteWorkout(id);
          },
        },
      ],
    );
  };

  // exercises keep their ids: same exercise, same history in both workouts
  const duplicate = (w: Workout) => addWorkout({ title: `${w.title} (copia)`, exercises: w.exercises });

  return (
    <Screen
      tab
      subtitle="I tuoi"
      title="Allenamenti"
      right={<IconButton icon="add" tone="accent" label="Nuovo allenamento" onPress={() => router.push('/workouts/add')} />}
    >
      {workouts.length === 0 ? (
        <Empty
          icon="barbell-outline"
          title="Nessun allenamento"
          text="Crea il tuo primo allenamento oppure importalo da una foto con l'AI."
          action="Nuovo allenamento"
          onAction={() => router.push('/workouts/add')}
        />
      ) : (
        workouts.map(w => {
          const sets = w.exercises.reduce((n, e) => n + (e.sets || 0), 0);
          return (
            <Card key={w.id} onPress={() => router.push({ pathname: '/weekly-plans/workout-details', params: { workoutId: w.id } })}>
              <Txt v="h2">{w.title}</Txt>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pill tone="accent" icon="barbell-outline" text={`${w.exercises.length} esercizi`} />
                <Pill icon="layers-outline" text={`${sets} serie`} />
              </View>
              {w.exercises.length > 0 ? (
                <Txt v="muted" numberOfLines={2}>{w.exercises.map(e => e.name).join(' · ')}</Txt>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <Button
                  title="Inizia"
                  icon="play"
                  small
                  style={{ flex: 1 }}
                  onPress={() => router.push({ pathname: '/workouts/session', params: { workoutId: w.id } })}
                />
                <IconButton icon="create-outline" label="Modifica" onPress={() => router.push({ pathname: '/workouts/edit', params: { workoutId: w.id } })} />
                <IconButton icon="copy-outline" label="Duplica" onPress={() => duplicate(w)} />
                <IconButton icon="trash-outline" tone="danger" label="Elimina" onPress={() => confirmDelete(w.id, w.title)} />
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
