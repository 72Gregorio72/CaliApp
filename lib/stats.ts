// Pure helpers over the session history (no React Native imports: lib/stats.check.mjs runs them in plain node).

/** What the logged value measures: kg lifted, max reps, or hold seconds (calisthenics). */
export type Unit = 'kg' | 'reps' | 'sec';
export const UNITS: { unit: Unit; label: string }[] = [{ unit: 'kg', label: 'Kg' }, { unit: 'reps', label: 'Rep' }, { unit: 'sec', label: 'Tenuta' }];
// weightKg keeps its name for stored-data compatibility: it holds the value in `unit` (missing unit = kg)
// sets: value of each done set, only stored when they differ; weightKg is then the top set
export type LoggedExercise = { exerciseId: string; name: string; setsDone: number; reps: number; weightKg?: number; unit?: Unit; sets?: number[] };
export const unitOf = (e: { unit?: Unit }) => e.unit ?? 'kg';
const SUFFIX: Record<Unit, string> = { kg: 'kg', reps: 'rep', sec: 's' };
export const fmtVal = (v: number, unit: Unit = 'kg') => `${String(v).replace('.', ',')} ${SUFFIX[unit]}`;
// planId: weekly plan the session was done under; missing on sessions saved before per-plan history
/** Gallery video (assetId set, uri = device path) or Google Photos share link (https uri, no assetId). */
export type SessionVideo = { uri: string; assetId?: string };
export type SessionLog = { id: string; workoutId: string; planId?: string; title: string; date: string; durationSec: number; exercises: LoggedExercise[]; note?: string; videos?: SessionVideo[] };

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

const exVolume = (e: LoggedExercise) =>
  unitOf(e) !== 'kg' ? 0 : e.sets ? e.sets.reduce((n, kg) => n + kg * e.reps, 0) : e.setsDone * e.reps * (e.weightKg ?? 0);
export const volume = (l: SessionLog) => l.exercises.reduce((n, e) => n + exVolume(e), 0);

/** Estimated one-rep max (Epley). */
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : Math.round(kg * (1 + reps / 30) * 10) / 10);

/** Kg lifted per week for the last `weeks` weeks (oldest first, empty weeks = 0); date is the week's Monday. */
export const weeklyVolume = (logs: SessionLog[], weeks = 12, now = new Date()) => {
  const out: { date: string; kg: number }[] = [];
  const w = weekStart(now);
  w.setDate(w.getDate() - 7 * (weeks - 1));
  for (let i = 0; i < weeks; i++, w.setDate(w.getDate() + 7)) out.push({ date: w.toISOString(), kg: 0 });
  for (const l of logs) {
    const p = out.find(o => o.date === weekStart(new Date(l.date)).toISOString());
    if (p) p.kg += Math.round(volume(l));
  }
  return out;
};

/** "80, 80, 85 kg" when sets differ, else "80 kg". */
export const fmtSets = (e: LoggedExercise) => (e.sets ? `${e.sets.map(v => String(v).replace('.', ',')).join(', ')} ${SUFFIX[unitOf(e)]}` : e.weightKg ? fmtVal(e.weightKg, unitOf(e)) : '');

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

const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
/**
 * Same-named exercises in different workouts get one id, so they share history.
 * Returns old id -> kept id (the first one met). Never maps two exercises of one workout onto the same id.
 */
export const unifyIds = (workouts: { exercises: { id: string; name: string }[] }[]) => {
  const canon = new Map<string, string>();
  const map: Record<string, string> = {};
  for (const w of workouts) {
    const used = new Set(w.exercises.map(e => e.id));
    for (const e of w.exercises) {
      const key = normName(e.name ?? '');
      if (!key) continue;
      const c = canon.get(key);
      if (c === undefined) canon.set(key, e.id);
      else if (c !== e.id && !used.has(c)) {
        map[e.id] = c;
        used.add(c);
      }
    }
  }
  return map;
};
