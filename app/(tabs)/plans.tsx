import { Button, Card, Empty, Field, IconButton, Pill, Screen, Sheet, Txt, WeekStrip, todayIndex } from '@/components/ui/kit';
import { UI, themed } from '@/constants/theme';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { useWeeklyPlans, type WeeklyPlan } from '@/context/WeeklyPlanContext';
import { notificationsAvailable, parseTime } from '@/lib/notifications';
import { useWorkouts } from '@/context/WorkoutContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

export default function PlansScreen() {
  const { plans, addPlan, deletePlan, activePlanId, setActivePlan } = useWeeklyPlans();
  const { workouts } = useWorkouts();
  const { primaryColor } = useCustomTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const [remindersFor, setRemindersFor] = useState<WeeklyPlan | null>(null);
  const today = todayIndex();

  const workoutTitle = (id: string | null) => (id ? workouts.find(w => w.id === id)?.title ?? 'Allenamento eliminato' : 'Riposo');
  const openWorkout = (workoutId: string) => router.push({ pathname: '/weekly-plans/workout-details', params: { workoutId } });

  const confirmDelete = (id: string, name: string) =>
    Alert.alert('Elimina scheda', `Vuoi eliminare "${name}"?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => deletePlan(id) },
    ]);

  return (
    <Screen
      tab
      subtitle="Settimanali"
      title="Schede"
      right={<IconButton icon="add" tone="accent" label="Nuova scheda" onPress={() => router.push('/weekly-plans/add')} />}
    >
      {plans.length === 0 ? (
        <Empty
          icon="calendar-outline"
          title="Nessuna scheda"
          text="Una scheda assegna un allenamento a ogni giorno della settimana."
          action="Crea scheda"
          onAction={() => router.push('/weekly-plans/add')}
        />
      ) : (
        plans.filter(p => Array.isArray(p?.days)).map(p => {
          const open = openId === p.id;
          const active = p.days.filter(d => d.workoutId).length;
          return (
            <Card key={p.id} onPress={() => setOpenId(open ? null : p.id)}>
              <View style={styles.head}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Txt v="h2">{p.name}</Txt>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pill tone="accent" icon="flame-outline" text={`${active}/7 giorni`} />
                    {p.id === activePlanId ? <Pill icon="checkmark-circle" text="Attiva" /> : null}
                  </View>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={UI.subtle} />
              </View>
              <WeekStrip days={p.days} onPressDay={i => openWorkout(p.days[i].workoutId!)} />

              {open ? (
                <View style={styles.days}>
                  {p.days.map((d, i) => (
                    <Pressable
                      key={d.day}
                      disabled={!d.workoutId}
                      onPress={() => openWorkout(d.workoutId!)}
                      style={[styles.dayRow, i === today && { backgroundColor: `${primaryColor}14` }]}
                    >
                      <Txt v="label" style={styles.dayName} color={i === today ? UI.text : undefined}>{d.day.slice(0, 3)}</Txt>
                      <Txt v={d.workoutId ? 'h3' : 'muted'} style={{ flex: 1 }} numberOfLines={1}>{workoutTitle(d.workoutId)}</Txt>
                      {d.workoutId && d.reminder ? <Pill icon="notifications-outline" text={d.reminder} /> : null}
                      {d.workoutId ? <Ionicons name="chevron-forward" size={18} color={UI.subtle} /> : null}
                    </Pressable>
                  ))}
                  {p.id !== activePlanId ? (
                    <Button title="Usa come scheda attiva" icon="checkmark-circle-outline" small style={{ marginTop: 6 }} onPress={() => setActivePlan(p.id)} />
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                    <Button
                      title="Modifica"
                      icon="create-outline"
                      variant="secondary"
                      small
                      style={{ flex: 1 }}
                      onPress={() => router.push({ pathname: '/weekly-plans/edit', params: { planId: p.id } })}
                    />
                    <IconButton icon="notifications-outline" label="Promemoria" onPress={() => setRemindersFor(p)} />
                    <IconButton icon="copy-outline" label="Duplica scheda" onPress={() => addPlan({ name: `${p.name} (copia)`, days: p.days })} />
                    <IconButton icon="trash-outline" tone="danger" label="Elimina scheda" onPress={() => confirmDelete(p.id, p.name)} />
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })
      )}
      {remindersFor ? <RemindersSheet key={remindersFor.id} plan={remindersFor} active={remindersFor.id === activePlanId} onClose={() => setRemindersFor(null)} /> : null}
    </Screen>
  );
}

/** Per training day: on/off and time of the weekly reminder. */
function RemindersSheet({ plan, active, onClose }: { plan: WeeklyPlan; active: boolean; onClose: () => void }) {
  const { updatePlan } = useWeeklyPlans();
  const { workouts } = useWorkouts();
  const { primaryColor } = useCustomTheme();
  const [rows, setRows] = useState(plan.days.map(d => ({ on: !!d.reminder, time: d.reminder ?? '18:00' })));
  const edit = (i: number, patch: Partial<(typeof rows)[number]>) => setRows(prev => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () => {
    const bad = plan.days.findIndex((d, i) => d.workoutId && rows[i].on && !parseTime(rows[i].time));
    if (bad >= 0) return Alert.alert('Orario non valido', `${plan.days[bad].day}: scrivi l'orario come 18:30.`);
    updatePlan(plan.id, {
      name: plan.name,
      days: plan.days.map((d, i) => {
        const t = parseTime(rows[i].time);
        const { reminder, ...rest } = d;
        return rows[i].on && t ? { ...rest, reminder: `${String(t[0]).padStart(2, '0')}:${String(t[1]).padStart(2, '0')}` } : rest;
      }),
    });
    onClose();
  };

  const training = plan.days.map((d, i) => ({ d, i })).filter(({ d }) => d.workoutId);
  return (
    <Sheet visible onClose={onClose} title={`Promemoria · ${plan.name}`}>
      {!notificationsAvailable ? <Txt v="muted">⚠️ In Expo Go i promemoria non vengono programmati: servono la build di sviluppo.</Txt> : null}
      {!active ? <Txt v="muted">Suonano solo quando questa è la scheda attiva.</Txt> : null}
      {training.length === 0 ? <Txt v="muted">Questa scheda non ha giorni di allenamento.</Txt> : null}
      {training.map(({ d, i }) => (
        <View key={d.day} style={styles.reminderRow}>
          <View style={{ flex: 1 }}>
            <Txt v="h3">{d.day}</Txt>
            <Txt v="muted" numberOfLines={1}>{workouts.find(w => w.id === d.workoutId)?.title ?? 'Allenamento eliminato'}</Txt>
          </View>
          {rows[i].on ? (
            <Field value={rows[i].time} onChangeText={t => edit(i, { time: t })} keyboardType="numbers-and-punctuation" placeholder="18:30" style={styles.time} accessibilityLabel={`Orario ${d.day}`} />
          ) : null}
          <Switch
            value={rows[i].on}
            onValueChange={on => edit(i, { on })}
            trackColor={{ true: primaryColor, false: UI.border }}
            thumbColor="#fff"
            accessibilityLabel={`Promemoria ${d.day}`}
          />
        </View>
      ))}
      <Button title="Salva promemoria" icon="checkmark" onPress={save} />
    </Sheet>
  );
}

const styles = themed(() => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  days: { gap: 4, marginTop: 6, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: UI.border },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12 },
  dayName: { width: 40 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  time: { width: 80, textAlign: 'center', paddingVertical: 8 },
}));
