import type { SessionLog, Unit } from '@/lib/stats';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

/** Unfinished session, so it can be resumed after leaving the screen or killing the app. */
export type SessionDraft = {
  workoutId: string;
  startedAt: number;
  counters: Record<string, { currentSet: number; done: boolean }>;
  weights: Record<string, number>;
  units?: Record<string, Unit>; // missing = kg (drafts saved before units existed)
  logged?: Record<string, true>; // values entered this session: the exercise counts as done even with no set ticked
};

type HistoryContextType = {
  sessions: SessionLog[];
  addSession: (s: SessionLog) => void;
  draft: SessionDraft | null;
  setDraft: (d: SessionDraft | null) => void;
  isLoading: boolean;
};

const HistoryContext = createContext<HistoryContextType | null>(null);

export const HISTORY_KEY = '@gym_app_history';
const DRAFT_KEY = '@gym_app_session_draft';

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [draft, setDraftState] = useState<SessionDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [[, h], [, d]] = await AsyncStorage.multiGet([HISTORY_KEY, DRAFT_KEY]);
        if (h) setSessions(JSON.parse(h));
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

  const addSession = (s: SessionLog) => setSessions(prev => [s, ...prev]);

  const setDraft = (d: SessionDraft | null) => {
    setDraftState(d);
    (d ? AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(d)) : AsyncStorage.removeItem(DRAFT_KEY)).catch(e =>
      console.error('Errore nel salvataggio della sessione in corso:', e),
    );
  };

  return <HistoryContext.Provider value={{ sessions, addSession, draft, setDraft, isLoading }}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) throw new Error("useHistory deve essere usato all'interno di HistoryProvider");
  return context;
}
