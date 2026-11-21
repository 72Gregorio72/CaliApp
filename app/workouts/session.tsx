import { UI, themed } from '@/constants/theme';
import { useWorkouts, type Exercise } from '@/context/WorkoutContext';
import { ExercisePicker } from '@/components/ExercisePicker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import WorkoutPip from '@/modules/workout-pip';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, Vibration, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Field, onColor, onInk } from '@/components/ui/kit';
import { VideoRecorder } from '@/components/session/VideoRecorder';
import { WeightModal } from '@/components/session/WeightModal';
import { RestAlarm, TimerCard, clock, type TimerMode } from '@/components/session/TimerCard';
import { BLOCK_ICON, BlockCard } from '@/components/session/BlockCard';
import { ExerciseEditSheet } from '@/components/session/ExerciseEditSheet';
import { blockLabel, groupAt, groupsOf, normalizeBlocks, type Block } from '@/lib/blocks';
import { useCountdown, useStopwatch } from '@/hooks/use-timers';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { FREE_WORKOUT_ID, useHistory, type SessionDraft } from '@/context/HistoryContext';
import { useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { cancelRestEnd, scheduleRestEnd, setupRestNotifications } from '@/lib/notifications';
import { bestKg, fmtSets, fmtVal, lastFor, parseKg, unitOf, volume, type SessionLog, type Unit } from '@/lib/stats';

type Counters = SessionDraft['counters'];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
// set chips are narrow: number only, unit is shown on the weight button
const shortVal = (v: number) => String(v).replace('.', ',');

export default function SessionScreen() {
  const params = useLocalSearchParams<{ workoutId: string }>();
  const { workouts, addWorkout, updateWorkout } = useWorkouts();
  const { sessions, addSession, draft, setDraft, isLoading: historyLoading } = useHistory();
  const { primaryColor } = useCustomTheme();
  const { plans, activePlanId } = useWeeklyPlans();
  const cardBg = UI.card;
  const onCard = UI.text;
  const onCardMuted = UI.muted;
  const insets = useSafeAreaInsets();
  const isFree = params.workoutId === FREE_WORKOUT_ID;
  // free workout: starts empty, exercises are added during the session
  const [freeExercises, setFreeExercises] = React.useState<Exercise[]>([]);
  const freeWorkout = React.useMemo(() => ({ id: FREE_WORKOUT_ID, title: 'Allenamento libero', exercises: freeExercises, createdAt: '' }), [freeExercises]);
  const workout = isFree ? freeWorkout : workouts.find(w => w.id === params.workoutId);
  const { height } = useWindowDimensions();
  // shortcut: PiP detected by window size (a portrait phone is never < 300dp tall); upgrade to a native PiP event if it misfires
  const isPip = height < 300;
  const [tab, setTab] = React.useState<'list' | 'timer'>('list');
  const [startedAt, setStartedAt] = React.useState(Date.now);
  const [now, setNow] = React.useState(Date.now);
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [counters, setCounters] = React.useState<Counters>({});
  const [currentExerciseId, setCurrentExerciseId] = React.useState<string | null>(null);
  const [weights, setWeights] = React.useState<Record<string, number>>({});
  const [setVals, setSetVals] = React.useState<Record<string, number[]>>({});
  const [units, setUnits] = React.useState<Record<string, Unit>>({});
  const [logged, setLogged] = React.useState<Record<string, true>>({});
  const [mode, setMode] = React.useState<TimerMode>('countdown');
  const [isWeightModalVisible, setIsWeightModalVisible] = React.useState(false);
  const [isVideoModalVisible, setIsVideoModalVisible] = React.useState(false);
  const [isAlarmActive, setIsAlarmActive] = React.useState(false);
  const [restBase, setRestBase] = React.useState<number>(workout?.exercises[0]?.restSeconds ?? 60);
  const [ready, setReady] = React.useState(false);
  // replacements for this session only: the saved workout is never touched
  const [swaps, setSwaps] = React.useState<Record<string, Exercise>>({});
  const [swapping, setSwapping] = React.useState<string | null>(null); // workout exercise id being replaced
  const [adding, setAdding] = React.useState(false); // free workout: picker open to add an exercise
  const [note, setNote] = React.useState('');
  // changes to exercises made during the session; the end of the workout asks whether to keep them in the saved workout
  const [edits, setEdits] = React.useState<Record<string, Partial<Exercise>>>({});
  const [editing, setEditing] = React.useState<string | null>(null); // id of the exercise in the edit sheet
  const [pendingTimers, setPendingTimers] = React.useState<SessionDraft['timers'] | null>(null); // to restore once the screen has settled
  const sessionExercises = React.useMemo(
    () => normalizeBlocks((workout?.exercises ?? []).map(e => swaps[e.id] ?? e).map(e => (edits[e.id] ? { ...e, ...edits[e.id] } : e))),
    [workout, swaps, edits],
  );

  // resume the saved draft for this workout, otherwise start fresh with last session's weights prefilled
  React.useEffect(() => {
    if (!workout || historyLoading) return;
    if (draft?.workoutId === workout.id) {
      setCounters(draft.counters);
      setWeights(draft.weights);
      setSetVals(draft.setVals ?? {});
      setUnits(draft.units ?? {});
      setLogged(draft.logged ?? {});
      setSwaps(draft.swaps ?? {});
      setNote(draft.note ?? '');
      setFreeExercises(draft.freeExercises ?? []);
      setEdits(draft.edits ?? {});
      if (draft.currentId) setCurrentExerciseId(draft.currentId);
      if (draft.timers) setPendingTimers(draft.timers);
      setStartedAt(draft.startedAt);
    } else {
      const init: Counters = {};
      const w: Record<string, number> = {};
      const u: Record<string, Unit> = {};
      workout.exercises.forEach(ex => {
        init[ex.id] = { currentSet: 0, done: false };
        const last = lastFor(sessions, ex.id);
        const v = last?.weightKg ?? parseKg(ex.maxWeight);
        if (v) w[ex.id] = v;
        if (last) u[ex.id] = unitOf(last); // keep the unit chosen last time (kg / rep / tenuta)
      });
      setCounters(init);
      setWeights(w);
      setUnits(u);
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open: later draft/history writes come from this screen
  }, [workout?.id, historyLoading]);

  // persist progress as soon as a set is done, so leaving or killing the app doesn't lose it
  const draftRef = React.useRef<SessionDraft | null>(null); // last saved draft: leaving the screen adds the timers to it
  const finishedRef = React.useRef(false); // saved or discarded: leaving must not write the draft back
  React.useEffect(() => {
    if (!ready || !workout || (!Object.values(counters).some(c => c.currentSet > 0) && !Object.keys(logged).length && !Object.keys(swaps).length && !note.trim() && !freeExercises.length && !Object.keys(edits).length)) return;
    const d: SessionDraft = { workoutId: workout.id, startedAt, counters, weights, setVals, units, logged, swaps, note, edits, ...(isFree ? { freeExercises } : {}) };
    draftRef.current = d;
    setDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counters, weights, setVals, units, logged, swaps, note, freeExercises, edits, ready]);

  // last session's value and unit, for an exercise that enters the session midway
  const prefill = (ex: Exercise) => {
    if (weights[ex.id]) return;
    const last = lastFor(sessions, ex.id);
    const v = last?.weightKg ?? parseKg(ex.maxWeight);
    if (v) setWeights(prev => ({ ...prev, [ex.id]: v }));
    if (last) setUnits(prev => ({ ...prev, [ex.id]: unitOf(last) }));
  };

  const addFreeExercise = (ex: Exercise) => {
    // already in this session: a copy with its own id, since sets and values are tracked by id
    if (sessionExercises.some(e => e.id === ex.id)) ex = { ...ex, id: `${ex.id}_${Date.now()}` };
    setFreeExercises(prev => [...prev, { ...ex, supersetWithNext: false, block: undefined }]);
    prefill(ex);
    setCurrentExerciseId(ex.id);
    setTab('timer');
  };

  // picking the original back undoes the swap; the replacement keeps the slot's superset link and block
  const swapExercise = (origId: string, ex: Exercise) => {
    const orig = workout?.exercises.find(e => e.id === origId);
    if (!orig) return;
    const shownId = (swaps[origId] ?? orig).id;
    if (ex.id === shownId) return;
    // already in this session: a copy with its own id, since sets and values are tracked by id
    if (ex.id !== origId && sessionExercises.some(e => e.id === ex.id)) ex = { ...ex, id: `${ex.id}_${Date.now()}` };
    setSwaps(prev => {
      const next = { ...prev };
      if (ex.id === origId) delete next[origId];
      else next[origId] = { ...ex, supersetWithNext: orig.supersetWithNext, block: orig.block };
      return next;
    });
    prefill(ex);
    if (currentExerciseId === shownId) setCurrentExerciseId(ex.id);
  };

  // a set records the value shown when it is ticked; unticking drops it
  const setSet = (exId: string, maxSets: number, n: number) => {
    setCounters(prev => ({ ...prev, [exId]: { currentSet: n, done: n >= maxSets } }));
    setSetVals(prev => {
      const v = (prev[exId] ?? []).slice(0, n);
      while (v.length < n) v.push(weights[exId] ?? 0);
      return { ...prev, [exId]: v };
    });
  };
  const setsOf = (exId: string) => counters[exId]?.currentSet ?? 0;
  const incSet = (exId: string, maxSets: number) => setSet(exId, maxSets, Math.min(setsOf(exId) + 1, maxSets));
  const decSet = (exId: string, maxSets: number) => setSet(exId, maxSets, Math.max(setsOf(exId) - 1, 0));

  // Ref per il callback dell'allarme — evita stale closures
  const isAlarmActiveRef = React.useRef(false);
  const restBaseRef = React.useRef(restBase);
  restBaseRef.current = restBase;

  const triggerAlarm = React.useCallback(() => {
    if (isAlarmActiveRef.current) return; // evita doppio trigger
    isAlarmActiveRef.current = true;
    setIsAlarmActive(true);
    Vibration.vibrate([0, 600, 400, 600, 400, 600, 400, 600, 400, 600], true);
  }, []);

  const restTimer = useCountdown(restBase, triggerAlarm);
  const stopwatch = useStopwatch();

  const stopAlarm = React.useCallback(() => {
    isAlarmActiveRef.current = false;
    Vibration.cancel();
    setIsAlarmActive(false);
    restTimer.reset(restBaseRef.current);
  }, [restTimer]);

  const saveExerciseWeight = (exerciseId: string, v: number, unit: Unit) => {
    // sets ticked with no value yet, or in another unit, take the new value
    const unitChanged = unit !== (units[exerciseId] ?? 'kg');
    setSetVals(prev => ({ ...prev, [exerciseId]: (prev[exerciseId] ?? []).map(x => (unitChanged || !x ? v : x)) }));
    setWeights(prev => ({ ...prev, [exerciseId]: v }));
    setUnits(prev => ({ ...prev, [exerciseId]: unit }));
    setLogged(prev => ({ ...prev, [exerciseId]: true }));
  };

  const currentExercise = React.useMemo(() => {
    if (sessionExercises.length === 0) {
      return { id: '', name: '', sets: 0, reps: 0, restSeconds: 0, description: '', durationSeconds: 0, maxWeight: '' };
    }
    const selected = currentExerciseId ? sessionExercises.find(ex => ex.id === currentExerciseId) : undefined;
    if (selected) return selected;
    const firstIncomplete = sessionExercises.find(ex => (counters[ex.id]?.currentSet ?? 0) < ex.sets);
    return firstIncomplete ?? sessionExercises[sessionExercises.length - 1];
  }, [sessionExercises, counters, currentExerciseId]);

  // Aggiorna automaticamente il timer base quando cambia esercizio corrente
  React.useEffect(() => {
    if (!currentExercise || !currentExercise.id) return;
    setRestBase(currentExercise.restSeconds);
    restTimer.reset(currentExercise.restSeconds);
  }, [currentExercise?.id, currentExercise?.restSeconds]);

  // blocks (superset / EMOM / AMRAP) and the one holding the current exercise
  const groups = React.useMemo(() => groupsOf(sessionExercises), [sessionExercises]);
  const curGroup = groupAt(groups, sessionExercises.findIndex(ex => ex.id === currentExercise.id));
  const timed = curGroup && (curGroup.type === 'emom' || curGroup.type === 'amrap') ? curGroup : undefined;
  const timedMembers = timed ? sessionExercises.slice(timed.start, timed.end) : [];
  const blockClock = useStopwatch(); // elapsed time of the running EMOM/AMRAP
  const blockSec = blockClock.seconds;
  const minuteRef = React.useRef(0); // EMOM minutes already handled
  const timedKey = timed ? sessionExercises[timed.start].id : '';
  // another block: start its clock from zero
  React.useEffect(() => {
    blockClock.reset();
    minuteRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedKey]);
  React.useEffect(() => {
    if (!timed || !timedMembers.length) return;
    const total = timed.minutes * 60;
    if (timed.type === 'amrap') {
      if (blockSec >= total && blockClock.running) {
        blockClock.pause();
        Vibration.vibrate([0, 600, 300, 600, 300, 600]);
      }
      return;
    }
    // EMOM: every finished minute ticks a set of the exercise it belonged to, then the next one is up.
    // a loop, not +1: with the screen locked the clock catches up several minutes at once
    const minute = Math.min(Math.floor(blockSec / 60), timed.minutes);
    if (minute < minuteRef.current) minuteRef.current = minute; // reset
    if (minute === minuteRef.current) return;
    const ticks: Record<string, number> = {};
    for (let k = minuteRef.current; k < minute; k++) {
      const ex = timedMembers[k % timedMembers.length];
      ticks[ex.id] = (ticks[ex.id] ?? 0) + 1;
    }
    minuteRef.current = minute;
    timedMembers.forEach(ex => ticks[ex.id] && setSet(ex.id, ex.sets, Math.min(setsOf(ex.id) + ticks[ex.id], ex.sets)));
    if (minute >= timed.minutes) {
      blockClock.pause();
      Vibration.vibrate([0, 600, 300, 600, 300, 600]);
    } else {
      Vibration.vibrate(400);
      setCurrentExerciseId(timedMembers[minute % timedMembers.length].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on each clock second
  }, [blockSec]);

  // resumed session: timers continue from where they were, running ones caught up with the time away.
  // declared after the effects that reset timers on exercise/block change, so in the same commit this one wins
  React.useEffect(() => {
    if (!pendingTimers) return;
    const t = pendingTimers;
    const away = Date.now() - t.at;
    setMode(t.mode);
    restTimer.restore(t.rest[0] - (t.rest[1] ? away : 0), t.rest[1]);
    stopwatch.restore(t.sw[0] + (t.sw[1] ? away : 0), t.sw[1]);
    minuteRef.current = Math.floor(t.block[0] / 60000); // EMOM minutes before leaving were already ticked
    blockClock.restore(t.block[0] + (t.block[1] ? away : 0), t.block[1]);
    setPendingTimers(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTimers]);

  // latest timers and exercise, for when the screen is left (back to Home, the workout stays resumable)
  const snapRef = React.useRef<SessionDraft['timers']>(undefined);
  const curIdRef = React.useRef('');
  React.useEffect(() => {
    snapRef.current = { at: Date.now(), mode, rest: [restTimer.remainingMs, restTimer.running], sw: [stopwatch.elapsedMs, stopwatch.running], block: [blockClock.elapsedMs, blockClock.running] };
    curIdRef.current = currentExercise.id;
  });
  React.useEffect(
    () => () => {
      if (!finishedRef.current && draftRef.current) setDraft({ ...draftRef.current, currentId: curIdRef.current, timers: snapRef.current });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
    [],
  );

  // Android: home durante l'allenamento -> widget PiP; notifica fissa col timer che sopravvive alla chiusura dell'app
  React.useEffect(() => {
    setupRestNotifications(); // also asks the notification permission the PiP timer needs
    WorkoutPip?.setPipEnabled(true);
    return () => {
      WorkoutPip?.setPipEnabled(false);
      WorkoutPip?.hideTimer();
      // leaving mid-rest with the workout resumable: the alarm must still ring on Home
      if (finishedRef.current || !draftRef.current || !snapRef.current?.rest[1]) cancelRestEnd();
    };
  }, []);

  // rest alarm as a scheduled notification, so it rings with the screen locked too
  const restLeftRef = React.useRef(0);
  restLeftRef.current = restTimer.seconds + restTimer.millis / 1000;
  const scheduleRest = () => scheduleRestEnd(restLeftRef.current, currentExercise.name);
  React.useEffect(() => {
    if (restTimer.running) scheduleRest();
    else cancelRestEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on start/stop; +15 s reschedules by hand
  }, [restTimer.running]);

  const activeRunning = mode === 'countdown' ? restTimer.running : stopwatch.running;
  const activeMsRef = React.useRef(0);
  activeMsRef.current = mode === 'countdown'
    ? restTimer.seconds * 1000 + restTimer.millis
    : stopwatch.seconds * 1000 + stopwatch.millis;
  React.useEffect(() => {
    if (!workout) return;
    const countdown = mode === 'countdown';
    const now = Date.now();
    WorkoutPip?.showTimer(
      workout.title,
      `${countdown ? 'Recupero' : 'Cronometro'}${activeRunning ? '' : ' in pausa'} · ${currentExercise.name}`,
      countdown ? now + activeMsRef.current : now - activeMsRef.current,
      activeRunning,
      countdown,
    );
  }, [mode, activeRunning, currentExercise.name, workout?.title]);

  const formatTime = (total: number, millis?: number) => {
    const m = Math.floor(total / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(total % 60)
      .toString()
      .padStart(2, '0');
    if (typeof millis === 'number') {
      const ms = Math.floor(millis / 10)
        .toString()
        .padStart(2, '0');
      return `${m}:${s}.${ms}`; // .00 - .99
    }
    return `${m}:${s}`;
  };

  if (!workout) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="default">Allenamento non trovato.</ThemedText>
      </ThemedView>
    );
  }

  const hasInvalidExercises = workout.exercises.some(ex => !ex.id);

  if (hasInvalidExercises) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Errore</ThemedText>
        <ThemedText type="default" style={{ marginTop: 16 }}>
          Questo allenamento contiene dati non validi. Riavvia l&apos;app per migrare i dati.
        </ThemedText>
      </ThemedView>
    );
  }

  if (isPip) {
    return (
      <ThemedView style={styles.pip}>
        <Stack.Screen options={{ headerShown: false }} />
        <ThemedText type="defaultSemiBold" numberOfLines={1}>{currentExercise.name}</ThemedText>
        <ThemedText style={[styles.pipDigits, { color: isAlarmActive ? UI.danger : UI.text }]} type="defaultSemiBold">
          {mode === 'countdown' ? formatTime(restTimer.seconds) : formatTime(stopwatch.seconds)}
        </ThemedText>
        <ThemedText type="default">
          {(counters[currentExercise.id]?.currentSet ?? 0)}/{currentExercise.sets} serie
        </ThemedText>
      </ThemedView>
    );
  }

  const exercises = sessionExercises;
  const doneOf = (ex: (typeof exercises)[number]) => Math.min(counters[ex.id]?.currentSet ?? 0, ex.sets);
  const doneExercises = exercises.filter(ex => doneOf(ex) >= ex.sets).length;
  const totalSets = exercises.reduce((n, ex) => n + ex.sets, 0);
  const doneSets = exercises.reduce((n, ex) => n + doneOf(ex), 0);
  const currentIndex = exercises.findIndex(ex => ex.id === currentExercise.id);
  // an EMOM/AMRAP is done as a whole: "next" is the first exercise after it
  const nextExercise = exercises[timed ? timed.end : currentIndex + 1];
  const lastOf = (exId: string) => lastFor(sessions, exId);
  const lastText = (exId: string) => {
    const l = lastOf(exId);
    return l ? `Ultima volta (${fmtDate(l.date)}): ${l.setsDone}×${l.reps}${l.weightKg ? ` · ${fmtSets(l)}` : ''}` : null;
  };
  const unitFor = (exId: string) => units[exId] ?? 'kg';
  const valueText = (exId: string) => (weights[exId] ? fmtVal(weights[exId], unitFor(exId)) : null);
  // AMRAP: a round is one set of every exercise of the block, with no upper limit
  const rounds = timed?.type === 'amrap' ? Math.min(...timedMembers.map(ex => setsOf(ex.id))) : 0;
  const changeRound = (by: 1 | -1) => timedMembers.forEach(ex => setSet(ex.id, ex.sets, Math.max(0, rounds + by)));
  const groupMembers = curGroup?.type ? exercises.slice(curGroup.start, curGroup.end) : [];
  // superset/circuit: a round is one set of each exercise, the counter goes by rounds
  const ssMembers = curGroup?.type === 'superset' ? groupMembers : [];
  const ssRounds = ssMembers.length ? Math.max(...ssMembers.map(doneOf)) : 0;
  const ssTotal = ssMembers.length ? Math.max(...ssMembers.map(ex => ex.sets)) : 0;
  const changeSsRound = (by: 1 | -1) => {
    const r = Math.max(0, Math.min(ssRounds + by, ssTotal));
    ssMembers.forEach(ex => setSet(ex.id, ex.sets, Math.min(r, ex.sets)));
    if (by > 0 && r < ssTotal) setCurrentExerciseId(ssMembers[0].id); // next round starts from A
  };
  const groupCaption = !curGroup?.type
    ? undefined
    : curGroup.type === 'emom'
        ? `Minuto ${Math.min(Math.floor(blockSec / 60) + 1, curGroup.minutes)} di ${curGroup.minutes}`
        : undefined; // superset/AMRAP: the rounds counter takes its place

  const plusSet = () => {
    if (!currentExercise.id) return;
    // free workout: no planned set count, past the last set it adds one
    if (isFree && setsOf(currentExercise.id) >= currentExercise.sets) {
      const sets = currentExercise.sets + 1;
      setFreeExercises(prev => prev.map(e => (e.id === currentExercise.id ? { ...e, sets } : e)));
      setSet(currentExercise.id, sets, sets);
      return;
    }
    incSet(currentExercise.id, currentExercise.sets);
  };

  // edits change only this session; for a free workout they go straight into its exercises
  const changeExercise = (id: string, patch: Partial<Exercise>) =>
    isFree ? setFreeExercises(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e))) : setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const editIndex = editing ? exercises.findIndex(e => e.id === editing) : -1;
  const editGroup = editIndex >= 0 ? groupAt(groups, editIndex) : undefined;
  const saveEdit = (patch: Partial<Exercise>, block: Block | undefined) => {
    if (!editing || !editGroup) return;
    changeExercise(editing, patch);
    changeExercise(exercises[editGroup.start].id, { block }); // the mode belongs to the block's first exercise
  };
  // only exercises of the saved workout: a swapped-in one is session-only by design
  const editedIds = isFree ? [] : Object.keys(edits).filter(id => workout.exercises.some(e => e.id === id));

  const finish = () => {
    finishedRef.current = true;
    const done = exercises.filter(ex => doneOf(ex) > 0 || logged[ex.id]);
    const rawOf = (ex: (typeof exercises)[number]) => counters[ex.id]?.currentSet ?? 0; // = doneOf except AMRAP rounds past the target
    if (done.length === 0) {
      setDraft(null);
      router.back();
      return;
    }
    // nothing done: nothing is saved, edits included
    const hasWorkout = (p?: (typeof plans)[number]) => p?.days?.some(d => d.workoutId === workout.id);
    // the active plan wins; otherwise any plan that schedules this workout
    const plan = [plans.find(p => p.id === activePlanId), ...plans].find(hasWorkout);
    const log: SessionLog = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      workoutId: workout.id,
      ...(plan ? { planId: plan.id } : {}),
      title: workout.title,
      date: new Date(startedAt).toISOString(),
      ...(note.trim() ? { note: note.trim() } : {}),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      exercises: done.map(ex => {
        const vals = (setVals[ex.id] ?? []).slice(0, rawOf(ex)).filter(v => v > 0);
        const varied = new Set(vals).size > 1;
        const top = vals.length ? Math.max(...vals) : weights[ex.id]; // top set; no ticked set = the value entered
        return {
          exerciseId: ex.id,
          name: ex.name,
          setsDone: Math.max(rawOf(ex), 1),
          reps: ex.reps,
          ...(top ? { weightKg: top, ...(unitFor(ex.id) !== 'kg' ? { unit: unitFor(ex.id) } : {}) } : {}),
          ...(varied ? { sets: vals } : {}),
        };
      }),
    };
    // a record needs something to beat: the best logged value in the same unit, or the old free-text weight
    const records = log.exercises.filter(e => {
      const prev = bestKg(sessions, e.exerciseId, unitOf(e)) ?? (unitOf(e) === 'kg' ? parseKg(exercises.find(x => x.id === e.exerciseId)?.maxWeight) : undefined);
      return e.weightKg && prev !== undefined && e.weightKg > prev;
    });
    addSession(log);
    setDraft(null);
    const kg = Math.round(volume(log));
    // exercises keep their ids, so the new workout shares their history
    const saveAsWorkout = () =>
      addWorkout({ title: `Allenamento libero ${fmtDate(log.date)}`, exercises: done.map(ex => ({ ...ex, sets: Math.max(doneOf(ex), 1) })) });
    const saveEdits = () =>
      updateWorkout(workout.id, { title: workout.title, exercises: normalizeBlocks(workout.exercises.map(e => (edits[e.id] ? { ...e, ...edits[e.id] } : e))) });
    Alert.alert(
      records.length ? 'Nuovo record! 🎉' : 'Allenamento salvato 💪',
      [
        `Durata ${clock(log.durationSec)} · ${doneSets}/${totalSets} serie${kg ? ` · ${kg.toLocaleString('it-IT')} kg sollevati` : ''}`,
        ...records.map(r => `🏆 ${r.name}: ${fmtVal(r.weightKg!, unitOf(r))}`),
        ...(isFree ? ['', 'Vuoi salvarlo anche tra i tuoi allenamenti per rifarlo?'] : []),
        ...(editedIds.length ? ['', `Hai modificato ${editedIds.length === 1 ? '1 esercizio' : `${editedIds.length} esercizi`}: vuoi salvare le modifiche in "${workout.title}" o tenerlo com'era?`] : []),
      ].join('\n'),
      isFree
        ? [{ text: 'No', style: 'cancel' }, { text: 'Salva allenamento', onPress: saveAsWorkout }]
        : editedIds.length
          ? [{ text: "Tieni com'era", style: 'cancel' }, { text: 'Salva modifiche', onPress: saveEdits }]
          : undefined,
    );
    router.back();
  };

  // back to Home; progress stays in the draft and Home offers "Riprendi" (or discard)
  const exit = () => router.dismissTo('/');

  const saveAndClose = () => {
    if (doneSets === 0 && !Object.keys(logged).length) {
      Alert.alert('Niente da salvare', 'Completa almeno una serie o registra un valore.');
      return;
    }
    Alert.alert('Salvare e terminare?', `Hai completato ${doneSets} di ${totalSets} serie. L'allenamento finisce nello storico.`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Salva e termina', onPress: finish },
    ]);
  };

  const countdown = mode === 'countdown'; // timer and stopwatch share the same ink card
  const hold = currentExercise.durationSeconds ?? 0; // target hold of an isometric exercise, seconds
  const running = countdown ? restTimer.running : stopwatch.running;
  const shownSeconds = countdown ? restTimer.seconds : stopwatch.seconds;
  const progress = countdown
    ? Math.min(1, (restTimer.seconds * 1000 + restTimer.millis) / Math.max(1, restBase * 1000))
    : hold
      ? Math.min(1, (stopwatch.seconds * 1000 + stopwatch.millis) / (hold * 1000))
      : ((stopwatch.seconds % 60) * 1000 + stopwatch.millis) / 60000;
  const plus15 = () => {
    restTimer.setSeconds(restTimer.seconds + 15);
    if (restTimer.running) scheduleRestEnd(restLeftRef.current + 15, currentExercise.name);
  };
  // never below 1 s: at 0 a running timer would ring right away
  const minus15 = () => {
    const left = Math.max(1, restTimer.seconds - 15);
    restTimer.setSeconds(left);
    if (restTimer.running) scheduleRestEnd(left, currentExercise.name);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: workout.title,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={exit} hitSlop={10} accessibilityLabel="Torna alla home, l'allenamento resta in sospeso">
              <Ionicons name="close" size={24} color={UI.text} />
            </Pressable>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <View style={[styles.elapsedPill, { backgroundColor: cardBg }]} accessibilityLabel="Durata allenamento">
                <View style={styles.elapsedDot} />
                <Text style={[styles.elapsedText, { color: onCard }]}>{clock(Math.floor((now - startedAt) / 1000))}</Text>
              </View>
              <Pressable onPress={saveAndClose} hitSlop={10} style={[styles.saveBtn, { backgroundColor: UI.ink }]} accessibilityRole="button" accessibilityLabel="Salva e termina allenamento">
                <Ionicons name="checkmark" size={18} color={onInk(primaryColor)} />
              </Pressable>
            </View>
          ),
        }}
      />

      <View style={styles.tabs}>
        {([['list', 'Esercizi', 'list'], ['timer', 'Timer', 'timer-outline']] as const).map(([key, label, icon]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && { backgroundColor: cardBg }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <Ionicons name={icon} size={16} color={tab === key ? onCard : UI.muted} />
            <Text style={[styles.tabText, tab === key && { color: onCard }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'list' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.rowBetween}>
            <Text style={styles.progressTitle}>{doneExercises} di {exercises.length} esercizi completati</Text>
            <Text style={styles.small}>{doneSets} / {totalSets} serie</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }]} />
          </View>

          {exercises.map((item, i) => {
            const g = groupAt(groups, i);
            const c = doneOf(item);
            const done = c >= item.sets;
            const active = item.id === currentExercise.id && !done;
            const meta = [
              `${item.sets} × ${item.reps > 0 ? item.reps : 'max'}`,
              valueText(item.id),
              swaps[workout.exercises[i].id] ? `al posto di ${workout.exercises[i].name}` : null,
              item.durationSeconds ? `tenuta ${item.durationSeconds}s` : null,
              active ? `rec. ${clock(item.restSeconds)}` : null,
            ].filter(Boolean).join(' · ');
            return (
              <React.Fragment key={item.id}>
              {g?.type && g.start === i ? (
                <View style={styles.blockHead}>
                  <Ionicons name={BLOCK_ICON[g.type]} size={15} color={UI.text} />
                  <Text style={styles.blockHeadText}>{blockLabel(g).toUpperCase()}</Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => {
                  setCurrentExerciseId(item.id);
                  setTab('timer');
                }}
                style={[styles.exCard, { backgroundColor: cardBg }, active && styles.exCardActive, g?.type && { borderLeftWidth: 4, borderLeftColor: primaryColor }]}
              >
                <View style={styles.exRow}>
                  <View
                    style={[
                      styles.exCircle,
                      { borderColor: onCardMuted },
                      done ? { backgroundColor: UI.ink, borderColor: UI.ink } : active ? { backgroundColor: primaryColor, borderColor: primaryColor } : null,
                    ]}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={18} color={onInk(primaryColor)} />
                    ) : (
                      <Text style={[styles.exCircleText, { color: active ? onColor(primaryColor) : onCard }]}>{i + 1}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exName, { color: done ? onCardMuted : onCard }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.small, { color: onCardMuted }]} numberOfLines={1}>{meta}</Text>
                  </View>
                  <Pressable onPress={() => setEditing(item.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Modifica ${item.name}`}>
                    <Ionicons name="create-outline" size={20} color={onCardMuted} />
                  </Pressable>
                  <Pressable onPress={() => setSwapping(workout.exercises[i].id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Sostituisci ${item.name}`}>
                    <Ionicons name="swap-horizontal" size={20} color={onCardMuted} />
                  </Pressable>
                  {done ? <Text style={[styles.doneText, { color: onCardMuted }]}>Fatto</Text> : null}
                  {active ? (
                    <View style={styles.liveBadge}>
                      <Text style={[styles.liveBadgeText, { color: onInk(primaryColor) }]}>IN CORSO</Text>
                    </View>
                  ) : null}
                </View>
                {active && lastText(item.id) ? <Text style={[styles.small, { color: onCardMuted }]}>{lastText(item.id)}</Text> : null}
                {active && item.description ? <Text style={[styles.small, { color: onCardMuted }]}>{item.description}</Text> : null}
                {active ? (
                  <View style={styles.setChips}>
                    {Array.from({ length: item.sets }, (_, s) => (
                      <Pressable
                        key={s}
                        // tap a done set to undo it, any other set to complete up to it
                        onPress={() => setSet(item.id, item.sets, s < c ? s : s + 1)}
                        style={[styles.setChip, s < c ? styles.setChipDone : s === c ? styles.setChipNow : null]}
                        accessibilityLabel={`Serie ${s + 1}`}
                      >
                        <Text style={[styles.setChipText, s < c ? { color: '#fff' } : s === c ? { color: onCard } : null]} numberOfLines={1}>
                          {s < c ? `${s + 1} · ${setVals[item.id]?.[s] ? shortVal(setVals[item.id][s]) : `${item.reps} rip`}` : s === c ? `${s + 1} · in corso` : s + 1}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Pressable>
              </React.Fragment>
            );
          })}
          {isFree ? (
            <Button title="Aggiungi esercizio" icon="add" variant="secondary" onPress={() => setAdding(true)} />
          ) : null}
          <Field label="Note sull'allenamento" placeholder="Come è andata? Dolori, sensazioni…" value={note} onChangeText={setNote} multiline />
        </ScrollView>
      ) : (
        <View style={styles.timerPage}>
          {curGroup?.type ? (
            <BlockCard
              type={curGroup.type}
              label={blockLabel(curGroup)}
              caption={groupCaption}
              counter={
                ssMembers.length
                  ? { text: `${ssRounds}/${ssTotal} giri`, onMinus: () => changeSsRound(-1), onPlus: () => changeSsRound(1) }
                  : timed?.type === 'amrap'
                    ? { text: `${rounds} ${rounds === 1 ? 'giro' : 'giri'}`, onMinus: () => changeRound(-1), onPlus: () => changeRound(1) }
                    : undefined
              }
              members={groupMembers}
              currentId={currentExercise.id}
              doneOf={doneOf}
              onPick={setCurrentExerciseId}
            />
          ) : (
          <View>
            <Text style={styles.small}>Esercizio {currentIndex + 1} di {exercises.length}</Text>
            <Text style={styles.bigTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{currentExercise.name}</Text>
            {lastText(currentExercise.id) ? <Text style={styles.small} numberOfLines={1}>{lastText(currentExercise.id)}</Text> : null}
            {hold ? (
              <View style={styles.holdRow} accessible accessibilityLabel={`Tenuta ${hold} secondi`}>
                <Ionicons name="stopwatch-outline" size={16} color={UI.text} />
                <Text style={styles.holdText}>Tenuta {hold} s</Text>
                {!countdown ? <Text style={styles.small}>{stopwatch.seconds >= hold ? '· fatto ✓' : `· mancano ${hold - stopwatch.seconds} s`}</Text> : null}
              </View>
            ) : null}
          </View>
          )}
          {timed ? (
            <TimerCard
              mode="countdown"
              onMode={() => {}}
              header={
                <View style={[styles.blockBadge, { backgroundColor: primaryColor }]}>
                  <Ionicons name={BLOCK_ICON[timed.type!]} size={16} color={onColor(primaryColor)} />
                  <Text style={[styles.blockBadgeText, { color: onColor(primaryColor) }]}>{blockLabel(timed)}</Text>
                </View>
              }
              // EMOM: time left in this minute; AMRAP: time left in the block
              seconds={timed.type === 'emom' ? (blockSec >= timed.minutes * 60 ? 0 : 60 - (blockSec % 60)) : Math.max(0, timed.minutes * 60 - blockSec)}
              progress={timed.type === 'emom' ? (blockSec >= timed.minutes * 60 ? 1 : (blockSec % 60) / 60) : Math.min(1, blockSec / (timed.minutes * 60))}
              caption={blockSec >= timed.minutes * 60 ? 'Finito! 💪' : timed.type === 'emom' ? `Ora: ${currentExercise.reps > 0 ? `${currentExercise.reps} × ` : ''}${currentExercise.name}` : `${rounds} ${rounds === 1 ? 'giro' : 'giri'}`}
              running={blockClock.running}
              onReset={blockClock.reset}
              onToggle={() => {
                if (blockClock.running) return blockClock.pause();
                if (blockSec >= timed.minutes * 60) return; // finished: reset first
                if (timed.type === 'emom') setCurrentExerciseId(timedMembers[Math.floor(blockSec / 60) % timedMembers.length].id);
                blockClock.start();
              }}
              onPlus15={() => {}}
              onMinus15={() => {}}
            />
          ) : (
          <TimerCard
            mode={mode}
            onMode={setMode}
            seconds={shownSeconds}
            progress={progress}
            running={running}
            onReset={() => (countdown ? restTimer.reset(restBase) : stopwatch.reset())}
            onToggle={() => (countdown ? (restTimer.running ? restTimer.pause() : restTimer.start()) : stopwatch.running ? stopwatch.pause() : stopwatch.start())}
            onPlus15={plus15}
            onMinus15={minus15}
          />
          )}

          {currentExercise.id ? (<>
          {/* blocks count in the block card header (rounds) or by themselves (EMOM): same layout for all three */}
          {!curGroup?.type ? (
          <View style={[styles.setCard, { backgroundColor: cardBg }]}>
            <Pressable style={[styles.setBtn, { backgroundColor: UI.surface }]} onPress={() => decSet(currentExercise.id, currentExercise.sets)} accessibilityLabel="Serie precedente">
              <Ionicons name="remove" size={24} color={UI.text} />
            </Pressable>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.setLabel, { color: onCardMuted }]}>SERIE</Text>
              <Text style={[styles.setValue, { color: onCard }]}>
                {counters[currentExercise.id]?.currentSet ?? 0}
                <Text style={[styles.setOf, { color: onCardMuted }]}> / {currentExercise.sets}</Text>
              </Text>
            </View>
            <Pressable style={[styles.setBtn, { backgroundColor: UI.ink }]} onPress={plusSet} accessibilityLabel="Serie successiva">
              <Ionicons name="add" size={24} color={onInk(primaryColor)} />
            </Pressable>
          </View>
          ) : null}

          <View style={styles.actionButtonsRow}>
            <Pressable style={[styles.actionBtn, { backgroundColor: cardBg }]} onPress={() => setIsWeightModalVisible(true)} accessibilityRole="button">
              <Ionicons name="barbell-outline" size={20} color={onCard} />
              <View style={{ flexShrink: 1 }}>
                <Text style={[styles.actionLabel, { color: onCardMuted }]}>{unitFor(currentExercise.id) === 'kg' ? 'Peso' : unitFor(currentExercise.id) === 'reps' ? 'Ripetizioni' : 'Tenuta'}</Text>
                <Text style={[styles.actionValue, { color: onCard }]} numberOfLines={1}>{valueText(currentExercise.id) ?? '—'}</Text>
              </View>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: cardBg }]} onPress={() => setIsVideoModalVisible(true)} accessibilityRole="button">
              <Ionicons name="videocam-outline" size={20} color={onCard} />
              <Text style={[styles.actionValue, { color: onCard }]}>Registra video</Text>
            </Pressable>
          </View>
          </>) : null}
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {!exercises.length ? (
          <Button title="Aggiungi esercizio" icon="add" iconRight onPress={() => setAdding(true)} />
        ) : tab === 'list' ? (
          <Button title={`Continua · ${currentExercise.name}`} icon="arrow-forward" iconRight onPress={() => setTab('timer')} />
        ) : nextExercise ? (
          <Button title="Esercizio successivo" icon="arrow-forward" iconRight onPress={() => setCurrentExerciseId(nextExercise.id)} />
        ) : (
          <Button title="Termina allenamento" icon="checkmark" iconRight onPress={finish} />
        )}
      </View>

      <ExercisePicker
        visible={swapping !== null}
        title="Sostituisci esercizio"
        inUse={exercises.map(e => e.id)}
        onPick={ex => swapping && swapExercise(swapping, ex)}
        onClose={() => setSwapping(null)}
      />
      <ExercisePicker
        visible={adding}
        title="Aggiungi esercizio"
        inUse={exercises.map(e => e.id)}
        onPick={addFreeExercise}
        canCreate
        onClose={() => setAdding(false)}
      />

      <ExerciseEditSheet
        exercise={editIndex >= 0 ? exercises[editIndex] : null}
        canLink={editIndex >= 0 && editIndex < exercises.length - 1}
        block={editGroup ? exercises[editGroup.start].block : undefined}
        blockSize={editGroup ? editGroup.end - editGroup.start : 1}
        onSave={saveEdit}
        onClose={() => setEditing(null)}
      />

      <WeightModal
        visible={isWeightModalVisible}
        title={currentExercise.name}
        value={weights[currentExercise.id]}
        unit={unitFor(currentExercise.id)}
        info={u => {
          const best = bestKg(sessions, currentExercise.id, u);
          return [
            lastText(currentExercise.id) ?? 'Nessuna sessione registrata',
            best ? `Record: ${fmtVal(best, u)}` : u === 'kg' && currentExercise.maxWeight ? `Nota precedente: ${currentExercise.maxWeight}` : null,
          ].filter(Boolean).join('\n');
        }}
        onSave={(v, u) => saveExerciseWeight(currentExercise.id, v, u)}
        onClose={() => setIsWeightModalVisible(false)}
      />

      <VideoRecorder visible={isVideoModalVisible} title={currentExercise.name} onClose={() => setIsVideoModalVisible(false)} />

      {isAlarmActive ? <RestAlarm onStop={stopAlarm} /> : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  pip: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  pipDigits: { fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums'] },
  container: { flex: 1, backgroundColor: UI.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: UI.bg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saveBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  elapsedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: UI.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: UI.border },
  elapsedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: UI.success },
  elapsedText: { fontSize: 14, fontWeight: '700', color: UI.text, fontVariant: ['tabular-nums'] },
  tabs: { flexDirection: 'row', backgroundColor: UI.border, borderRadius: 999, padding: 4, marginHorizontal: 16, marginTop: 4, marginBottom: 10 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 999 },
  tabText: { fontSize: 15, fontWeight: '600', color: UI.muted },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTitle: { fontSize: 15, fontWeight: '700', color: UI.text },
  small: { fontSize: 13, color: UI.muted },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: UI.border, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: UI.text },
  exCard: { backgroundColor: UI.card, borderRadius: 16, padding: 14, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: UI.border },
  exCardActive: { borderWidth: 2, borderColor: UI.text },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: UI.borderStrong, alignItems: 'center', justifyContent: 'center' },
  exCircleText: { fontSize: 15, fontWeight: '700', color: UI.text },
  exName: { fontSize: 16, fontWeight: '700', color: UI.text },
  doneText: { fontSize: 13, fontWeight: '600', color: UI.muted },
  liveBadge: { backgroundColor: UI.ink, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  liveBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  setChips: { flexDirection: 'row', gap: 8 },
  setChip: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: UI.surface, borderWidth: 1.5, borderColor: UI.surface },
  setChipDone: { backgroundColor: UI.ink, borderColor: UI.ink },
  setChipNow: { backgroundColor: 'transparent', borderColor: UI.text },
  setChipText: { fontSize: 13, fontWeight: '600', color: UI.text },
  bigTitle: { fontSize: 22, lineHeight: 27, fontWeight: '700', color: UI.text, marginTop: 2 },
  timerPage: { flex: 1, paddingHorizontal: 16, paddingTop: 0, paddingBottom: 8, gap: 10 },
  setCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: UI.card, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: UI.border },
  setBtn: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  setLabel: { fontSize: 11, fontWeight: '700', color: UI.muted, letterSpacing: 1 },
  setValue: { fontSize: 28, fontWeight: '800', color: UI.text },
  setOf: { fontSize: 16, fontWeight: '600', color: UI.muted },
  actionButtonsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 52, paddingHorizontal: 12, backgroundColor: UI.card, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: UI.border },
  actionLabel: { fontSize: 11, color: UI.muted },
  actionValue: { fontSize: 15, fontWeight: '700', color: UI.text },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: -4, paddingHorizontal: 4 },
  blockHeadText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: UI.text },
  blockBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  blockBadgeText: { fontSize: 14, fontWeight: '800' },
  holdRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  holdText: { fontSize: 14, fontWeight: '700', color: UI.text },
}));


