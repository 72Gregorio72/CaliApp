import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext } from 'react';

// workouts, plans, active plan, history (theme and in-progress session are not worth backing up)
const ARRAY_KEYS = ['@gym_app_workouts', '@gym_app_weekly_plans', '@gym_app_history'];
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
    throw new Error('Il testo negli appunti non è un JSON valido.');
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
