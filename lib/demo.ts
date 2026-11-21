// Debug only: a month of fake history on a Mon/Wed/Fri plan. Everything uses the "demo_" id prefix,
// so re-seeding replaces the old demo data and never touches real data.
import type { WeeklyPlan } from '@/context/WeeklyPlanContext';
import type { Workout } from '@/context/WorkoutContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionLog, Unit } from './stats';

const ex = (id: string, name: string, sets: number, reps: number, restSeconds = 90) => ({ id: `demo_${id}`, name, sets, reps, restSeconds });
const now = new Date().toISOString();
const WORKOUTS: (Workout & { base: number[] })[] = [
  { id: 'demo_push', title: 'Demo Push', createdAt: now, exercises: [ex('panca', 'Panca piana', 4, 8), ex('lento', 'Lento avanti', 3, 10), ex('dip', 'Dip', 3, 12)], base: [60, 30, 10] },
  { id: 'demo_pull', title: 'Demo Pull', createdAt: now, exercises: [ex('trazioni', 'Trazioni', 4, 8), ex('rematore', 'Rematore', 4, 10), ex('curl', 'Curl bilanciere', 3, 12)], base: [0, 50, 25] },
  { id: 'demo_legs', title: 'Demo Gambe', createdAt: now, exercises: [ex('squat', 'Squat', 5, 5, 120), ex('stacco', 'Stacco rumeno', 3, 10), ex('pressa', 'Pressa', 3, 12), ex('plank', 'Plank', 3, 0)], base: [80, 70, 120, 0] },
];
// calisthenics demo: logged as max reps / hold seconds instead of kg
const CALI: Record<string, Unit> = { demo_trazioni: 'reps', demo_dip: 'reps', demo_plank: 'sec' };
const PLAN_ID = 'demo_plan';
// Mon, Wed, Fri
const SLOT: Record<number, number> = { 1: 0, 3: 1, 5: 2 };

const isDemo = (x: { id?: string } | null) => !!x?.id?.startsWith('demo_');
async function merge<T extends { id?: string }>(key: string, add: T[], prepend = false) {
  const old = (JSON.parse((await AsyncStorage.getItem(key)) ?? '[]') as T[]).filter(x => !isDemo(x));
  await AsyncStorage.setItem(key, JSON.stringify(prepend ? [...add, ...old] : [...old, ...add]));
}

export async function seedDemo() {
  const logs: SessionLog[] = [];
  const day = new Date();
  for (let back = 30; back >= 1; back--) {
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate() - back, 18, 30);
    const slot = SLOT[d.getDay()];
    if (slot === undefined) continue;
    const w = WORKOUTS[slot];
    const n = logs.filter(l => l.workoutId === w.id).length; // nth time this workout: weights grow, with some noise
    logs.unshift({
      id: `demo_s${back}`,
      workoutId: w.id,
      planId: PLAN_ID,
      title: w.title,
      date: d.toISOString(),
      durationSec: 3000 + ((back * 137) % 900),
      exercises: w.exercises.map((e, i) => {
        const unit = CALI[e.id];
        if (unit) return { exerciseId: e.id, name: e.name, setsDone: e.sets, reps: e.reps, weightKg: (unit === 'sec' ? 20 : 6) + n * (unit === 'sec' ? 5 : 1), unit };
        const kg = w.base[i] ? w.base[i] + n * 2.5 - (n % 3 === 2 ? 2.5 : 0) : 0;
        return { exerciseId: e.id, name: e.name, setsDone: e.sets, reps: e.reps, ...(kg ? { weightKg: kg } : {}) };
      }),
    });
  }
  const plan: WeeklyPlan = {
    id: PLAN_ID,
    name: 'Demo PPL 3x',
    createdAt: now,
    days: (['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'] as const).map((d, i) => ({ day: d, workoutId: SLOT[(i + 1) % 7] !== undefined ? WORKOUTS[SLOT[(i + 1) % 7]].id : null })),
  };
  await merge('@gym_app_workouts', WORKOUTS.map(({ base, ...w }) => w));
  await merge('@gym_app_weekly_plans', [plan]);
  await merge('@gym_app_history', logs, true); // history is newest first
  await AsyncStorage.setItem('@gym_app_active_plan', PLAN_ID);

  // one weigh-in per morning for 30 days, slowly dropping with some noise; extra demo_ id marks them for re-seeding
  const weights = Array.from({ length: 30 }, (_, i) => {
    const back = 30 - i;
    return { id: `demo_bw${back}`, date: new Date(day.getFullYear(), day.getMonth(), day.getDate() - back, 8).toISOString(), kg: Math.round((78 - i * 0.07 + ((back * 7) % 5) * 0.2 - 0.4) * 10) / 10 };
  });
  const oldBw = (JSON.parse((await AsyncStorage.getItem('@gym_app_body_weight')) ?? '[]') as { id?: string; date: string }[]).filter(x => !isDemo(x));
  // body weights are newest first, real ones may be newer or older than the demo month
  await AsyncStorage.setItem('@gym_app_body_weight', JSON.stringify([...oldBw, ...weights].sort((a, b) => b.date.localeCompare(a.date))));
}
