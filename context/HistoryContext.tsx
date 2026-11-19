import type { Exercise } from '@/context/WorkoutContext';
import type { SessionLog, Unit } from '@/lib/stats';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

/** Unfinished session, so it can be resumed after leaving the screen or killing the app. */
export type SessionDraft = {
  workoutId: string;
  startedAt: number;
  counters: Record<string, { currentSet: number; done: boolean }>;
  weights: Record<string, number>;
  setVals?: Record<string, number[]>; // value of each done set (drafts saved before per-set values lack it)
  units?: Record<string, Unit>; // missing = kg (drafts saved before units existed)
  logged?: Record<string, true>; // values entered this session: the exercise counts as done even with no set ticked
  swaps?: Record<string, Exercise>; // workout exercise id -> exercise done in its place, this session only
  note?: string;
};

/** Body weight entry, newest first like sessions. */
export type BodyWeight = { date: string; kg: number };

type HistoryContextType = {
  sessions: SessionLog[];
  addSession: (s: SessionLog) => void;
  updateSession: (s: SessionLog) => void;
  removeSession: (id: string) => void;
  draft: SessionDraft | null;
  setDraft: (d: SessionDraft | null) => void;
  bodyWeights: BodyWeight[];
  addBodyWeight: (kg: number) => void;
  removeBodyWeight: (date: string) => void;
  isLoading: boolean;
};

const HistoryContext = createContext<HistoryContextType | null>(null);

export const HISTORY_KEY = '@gym_app_history';
export const DRAFT_KEY = '@gym_app_session_draft';
export const BODY_KEY = '@gym_app_body_weight';

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [bodyWeights, setBodyWeights] = useState<BodyWeight[]>([]);
  const [draft, setDraftState] = useState<SessionDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [[, h], [, d], [, b]] = await AsyncStorage.multiGet([HISTORY_KEY, DRAFT_KEY, BODY_KEY]);
        if (h) setSessions(JSON.parse(h));
        if (b) setBodyWeights(JSON.parse(b));
        if (d) setDraftState(JSON.parse(d));
      } catch (error) {
        console.error('Errore nel caricamento dello storico:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isLoading) AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(sessions)).catch(e => console.error('Errore nel salvataggio dello storico:', e));
  }, [sessions, isLoading]);

  useEffect(() => {
    if (!isLoading) AsyncStorage.setItem(BODY_KEY, JSON.stringify(bodyWeights)).catch(e => console.error('Errore nel salvataggio del peso corporeo:', e));
  }, [bodyWeights, isLoading]);
  const addBodyWeight = (kg: number) => setBodyWeights(prev => [{ date: new Date().toISOString(), kg }, ...prev]);
  const removeBodyWeight = (date: string) => setBodyWeights(prev => prev.filter(b => b.date !== date));

  const addSession = (s: SessionLog) => setSessions(prev => [s, ...prev]);
  const updateSession = (s: SessionLog) => setSessions(prev => prev.map(x => (x.id === s.id ? s : x)));
  const removeSession = (id: string) => setSessions(prev => prev.filter(x => x.id !== id));

  const setDraft = (d: SessionDraft | null) => {
    setDraftState(d);
    (d ? AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(d)) : AsyncStorage.removeItem(DRAFT_KEY)).catch(e =>
      console.error('Errore nel salvataggio della sessione in corso:', e),
    );
  };

  return <HistoryContext.Provider value={{ sessions, addSession, updateSession, removeSession, draft, setDraft, bodyWeights, addBodyWeight, removeBodyWeight, isLoading }}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) throw new Error("useHistory deve essere usato all'interno di HistoryProvider");
  return context;
}
