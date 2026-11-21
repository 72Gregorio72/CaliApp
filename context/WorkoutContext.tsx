import type { Block } from '@/lib/blocks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

export type Exercise = {
  id: string; // Rimuovi l'opzionale
  name: string;
  sets: number;
  reps: number;
  restSeconds: number;
  durationSeconds?: number;
  description?: string;
  maxWeight?: string; // legacy: peso in testo libero, ora i pesi stanno nello storico (HistoryContext)
  supersetWithNext?: boolean; // eseguito in superserie con l'esercizio successivo
  block?: Block; // sul primo esercizio di un blocco: EMOM o AMRAP (vedi lib/blocks)
};

export type Workout = {
  id: string;
  title: string;
  exercises: Exercise[];
  createdAt: string;
};

type WorkoutContextType = {
  workouts: Workout[];
  addWorkout: (workout: Omit<Workout, 'id' | 'createdAt'>) => Promise<string>;
  updateWorkout: (id: string, workout: Omit<Workout, 'id' | 'createdAt'>) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  exercises: Exercise[]; // created on their own (free workout), not part of any workout
  addExercise: (ex: Exercise) => void;
  isLoading: boolean;
};

const WorkoutContext = createContext<WorkoutContextType | null>(null);

const STORAGE_KEY = '@gym_app_workouts';
export const EXERCISES_KEY = '@gym_app_exercises';

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carica i workout all'avvio
  useEffect(() => {
    loadWorkouts();
  }, []);

  // Salva i workout ogni volta che cambiano
  useEffect(() => {
    if (!isLoading) {
      saveWorkouts(workouts);
    }
  }, [workouts, isLoading]);

  useEffect(() => {
    if (!isLoading) AsyncStorage.setItem(EXERCISES_KEY, JSON.stringify(exercises)).catch(e => console.error('Errore nel salvataggio degli esercizi:', e));
  }, [exercises, isLoading]);
  const addExercise = (ex: Exercise) => setExercises(prev => [...prev, ex]);

  const loadWorkouts = async () => {
    try {
      const ex = await AsyncStorage.getItem(EXERCISES_KEY);
      if (ex) setExercises(JSON.parse(ex));
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        // drop null entries from old saves: one of them made the map below throw, and the empty state then overwrote all workouts
        const parsed = (JSON.parse(stored) as (Workout | null)[]).filter((w): w is Workout => !!w?.id).map(w => ({ ...w, exercises: (w.exercises ?? []).filter(Boolean) }));
        // Migrazione: aggiungi ID agli esercizi che non ce l'hanno
        const migrated = parsed.map(workout => ({
          ...workout,
          exercises: workout.exercises.map((ex, idx) => ({
            ...ex,
            id: ex.id || `migrated_${workout.id}_${idx}_${Date.now()}`,
          })),
        }));
        setWorkouts(migrated);
        // Salva i dati migrati
        await saveWorkouts(migrated);
      }
    } catch (error) {
      console.error('Errore nel caricamento dei workout:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveWorkouts = async (data: Workout[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Errore nel salvataggio dei workout:', error);
    }
  };

  const addWorkout = async (workout: Omit<Workout, 'id' | 'createdAt'>) => {
    const newWorkout: Workout = {
      ...workout,
      // suffix keeps ids unique when several workouts are added in the same tick (AI plan import)
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      // Gli esercizi devono già avere ID
      exercises: workout.exercises,
    };
    setWorkouts(prev => [...prev, newWorkout]);
    return newWorkout.id;
  };

  const deleteWorkout = async (id: string) => {
    setWorkouts(prev => prev.filter(w => w.id !== id));
  };

  const updateWorkout = async (id: string, workout: Omit<Workout, 'id' | 'createdAt'>) => {
    setWorkouts(prev => prev.map(w => 
      w.id === id 
        ? { ...w, ...workout, exercises: workout.exercises }
        : w
    ));
  };

  return (
    <WorkoutContext.Provider value={{ workouts, addWorkout, updateWorkout, deleteWorkout, exercises, addExercise, isLoading }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkouts() {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkouts deve essere usato all\'interno di WorkoutProvider');
  }
  return context;
}
