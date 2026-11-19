import { Button, Card, Empty, IconButton, Pill, Screen, Txt, WeekStrip, todayIndex } from '@/components/ui/kit';
import { UI, themed } from '@/constants/theme';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { useWorkouts } from '@/context/WorkoutContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

export default function PlansScreen() {
  const { plans, addPlan, deletePlan, activePlanId, setActivePlan } = useWeeklyPlans();
  const { workouts } = useWorkouts();
  const { primaryColor } = useCustomTheme();
  const [openId, setOpenId] = useState<string | null>(null);
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
                    <IconButton icon="copy-outline" label="Duplica scheda" onPress={() => addPlan({ name: `${p.name} (copia)`, days: p.days })} />
                    <IconButton icon="trash-outline" tone="danger" label="Elimina scheda" onPress={() => confirmDelete(p.id, p.name)} />
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  days: { gap: 4, marginTop: 6, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: UI.border },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12 },
  dayName: { width: 40 },
}));
