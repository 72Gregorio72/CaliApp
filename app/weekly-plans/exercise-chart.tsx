import { Card, Delta, Empty, Row, Screen, Section, Stat, Txt } from '@/components/ui/kit';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { useHistory } from '@/context/HistoryContext';
import { useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { e1rm, fmtDay, fmtSets, fmtShort, fmtVal, weightPoints } from '@/lib/stats';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { WeightChart } from '@/components/WeightChart';

/** Progress of one exercise, within one plan (planId) or across all history. */
export default function ExerciseChartScreen() {
  const { exerciseId, planId } = useLocalSearchParams<{ exerciseId: string; planId?: string }>();
  const { sessions } = useHistory();
  const { plans } = useWeeklyPlans();
  const { primaryColor } = useCustomTheme();
  const plan = plans.find(p => p.id === planId);
  const points = weightPoints(planId ? sessions.filter(s => s.planId === planId) : sessions, exerciseId);
  const name = points.at(-1)?.name ?? 'Esercizio';

  if (points.length === 0) {
    return (
      <Screen title={name}>
        <Empty icon="stats-chart-outline" title="Nessun valore registrato" text="Segna kg, rep o tenuta durante l'allenamento per vedere la progressione." />
      </Screen>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const newestFirst = [...points].reverse();
  const unit = last.unit;
  const fmt = (v: number) => fmtVal(v, unit);
  // reps 0 = "max": no estimate possible
  const oneRm = unit === 'kg' ? Math.max(0, ...points.filter(p => p.reps > 0).map(p => e1rm(p.kg, p.reps))) : 0;

  return (
    <Screen title={name}>
      <View>
        <Txt v="label">{plan ? `Scheda ${plan.name}` : 'Tutti gli allenamenti'}</Txt>
        <Txt v="h2">{name}</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Stat value={fmt(first.kg)} label="Inizio" />
        <Stat value={fmt(last.kg)} label="Ultimo" />
        <Stat value={fmt(Math.max(...points.map(p => p.kg)))} label="Record" />
      </View>
      {oneRm ? <Txt v="muted">{`Massimale stimato (1RM): ${fmt(oneRm)} · formula di Epley sul tuo miglior allenamento`}</Txt> : null}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt v="h3">{unit === 'kg' ? 'Peso nel tempo' : unit === 'reps' ? 'Ripetizioni nel tempo' : 'Tenuta nel tempo'}</Txt>
          <Delta from={first.kg} to={last.kg} unit={unit} />
        </View>
        <WeightChart points={points} color={primaryColor} unit={unit} />
        <Txt v="muted">{`${points.length} allenamenti dal ${fmtShort(first.date)} · il punto grande è il record`}</Txt>
      </Card>
      <Section title="Sessioni">
        {newestFirst.map((p, i) => (
          <Row
            key={`${p.date}_${i}`}
            title={fmt(p.kg)}
            subtitle={`${fmtDay(p.date)} · ${p.setsDone}×${p.reps}${p.sets ? ` · ${fmtSets(p)}` : ''}`}
            right={<Delta from={newestFirst[i + 1]?.kg} to={p.kg} unit={unit} />}
          />
        ))}
      </Section>
    </Screen>
  );
}
