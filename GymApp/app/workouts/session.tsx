import { UI, themed } from '@/constants/theme';
import { useWorkouts } from '@/context/WorkoutContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import WorkoutPip from '@/modules/workout-pip';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';
import { Alert, Modal, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, onColor, onInk } from '@/components/ui/kit';
import { VideoRecorder } from '@/components/session/VideoRecorder';
import { useCountdown, useStopwatch } from '@/hooks/use-timers';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { useHistory, type SessionDraft } from '@/context/HistoryContext';
import { useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { UNITS, bestKg, fmtVal, lastFor, parseKg, unitOf, volume, type SessionLog, type Unit } from '@/lib/stats';

type Counters = SessionDraft['counters'];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

/** 90 -> "1:30" */
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function SessionScreen() {
  const params = useLocalSearchParams<{ workoutId: string }>();
  const { workouts } = useWorkouts();
  const { sessions, addSession, draft, setDraft, isLoading: historyLoading } = useHistory();
  const { primaryColor, secondaryColor } = useCustomTheme();
  const { plans, activePlanId } = useWeeklyPlans();
  // cards use the theme surface; secondary color is only an accent (timer ring)
  const cardBg = UI.card;
  const onCard = UI.text;
  const onCardMuted = UI.muted;
  const [ringSize, setRingSize] = React.useState(0);
  const insets = useSafeAreaInsets();
  const workout = workouts.find(w => w.id === params.workoutId);
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
  const [units, setUnits] = React.useState<Record<string, Unit>>({});
  const [modalUnit, setModalUnit] = React.useState<Unit>('kg');
  const [logged, setLogged] = React.useState<Record<string, true>>({});
  const [weightText, setWeightText] = React.useState('');
  const [mode, setMode] = React.useState<'countdown' | 'stopwatch'>('countdown');
  const [isWeightModalVisible, setIsWeightModalVisible] = React.useState(false);
  const [isVideoModalVisible, setIsVideoModalVisible] = React.useState(false);
  const [isAlarmActive, setIsAlarmActive] = React.useState(false);
  const [restBase, setRestBase] = React.useState<number>(workout?.exercises[0]?.restSeconds ?? 60);
  const [ready, setReady] = React.useState(false);

  // resume the saved draft for this workout, otherwise start fresh with last session's weights prefilled
  React.useEffect(() => {
    if (!workout || historyLoading) return;
    if (draft?.workoutId === workout.id) {
      setCounters(draft.counters);
      setWeights(draft.weights);
      setUnits(draft.units ?? {});
      setLogged(draft.logged ?? {});
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
  React.useEffect(() => {
    if (!ready || !workout || (!Object.values(counters).some(c => c.currentSet > 0) && !Object.keys(logged).length)) return;
    setDraft({ workoutId: workout.id, startedAt, counters, weights, units, logged });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counters, weights, units, logged, ready]);

  const incSet = (exId: string, maxSets: number) => {
    setCounters(prev => {
      const curr = prev[exId]?.currentSet ?? 0;
      const next = Math.min(curr + 1, maxSets);
      return { ...prev, [exId]: { currentSet: next, done: next >= maxSets } };
    });
  };
  const setSet = (exId: string, maxSets: number, n: number) =>
    setCounters(prev => ({ ...prev, [exId]: { currentSet: n, done: n >= maxSets } }));
  const decSet = (exId: string) => {
    setCounters(prev => {
      const curr = prev[exId]?.currentSet ?? 0;
      const next = Math.max(curr - 1, 0);
      return { ...prev, [exId]: { currentSet: next, done: false } };
    });
  };

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

  const saveExerciseWeight = (exerciseId: string) => {
    const v = parseKg(weightText);
    if (v === undefined) {
      Alert.alert('Valore non valido', modalUnit === 'kg' ? 'Inserisci solo il numero di kg, es. 80 o 82,5.' : modalUnit === 'reps' ? 'Inserisci solo il numero di ripetizioni, es. 12.' : 'Inserisci solo i secondi di tenuta, es. 30.');
      return false;
    }
    setWeights(prev => ({ ...prev, [exerciseId]: v }));
    setUnits(prev => ({ ...prev, [exerciseId]: modalUnit }));
    setLogged(prev => ({ ...prev, [exerciseId]: true }));
    return true;
  };

  const currentExercise = React.useMemo(() => {
    if (!workout || workout.exercises.length === 0) {
      return { id: '', name: '', sets: 0, reps: 0, restSeconds: 0, description: '', durationSeconds: 0, maxWeight: '' };
    }
    const selected = currentExerciseId ? workout.exercises.find(ex => ex.id === currentExerciseId) : undefined;
    if (selected) return selected;
    const firstIncomplete = workout.exercises.find(ex => {
      return (counters[ex.id]?.currentSet ?? 0) < ex.sets;
    });
    return firstIncomplete ?? workout.exercises[workout.exercises.length - 1];
  }, [workout, counters, currentExerciseId]);

  // Aggiorna automaticamente il timer base quando cambia esercizio corrente
  React.useEffect(() => {
    if (!currentExercise || !currentExercise.id) return;
    setRestBase(currentExercise.restSeconds);
    restTimer.reset(currentExercise.restSeconds);
  }, [currentExercise?.id, currentExercise?.restSeconds]);

  // Android: home durante l'allenamento -> widget PiP; notifica fissa col timer che sopravvive alla chiusura dell'app
  React.useEffect(() => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    WorkoutPip?.setPipEnabled(true);
    return () => {
      WorkoutPip?.setPipEnabled(false);
      WorkoutPip?.hideTimer();
    };
  }, []);

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

  const exercises = workout.exercises;
  const doneOf = (ex: (typeof exercises)[number]) => Math.min(counters[ex.id]?.currentSet ?? 0, ex.sets);
  const doneExercises = exercises.filter(ex => doneOf(ex) >= ex.sets).length;
  const totalSets = exercises.reduce((n, ex) => n + ex.sets, 0);
  const doneSets = exercises.reduce((n, ex) => n + doneOf(ex), 0);
  const currentIndex = exercises.findIndex(ex => ex.id === currentExercise.id);
  const nextExercise = exercises[currentIndex + 1];
  const lastOf = (exId: string) => lastFor(sessions, exId);
  const lastText = (exId: string) => {
    const l = lastOf(exId);
    return l ? `Ultima volta (${fmtDate(l.date)}): ${l.setsDone}×${l.reps}${l.weightKg ? ` · ${fmtVal(l.weightKg, unitOf(l))}` : ''}` : null;
  };
  const unitFor = (exId: string) => units[exId] ?? 'kg';
  const valueText = (exId: string) => (weights[exId] ? fmtVal(weights[exId], unitFor(exId)) : null);
  // shortcut: supersets are pairs (A↔B); a chain of 3+ only alternates the last two
  const supersetPartner = (i: number) =>
    exercises[i]?.supersetWithNext ? exercises[i + 1] : exercises[i - 1]?.supersetWithNext ? exercises[i - 1] : undefined;

  const plusSet = () => {
    incSet(currentExercise.id, currentExercise.sets);
    const partner = supersetPartner(currentIndex);
    if (partner && doneOf(partner) < partner.sets) setCurrentExerciseId(partner.id);
  };

  const finish = () => {
    const done = exercises.filter(ex => doneOf(ex) > 0 || logged[ex.id]);
    if (done.length === 0) {
      setDraft(null);
      router.back();
      return;
    }
    const hasWorkout = (p?: (typeof plans)[number]) => p?.days?.some(d => d.workoutId === workout.id);
    // the active plan wins; otherwise any plan that schedules this workout
    const plan = [plans.find(p => p.id === activePlanId), ...plans].find(hasWorkout);
    const log: SessionLog = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      workoutId: workout.id,
      ...(plan ? { planId: plan.id } : {}),
      title: workout.title,
      date: new Date(startedAt).toISOString(),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      exercises: done.map(ex => ({ exerciseId: ex.id, name: ex.name, setsDone: Math.max(doneOf(ex), 1), reps: ex.reps, ...(weights[ex.id] ? { weightKg: weights[ex.id], ...(unitFor(ex.id) !== 'kg' ? { unit: unitFor(ex.id) } : {}) } : {}) })),
    };
    // a record needs something to beat: the best logged value in the same unit, or the old free-text weight
    const records = log.exercises.filter(e => {
      const prev = bestKg(sessions, e.exerciseId, unitOf(e)) ?? (unitOf(e) === 'kg' ? parseKg(exercises.find(x => x.id === e.exerciseId)?.maxWeight) : undefined);
      return e.weightKg && prev !== undefined && e.weightKg > prev;
    });
    addSession(log);
    setDraft(null);
    const kg = Math.round(volume(log));
    Alert.alert(
      records.length ? 'Nuovo record! 🎉' : 'Allenamento salvato 💪',
      [
        `Durata ${clock(log.durationSec)} · ${doneSets}/${totalSets} serie${kg ? ` · ${kg.toLocaleString('it-IT')} kg sollevati` : ''}`,
        ...records.map(r => `🏆 ${r.name}: ${fmtVal(r.weightKg!, unitOf(r))}`),
      ].join('\n'),
    );
    router.back();
  };

  const exit = () => {
    // nothing ticked and no value entered: nothing to save
    if (doneSets === 0 && !Object.keys(logged).length) {
      setDraft(null);
      router.back();
      return;
    }
    Alert.alert("Uscire dall'allenamento?", `Hai completato ${doneSets} serie. Salvalo nello storico o scartalo.`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Scarta', style: 'destructive', onPress: () => { setDraft(null); router.back(); } },
      { text: 'Salva e termina', onPress: finish },
    ]);
  };

  const countdown = mode === 'countdown'; // timer and stopwatch share the same ink card
  const running = countdown ? restTimer.running : stopwatch.running;
  const shownSeconds = countdown ? restTimer.seconds : stopwatch.seconds;
  const progress = countdown
    ? Math.min(1, (restTimer.seconds * 1000 + restTimer.millis) / Math.max(1, restBase * 1000))
    : ((stopwatch.seconds % 60) * 1000 + stopwatch.millis) / 60000;
  const cardFg = '#fff';
  const ringR = Math.max(0, ringSize / 2 - 6);
  const ringC = 2 * Math.PI * ringR;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: workout.title,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable onPress={exit} hitSlop={10} accessibilityLabel="Chiudi allenamento">
              <Ionicons name="close" size={24} color={UI.text} />
            </Pressable>
          ),
          headerRight: () => (
            <View style={[styles.elapsedPill, { backgroundColor: cardBg }]} accessibilityLabel="Durata allenamento">
              <View style={styles.elapsedDot} />
              <Text style={[styles.elapsedText, { color: onCard }]}>{clock(Math.floor((now - startedAt) / 1000))}</Text>
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
            const c = doneOf(item);
            const done = c >= item.sets;
            const active = item.id === currentExercise.id && !done;
            const meta = [
              `${item.sets} × ${item.reps > 0 ? item.reps : 'max'}`,
              valueText(item.id),
              supersetPartner(i) ? 'superserie' : null,
              active ? `rec. ${clock(item.restSeconds)}` : null,
            ].filter(Boolean).join(' · ');
            return (
              <Pressable
                key={item.id}
                onPress={() => setCurrentExerciseId(item.id)}
                style={[styles.exCard, { backgroundColor: cardBg }, active && styles.exCardActive]}
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
                          {s < c ? `${s + 1} · ${item.reps} rip` : s === c ? `${s + 1} · in corso` : s + 1}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.timerPage}>
          <View>
            <Text style={styles.small}>Esercizio {currentIndex + 1} di {exercises.length}</Text>
            <Text style={styles.bigTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{currentExercise.name}</Text>
            {lastText(currentExercise.id) ? <Text style={styles.small} numberOfLines={1}>{lastText(currentExercise.id)}</Text> : null}
          </View>
          {/* <View style={styles.chipsRow}>
            {currentExercise.reps > 0 ? <Text style={[styles.infoChip, { backgroundColor: cardBg, color: onCard }]}>{currentExercise.reps} ripetizioni</Text> : null}
            <Text style={[styles.infoChip, { backgroundColor: cardBg, color: onCard }]}>Recupero {clock(currentExercise.restSeconds)}</Text>
            {currentExercise.durationSeconds ? <Text style={[styles.infoChip, { backgroundColor: cardBg, color: onCard }]}>Durata {clock(currentExercise.durationSeconds)}</Text> : null}
          </View> */}

          <View style={[styles.timerCard, { backgroundColor: UI.ink, borderColor: UI.ink }]}>
            <View style={[styles.segment, { backgroundColor: '#262626' }]}>
              {([['stopwatch', 'Cronometro', 'stopwatch-outline'], ['countdown', 'Timer', 'hourglass-outline']] as const).map(([key, label, icon]) => {
                const on = mode === key;
                const fg = on ? onColor(primaryColor) : '#9a9a9a';
                return (
                  <Pressable
                    key={key}
                    onPress={() => setMode(key)}
                    style={[styles.segmentBtn, on && { backgroundColor: primaryColor }]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                  >
                    <Ionicons name={icon} size={16} color={fg} />
                    <Text style={[styles.segmentText, { color: fg }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View
              style={styles.ringArea}
              // leave breathing room around the ring and cap it so tall phones don't get a giant dial
              onLayout={e => setRingSize(Math.max(0, Math.floor(Math.min(240, e.nativeEvent.layout.width - 24, e.nativeEvent.layout.height - 16))))}
            >
            <View style={[styles.ringWrap, { width: ringSize, height: ringSize }]}>
              <Svg width={ringSize} height={ringSize} style={StyleSheet.absoluteFill}>
                <Circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} stroke="#2c2c2c" strokeWidth={10} fill="none" />
                <Circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringR}
                  stroke={onInk(primaryColor) === '#fff' ? secondaryColor : primaryColor}
                  strokeWidth={10}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={ringC}
                  strokeDashoffset={ringC * (1 - progress)}
                  transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                />
              </Svg>
              <Text numberOfLines={1} style={[styles.ringDigits, { color: cardFg, fontSize: Math.max(28, ringSize * 0.26) }]}>{clock(shownSeconds)}</Text>
            </View>
            </View>

            <View style={styles.timerButtonsRow}>
              <Pressable
                style={[styles.roundBtn, { borderColor: '#3a3a3a' }]}
                onPress={() => (countdown ? restTimer.reset(restBase) : stopwatch.reset())}
                accessibilityLabel="Ripristina"
              >
                <Ionicons name="refresh" size={20} color={cardFg} />
              </Pressable>
              <Pressable
                style={[styles.playBtn, { backgroundColor: primaryColor }]}
                onPress={() =>
                  countdown
                    ? restTimer.running ? restTimer.pause() : restTimer.start()
                    : stopwatch.running ? stopwatch.pause() : stopwatch.start()
                }
                accessibilityLabel={running ? 'Pausa' : 'Avvia'}
              >
                <Ionicons name={running ? 'pause' : 'play'} size={28} color={onColor(primaryColor)} />
              </Pressable>
              {countdown ? (
                <Pressable
                  style={[styles.roundBtn, { borderColor: '#3a3a3a' }]}
                  onPress={() => restTimer.setSeconds(restTimer.seconds + 15)}
                  accessibilityLabel="Aggiungi 15 secondi"
                >
                  <Text style={styles.plus15}>+15 s</Text>
                </Pressable>
              ) : (
                <View style={styles.roundBtnSpacer} />
              )}
            </View>
          </View>

          <View style={[styles.setCard, { backgroundColor: cardBg }]}>
            <Pressable style={[styles.setBtn, { backgroundColor: UI.surface }]} onPress={() => decSet(currentExercise.id)} accessibilityLabel="Serie precedente">
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

          <View style={styles.actionButtonsRow}>
            <Pressable style={[styles.actionBtn, { backgroundColor: cardBg }]} onPress={() => { setWeightText(weights[currentExercise.id] ? String(weights[currentExercise.id]).replace('.', ',') : ''); setModalUnit(unitFor(currentExercise.id)); setIsWeightModalVisible(true); }} accessibilityRole="button">
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
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {tab === 'list' ? (
          <Button title={`Continua · ${currentExercise.name}`} icon="arrow-forward" iconRight onPress={() => setTab('timer')} />
        ) : nextExercise ? (
          <Button title="Esercizio successivo" icon="arrow-forward" iconRight onPress={() => setCurrentExerciseId(nextExercise.id)} />
        ) : (
          <Button title="Termina allenamento" icon="checkmark" iconRight onPress={finish} />
        )}
      </View>

      <Modal
        visible={isWeightModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsWeightModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setIsWeightModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <ThemedText type="subtitle" style={styles.modalTitle}>
              Registra - {currentExercise.name}
            </ThemedText>

            <View style={styles.unitRow} accessibilityRole="tablist">
              {UNITS.map(({ unit, label }) => (
                <Pressable
                  key={unit}
                  onPress={() => setModalUnit(unit)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: modalUnit === unit }}
                  style={[styles.unitBtn, modalUnit === unit && { backgroundColor: UI.ink }]}
                >
                  <Text style={[styles.unitText, modalUnit === unit && { color: '#fff' }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            
            <ThemedText type="default" style={[styles.modalRecordDisplay, { color: UI.muted }]}>
              {[
                lastText(currentExercise.id) ?? 'Nessuna sessione registrata',
                bestKg(sessions, currentExercise.id, modalUnit) ? `Record: ${fmtVal(bestKg(sessions, currentExercise.id, modalUnit)!, modalUnit)}` : modalUnit === 'kg' && currentExercise.maxWeight ? `Nota precedente: ${currentExercise.maxWeight}` : null,
              ].filter(Boolean).join('\n')}
            </ThemedText>

            <TextInput
              style={styles.modalInput}
              placeholder={modalUnit === 'kg' ? 'kg, es. 80 o 82,5' : modalUnit === 'reps' ? 'ripetizioni, es. 12' : 'secondi di tenuta, es. 30'}
              placeholderTextColor={UI.muted}
              keyboardType="decimal-pad"
              autoFocus={true}
              selectTextOnFocus
              value={weightText}
              onChangeText={setWeightText}
            />
            
            <View style={styles.modalButtonsRow}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setIsWeightModalVisible(false)}
              >
                <ThemedText style={styles.modalBtnCancelText} type="defaultSemiBold">
                  Annulla
                </ThemedText>
              </Pressable>
              
              <Pressable
                style={[styles.modalBtn, { backgroundColor: UI.ink }]}
                onPress={() => {
                  if (saveExerciseWeight(currentExercise.id)) setIsWeightModalVisible(false);
                }}
              >
                <ThemedText style={styles.modalBtnSaveText} type="defaultSemiBold">
                  Salva
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <VideoRecorder visible={isVideoModalVisible} title={currentExercise.name} onClose={() => setIsVideoModalVisible(false)} />

      {/* ── Allarme timer ── */}
      {isAlarmActive && (
        <Pressable
          style={styles.alarmOverlay}
          onPress={stopAlarm}
        >
          <View style={styles.alarmCard}>
            <Ionicons name="alarm-outline" size={48} color={UI.text} />
            <ThemedText style={styles.alarmTitle} type="defaultSemiBold">
              Recupero Finito!
            </ThemedText>
            <ThemedText style={styles.alarmSub} type="default">
              Premi per fermare la sveglia
            </ThemedText>
            <Pressable
              style={[styles.alarmBtn, { backgroundColor: UI.ink }]}
              onPress={stopAlarm}
            >
              <ThemedText style={styles.alarmBtnText} type="defaultSemiBold">
                Stop Sveglia
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  pip: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  pipDigits: { fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums'] },
  container: { flex: 1, backgroundColor: UI.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: UI.bg },
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
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -2 },
  infoChip: { fontSize: 13, fontWeight: '600', color: UI.text, backgroundColor: UI.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: UI.border },
  timerPage: { flex: 1, paddingHorizontal: 16, paddingTop: 0, paddingBottom: 8, gap: 10 },
  timerCard: { flex: 1, minHeight: 0, backgroundColor: UI.card, borderRadius: 28, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 8, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: UI.border },
  segment: { flexDirection: 'row', alignSelf: 'stretch', borderRadius: 999, padding: 4 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 999 },
  segmentText: { fontSize: 14, fontWeight: '700' },
  ringArea: { flex: 1, minHeight: 150, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center', minWidth: 140, minHeight: 140 },
  ringDigits: { fontWeight: '800', marginBottom: 2, fontVariant: ['tabular-nums'] },
  timerButtonsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36 },
  roundBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  roundBtnSpacer: { width: 48 },
  playBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  plus15: { color: '#fff', fontSize: 13, fontWeight: '700' },
  setCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: UI.card, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: UI.border },
  setBtn: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  setLabel: { fontSize: 11, fontWeight: '700', color: UI.muted, letterSpacing: 1 },
  setValue: { fontSize: 28, fontWeight: '800', color: UI.text },
  setOf: { fontSize: 16, fontWeight: '600', color: UI.muted },
  actionButtonsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 52, paddingHorizontal: 12, backgroundColor: UI.card, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: UI.border },
  actionLabel: { fontSize: 11, color: UI.muted },
  actionValue: { fontSize: 15, fontWeight: '700', color: UI.text },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: UI.card,
    borderRadius: 14,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: UI.border,
    gap: 16,
  },
  modalTitle: {
    color: UI.text,
    fontSize: 20,
    textAlign: 'center',
  },
  unitRow: { flexDirection: 'row', backgroundColor: UI.surface, borderRadius: 12, padding: 4, gap: 4 },
  unitBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  unitText: { fontSize: 14, fontWeight: '700', color: UI.muted },
  modalRecordDisplay: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 18,
    color: UI.text,
    backgroundColor: UI.input,
    textAlign: 'center',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    borderWidth: 1.5,
    borderColor: UI.borderStrong,
    backgroundColor: 'transparent',
  },
  modalBtnCancelText: {
    color: UI.danger,
  },
  modalBtnSave: {
  },
  modalBtnSaveText: {
    color: '#fff',
  },
  alarmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  alarmCard: {
    backgroundColor: UI.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: UI.border,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    width: '85%',
  },
  alarmTitle: {
    fontSize: 26,
    color: UI.text,
    textAlign: 'center',
  },
  alarmSub: {
    fontSize: 14,
    color: UI.muted,
    textAlign: 'center',
  },
  alarmBtn: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  alarmBtnText: {
    color: '#fff',
    fontSize: 18,
  },
}));


