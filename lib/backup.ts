import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext } from 'react';
import { unifyIds } from './stats';

const WORKOUTS_KEY = '@gym_app_workouts';
const HISTORY_KEY = '@gym_app_history';
const DRAFT_KEY = '@gym_app_session_draft';
// workouts, plans, history, body weight, active plan (theme and in-progress session are not worth backing up)
const ARRAY_KEYS = [WORKOUTS_KEY, '@gym_app_weekly_plans', HISTORY_KEY, '@gym_app_body_weight'];
const KEYS = [...ARRAY_KEYS, '@gym_app_active_plan'];

/** Remounts the data providers so they re-read storage after a restore. */
export const ReloadDataContext = createContext<() => void>(() => {});

export async function exportBackup() {
  const pairs = await AsyncStorage.multiGet(KEYS);
  return JSON.stringify({ app: 'gymapp', version: 1, data: Object.fromEntries(pairs) });
}

/** Validates the whole backup before writing anything, so a bad paste can't half-overwrite the data. */
export async function importBackup(text: string) {
  let b: any;
  try {
    b = JSON.parse(text.trim());
  } catch {
    throw new Error('Il testo non è un JSON valido.');
  }
  if (b?.app !== 'gymapp' || typeof b.data !== 'object' || !b.data) throw new Error('Non è un backup di GymApp.');
  const set: [string, string][] = [];
  const remove: string[] = [];
  for (const k of KEYS) {
    const v = b.data[k];
    if (v === null || v === undefined) {
      remove.push(k);
      continue;
    }
    if (typeof v !== 'string') throw new Error(`Valore non valido per ${k}.`);
    if (ARRAY_KEYS.includes(k)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(v);
      } catch {
        throw new Error(`Dati corrotti in ${k}.`);
      }
      if (!Array.isArray(parsed)) throw new Error(`Dati corrotti in ${k}.`);
    }
    set.push([k, v]);
  }
  if (set.length) await AsyncStorage.multiSet(set);
  if (remove.length) await AsyncStorage.multiRemove(remove);
}

/** Writes the backup to a .json file and opens the share sheet (Drive, email, WhatsApp…). */
// loaded on use, not at startup: a dev build made before these were added would otherwise crash on launch
const fileSystem = () => require('expo-file-system') as typeof import('expo-file-system');

export async function shareBackupFile() {
  const { File, Paths } = fileSystem();
  const Sharing = require('expo-sharing') as typeof import('expo-sharing');
  const file = new File(Paths.cache, `gymapp-backup-${new Date().toISOString().slice(0, 10)}.json`);
  file.create({ overwrite: true });
  file.write(await exportBackup());
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Salva backup GymApp' });
}

/** Lets the user pick a backup file and restores it. false = picker cancelled. */
export async function importBackupFile() {
  const { File } = fileSystem();
  const DocumentPicker = require('expo-document-picker') as typeof import('expo-document-picker');
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return false;
  await importBackup(await new File(r.assets[0].uri).text());
  return true;
}

/**
 * Gives same-named exercises in different workouts one id, rewriting workouts, history and the open draft,
 * so "Panca piana" has one history wherever it appears. Runs before the providers load; no-op once merged.
 */
export async function unifyExercises() {
  const [[, w], [, h], [, d]] = await AsyncStorage.multiGet([WORKOUTS_KEY, HISTORY_KEY, DRAFT_KEY]);
  if (!w) return;
  const workouts: any[] = (JSON.parse(w) as any[]).map(x => (x ? { ...x, exercises: (x.exercises ?? []).filter(Boolean) } : x));
  const map = unifyIds(workouts.filter(x => x?.id));
  if (!Object.keys(map).length) return;
  const re = (id: string) => map[id] ?? id;
  const reKeys = <T,>(o?: Record<string, T>) => o && Object.fromEntries(Object.entries(o).map(([k, v]) => [re(k), v]));
  const set: [string, string][] = [[WORKOUTS_KEY, JSON.stringify(workouts.map(x => (x?.id ? { ...x, exercises: x.exercises.map((e: any) => ({ ...e, id: re(e.id) })) } : x)))]];
  if (h) set.push([HISTORY_KEY, JSON.stringify((JSON.parse(h) as any[]).map(l => ({ ...l, exercises: (l.exercises ?? []).map((e: any) => ({ ...e, exerciseId: re(e.exerciseId) })) })))]);
  if (d) {
    const draft = JSON.parse(d);
    const swaps = reKeys(draft.swaps) as Record<string, any> | undefined;
    for (const k in swaps) swaps[k] = { ...swaps[k], id: re(swaps[k].id) };
    set.push([DRAFT_KEY, JSON.stringify({ ...draft, counters: reKeys(draft.counters), weights: reKeys(draft.weights), setVals: reKeys(draft.setVals), units: reKeys(draft.units), logged: reKeys(draft.logged), swaps })]);
  }
  await AsyncStorage.multiSet(set);
}
