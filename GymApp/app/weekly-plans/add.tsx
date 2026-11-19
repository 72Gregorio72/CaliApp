import { PlanForm } from '@/components/PlanForm';
import { useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { router } from 'expo-router';

export default function AddWeeklyPlanScreen() {
  const { addPlan } = useWeeklyPlans();
  return (
    <PlanForm
      screenTitle="Nuova scheda"
      onSubmit={p => {
        addPlan(p);
        router.back();
      }}
    />
  );
}
