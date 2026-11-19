// Pure helpers over the session history (no React Native imports: lib/stats.check.mjs runs them in plain node).

/** What the logged value measures: kg lifted, max reps, or hold seconds (calisthenics). */
export type Unit = 'kg' | 'reps' | 'sec';
export const UNITS: { unit: Unit; label: string }[] = [{ unit: 'kg', label: 'Kg' }, { unit: 'reps', label: 'Rep' }, { unit: 'sec', label: 'Tenuta' }];
// weightKg keeps its name for stored-data compatibility: it holds the value in `unit` (missing unit = kg)
export type LoggedExercise = { exerciseId: string; name: string; setsDone: number; reps: number; weightKg?: number; unit?: Unit };
export const unitOf = (e: { unit?: Unit }) => e.unit ?? 'kg';
const SUFFIX: Record<Unit, string> = { kg: 'kg', reps: 'rep', sec: 's' };
export const fmtVal = (v: number, unit: Unit = 'kg') => `${String(v).replace('.', ',')} ${SUFFIX[unit]}`;
// planId: weekly plan the session was done under; missing on sessions saved before per-plan history
export type SessionLog = { id: string; workoutId: string; planId?: string; title: string; date: string; durationSec: number; exercises: LoggedExercise[] };

/** "80", "80,5", "80.5 kg" -> number; "2x20", "bodyweight" -> undefined */
// stored data (legacy/imported/AI JSON) may hold a number here, despite the type
export const parseKg = (t?: string | number) => {
  const m = t == null ? null : String(t).trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg)?$/i);
  return m ? Number(m[1].replace(',', '.')) : undefined;
};

/** Most recent logged entry of an exercise. Logs are stored newest first. */
export const lastFor = (logs: SessionLog[], exerciseId: string) => {
  for (const l of logs) {
    const e = l.exercises.find(x => x.exerciseId === exerciseId);
    if (e) return { ...e, date: l.date };
  }
  return undefined;
};

export const bestKg = (logs: SessionLog[], exerciseId: string, unit: Unit = 'kg') => {
  let best: number | undefined;
  for (const l of logs) for (const e of l.exercises) if (e.exerciseId === exerciseId && unitOf(e) === unit && e.weightKg && (best === undefined || e.weightKg > best)) best = e.weightKg;
  return best;
};

/** Logged values, oldest first, with session date. Only entries in the latest unit, so a switched unit never mixes on one chart. */
export const weightPoints = (logs: SessionLog[], exerciseId: string) => {
  const all = logs.flatMap(l => l.exercises.filter(e => e.exerciseId === exerciseId && e.weightKg).map(e => ({ ...e, kg: e.weightKg!, unit: unitOf(e), date: l.date }))).reverse();
  const unit = all.at(-1)?.unit;
  return all.filter(p => p.unit === unit);
};

/** Weights over time, oldest first. */
export const weightSeries = (logs: SessionLog[], exerciseId: string) => weightPoints(logs, exerciseId).map(p => p.kg);

// shortcut: one weight per exercise, not per set; track per-set weights if users ask for it
export const volume = (l: SessionLog) => l.exercises.reduce((n, e) => n + (unitOf(e) === 'kg' ? e.setsDone * e.reps * (e.weightKg ?? 0) : 0), 0);

/** Monday 00:00 of the week containing d (local time). */
export const weekStart = (d: Date) => {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
};

export const thisWeek = (logs: SessionLog[], now = new Date()) => {
  const from = weekStart(now).getTime();
  return logs.filter(l => new Date(l.date).getTime() >= from);
};

/** Consecutive weeks with at least one session. The current week only counts once trained, so the streak is not 0 on Monday. */
export const weekStreak = (logs: SessionLog[], now = new Date()) => {
  const weeks = new Set(logs.map(l => weekStart(new Date(l.date)).getTime()));
  const w = weekStart(now);
  if (!weeks.has(w.getTime())) w.setDate(w.getDate() - 7);
  let n = 0;
  while (weeks.has(w.getTime())) {
    n++;
    w.setDate(w.getDate() - 7);
  }
  return n;
};

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
