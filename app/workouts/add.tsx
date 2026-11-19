import { WorkoutForm } from '@/components/WorkoutForm';
import { useWorkouts } from '@/context/WorkoutContext';
import { router } from 'expo-router';

export default function AddWorkoutScreen() {
  const { addWorkout } = useWorkouts();
  return (
    <WorkoutForm
      screenTitle="Nuovo allenamento"
      allowImport
      onSubmit={w => {
        addWorkout(w);
        router.back();
      }}
    />
  );
}
