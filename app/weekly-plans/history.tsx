import { Card, Delta, Empty, HeroCard, Pill, Row, Screen, Section, Sparkline, Txt, onColor, onInk } from '@/components/ui/kit';
import { UI, themed } from '@/constants/theme';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { useHistory } from '@/context/HistoryContext';
import { useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { useWorkouts } from '@/context/WorkoutContext';
import { fmtDay, fmtSets, fmtShort, fmtVal, weightPoints } from '@/lib/stats';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

/** History of one weekly plan: for each training day, how every exercise is progressing. */
export default function PlanHistoryScreen() {
  const { planId, sessionId } = useLocalSearchParams<{ planId: string; sessionId?: string }>();
  const { plans } = useWeeklyPlans();
  const { workouts } = useWorkouts();
  const { sessions } = useHistory();
  const { primaryColor } = useCustomTheme();
  const plan = plans.find(p => p.id === planId);

  if (!plan) {
    return (
      <Screen title="Storico scheda">
        <Empty icon="alert-circle-outline" title="Scheda non trovata" text="Potrebbe essere stata eliminata." action="Torna indietro" actionIcon="arrow-back" onAction={() => router.back()} />
      </Screen>
    );
  }

  const logs = sessions.filter(s => s.planId === plan.id);
  const picked = logs.find(s => s.id === sessionId);
  const fg = onColor(primaryColor);
  const openChart = (exerciseId: string) => router.push({ pathname: '/weekly-plans/exercise-chart', params: { exerciseId, planId: plan.id } });

  return (
    <Screen title="Storico scheda">
      <HeroCard>
        <Txt v="label" color={fg} style={{ opacity: 0.8 }}>Scheda</Txt>
        <Txt v="h1" color={fg}>{plan.name}</Txt>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pill tone="onAccent" icon="barbell-outline" text={`${logs.length} allenamenti`} />
          {logs.length ? <Pill tone="onAccent" icon="calendar-outline" text={`dal ${fmtShort(logs[logs.length - 1].date)}`} /> : null}
        </View>
      </HeroCard>

      {picked ? (
        <Section title={`Allenamento del ${fmtDay(picked.date)}`}>
          <Card>
            <Txt v="h3">{picked.title}</Txt>
            {picked.exercises.map(e => (
              <Pressable key={e.exerciseId} onPress={() => openChart(e.exerciseId)} style={styles.line}>
                <Txt style={{ flex: 1 }} numberOfLines={1}>{e.name}</Txt>
                <Txt v="muted">{`${e.setsDone}×${e.reps}${e.weightKg ? ` · ${fmtSets(e)}` : ''}`}</Txt>
              </Pressable>
            ))}
            <Txt v="muted">{`Durata ${Math.round(picked.durationSec / 60)} min`}</Txt>
            {picked.note ? <Txt v="muted">{`📝 ${picked.note}`}</Txt> : null}
          </Card>
        </Section>
      ) : null}

      <Txt v="muted">Per ogni giorno: ultimo valore (kg, rep o tenuta) e variazione dal primo allenamento. Tocca un esercizio per il grafico completo.</Txt>

      {plan.days.map(d => {
        const w = workouts.find(x => x.id === d.workoutId);
        if (!w) return null;
        const dayLogs = logs.filter(l => l.workoutId === w.id);
        return (
          <Card key={d.day}>
            <View style={styles.dayHead}>
              <View style={styles.dayBadge}>
                <Txt v="h3" color={onInk(primaryColor)}>{d.day.slice(0, 3)}</Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="h3">{w.title}</Txt>
                <Txt v="muted">{dayLogs.length ? `${dayLogs.length} volte · ultima ${fmtShort(dayLogs[0].date)}` : 'Non ancora fatto'}</Txt>
              </View>
            </View>
            {w.exercises.map((ex, i) => {
              const pts = weightPoints(dayLogs, ex.id);
              const first = pts[0];
              const last = pts.at(-1);
              return (
                <Pressable
                  key={ex.id || `ex_${i}`}
                  onPress={() => openChart(ex.id)}
                  disabled={!pts.length}
                  accessibilityRole="button"
                  accessibilityLabel={`${ex.name}, apri grafico`}
                  style={({ pressed }) => [styles.exRow, pressed && { opacity: 0.6 }]}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt numberOfLines={1} style={{ fontWeight: '600' }}>{ex.name}</Txt>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Txt v="muted">{last ? fmtVal(last.kg, last.unit) : `${ex.sets}×${ex.reps} · nessun valore`}</Txt>
                      {pts.length >= 2 ? <Delta from={first?.kg} to={last?.kg} unit={last?.unit} /> : null}
                    </View>
                  </View>
                  {pts.length >= 2 ? (
                    <View style={{ width: 72 }}>
                      <Sparkline values={pts.map(p => p.kg)} color={UI.text} />
                    </View>
                  ) : null}
                  {pts.length ? <Ionicons name="chevron-forward" size={18} color={UI.subtle} /> : null}
                </Pressable>
              );
            })}
          </Card>
        );
      })}

      {logs.length ? (
        <Section title="Tutti gli allenamenti di questa scheda">
          {logs.map(l => (
            <Row
              key={l.id}
              icon={l.id === sessionId ? 'checkmark-circle' : 'barbell-outline'}
              title={l.title}
              subtitle={`${fmtDay(l.date)} · ${Math.round(l.durationSec / 60)} min`}
              onPress={() => router.setParams({ sessionId: l.id })}
            />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayBadge: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: UI.ink },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: UI.border },
}));
