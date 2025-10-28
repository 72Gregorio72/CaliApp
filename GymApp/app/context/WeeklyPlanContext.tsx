import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

export type DayWorkout = {
  day: 'Lunedì' | 'Martedì' | 'Mercoledì' | 'Giovedì' | 'Venerdì' | 'Sabato' | 'Domenica';
  workoutId: string | null; // id dell'allenamento assegnato, null = riposo
};

export type WeeklyPlan = {
  id: string;
  name: string;
  days: DayWorkout[];
  createdAt: string;
};

type WeeklyPlanContextType = {
  plans: WeeklyPlan[];
  addPlan: (plan: Omit<WeeklyPlan, 'id' | 'createdAt'>) => Promise<void>;
  updatePlan: (id: string, plan: Omit<WeeklyPlan, 'id' | 'createdAt'>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  isLoading: boolean;
};

const WeeklyPlanContext = createContext<WeeklyPlanContextType | null>(null);

const STORAGE_KEY = '@gym_app_weekly_plans';
const DAYS: DayWorkout['day'][] = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export const WEEK_DAYS: DayWorkout['day'][] = DAYS;

export function WeeklyPlanProvider({ children }: { children: React.ReactNode }) {
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      savePlans(plans);
    }
  }, [plans, isLoading]);

  const loadPlans = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPlans(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Errore nel caricamento delle schede:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePlans = async (data: WeeklyPlan[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Errore nel salvataggio delle schede:', error);
    }
  };

  const addPlan = async (plan: Omit<WeeklyPlan, 'id' | 'createdAt'>) => {
    const newPlan: WeeklyPlan = {
      ...plan,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setPlans(prev => [...prev, newPlan]);
  };

  const updatePlan = async (id: string, plan: Omit<WeeklyPlan, 'id' | 'createdAt'>) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...plan } : p));
  };

  const deletePlan = async (id: string) => {
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  return (
    <WeeklyPlanContext.Provider value={{ plans, addPlan, updatePlan, deletePlan, isLoading }}>
      {children}
    </WeeklyPlanContext.Provider>
  );
}

export function useWeeklyPlans() {
  const context = useContext(WeeklyPlanContext);
  if (!context) {
    throw new Error('useWeeklyPlans deve essere usato all\'interno di WeeklyPlanProvider');
  }
  return context;
}
