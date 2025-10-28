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
};

export type Workout = {
  id: string;
  title: string;
  exercises: Exercise[];
  createdAt: string;
};

type WorkoutContextType = {
  workouts: Workout[];
  addWorkout: (workout: Omit<Workout, 'id' | 'createdAt'>) => Promise<void>;
  updateWorkout: (id: string, workout: Omit<Workout, 'id' | 'createdAt'>) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  isLoading: boolean;
};

const WorkoutContext = createContext<WorkoutContextType | null>(null);

const STORAGE_KEY = '@gym_app_workouts';

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
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

  const loadWorkouts = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Workout[];
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
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      // Gli esercizi devono già avere ID
      exercises: workout.exercises,
    };
    setWorkouts(prev => [...prev, newWorkout]);
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
    <WorkoutContext.Provider value={{ workouts, addWorkout, updateWorkout, deleteWorkout, isLoading }}>
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


