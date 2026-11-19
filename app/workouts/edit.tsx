import { WorkoutForm } from '@/components/WorkoutForm';
import { Empty, Screen } from '@/components/ui/kit';
import { useWorkouts } from '@/context/WorkoutContext';
import { router, useLocalSearchParams } from 'expo-router';

export default function EditWorkoutScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const { workouts, updateWorkout } = useWorkouts();
  const workout = workouts.find(w => w.id === workoutId);

  if (!workout) {
    return (
      <Screen title="Modifica">
        <Empty icon="alert-circle-outline" title="Allenamento non trovato" action="Torna indietro" actionIcon="arrow-back" onAction={() => router.back()} />
      </Screen>
    );
  }

  return (
    <WorkoutForm
      key={workout.id}
      screenTitle="Modifica allenamento"
      initial={workout}
      onSubmit={w => {
        updateWorkout(workout.id, w);
        router.back();
      }}
    />
  );
}
