import { PlanForm } from '@/components/PlanForm';
import { Empty, Screen } from '@/components/ui/kit';
import { useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { router, useLocalSearchParams } from 'expo-router';

export default function EditWeeklyPlanScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { plans, updatePlan } = useWeeklyPlans();
  const plan = plans.find(p => p.id === planId);

  if (!plan) {
    return (
      <Screen title="Modifica">
        <Empty icon="alert-circle-outline" title="Scheda non trovata" action="Torna indietro" actionIcon="arrow-back" onAction={() => router.back()} />
      </Screen>
    );
  }

  return (
    <PlanForm
      key={plan.id}
      screenTitle="Modifica scheda"
      initial={plan}
      onSubmit={p => {
        updatePlan(plan.id, p);
        router.back();
      }}
    />
  );
}
