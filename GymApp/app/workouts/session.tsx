import { useWorkouts } from '@/app/context/WorkoutContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

type Counters = Record<string, { currentSet: number; done: boolean }>;

function useCountdown(initialSeconds: number) {
  const [remainingMs, setRemainingMs] = React.useState(initialSeconds * 1000);
  const [running, setRunning] = React.useState(false);
  const lastTsRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!running) return;
    if (remainingMs <= 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      const last = lastTsRef.current ?? now;
      const delta = now - last;
      lastTsRef.current = now;
      setRemainingMs(ms => (ms > 0 ? Math.max(0, ms - delta) : 0));
    }, 16);
    return () => clearInterval(id);
  }, [running, remainingMs]);
  const start = React.useCallback(() => {
    lastTsRef.current = Date.now();
    setRunning(true);
  }, []);
  const pause = React.useCallback(() => setRunning(false), []);
  const reset = React.useCallback((s: number) => {
    setRunning(false);
    lastTsRef.current = null;
    setRemainingMs(s * 1000);
  }, []);
  const seconds = Math.floor(remainingMs / 1000);
  const millis = Math.floor(remainingMs % 1000);
  return { seconds, millis, running, start, pause, reset };
}

function useStopwatch() {
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const lastTsRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const now = Date.now();
      const last = lastTsRef.current ?? now;
      const delta = now - last;
      lastTsRef.current = now;
      setElapsedMs(ms => ms + delta);
    }, 16);
    return () => clearInterval(id);
  }, [running]);
  const start = React.useCallback(() => {
    lastTsRef.current = Date.now();
    setRunning(true);
  }, []);
  const pause = React.useCallback(() => setRunning(false), []);
  const reset = React.useCallback(() => {
    setRunning(false);
    lastTsRef.current = null;
    setElapsedMs(0);
  }, []);
  const seconds = Math.floor(elapsedMs / 1000);
  const millis = Math.floor(elapsedMs % 1000);
  return { seconds, millis, running, start, pause, reset };
}

export default function SessionScreen() {
  const params = useLocalSearchParams<{ workoutId: string }>();
  const { workouts } = useWorkouts();
  const workout = workouts.find(w => w.id === params.workoutId);
  const { width } = useWindowDimensions();
  const horizontalPadding = 16; // match container padding
  const pageWidth = width - horizontalPadding * 2;
  const [pageIndex, setPageIndex] = React.useState(0);

  const [counters, setCounters] = React.useState<Counters>({});
  const [currentExerciseId, setCurrentExerciseId] = React.useState<string | null>(null);
  const [restBase, setRestBase] = React.useState<number>(workout?.exercises[0]?.restSeconds ?? 60);
  const restTimer = useCountdown(restBase);
  const stopwatch = useStopwatch();
  const [mode, setMode] = React.useState<'countdown' | 'stopwatch'>('countdown');

  if (!workout) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="default">Allenamento non trovato.</ThemedText>
      </ThemedView>
    );
  }

  // Controllo di sicurezza: verifica che tutti gli esercizi abbiano un ID
  const hasInvalidExercises = workout.exercises.some(ex => !ex.id);
  
  if (hasInvalidExercises) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Errore</ThemedText>
        <ThemedText type="default" style={{ marginTop: 16 }}>
          Questo allenamento contiene dati non validi. Riavvia l'app per migrare i dati.
        </ThemedText>
      </ThemedView>
    );
  }

  React.useEffect(() => {
    // init counters per esercizio
    const init: Counters = {};
    workout.exercises.forEach(ex => {
      if (ex.id) {
        init[ex.id] = { currentSet: 0, done: false };
      }
    });
    setCounters(init);
  }, [workout.id]);

  const incSet = (exId: string, maxSets: number) => {
    setCounters(prev => {
      const curr = prev[exId]?.currentSet ?? 0;
      const next = Math.min(curr + 1, maxSets);
      return { ...prev, [exId]: { currentSet: next, done: next >= maxSets } };
    });
  };
  const decSet = (exId: string) => {
    setCounters(prev => {
      const curr = prev[exId]?.currentSet ?? 0;
      const next = Math.max(curr - 1, 0);
      return { ...prev, [exId]: { currentSet: next, done: false } };
    });
  };

  const startRest = (seconds: number) => {
    setRestBase(seconds);
    restTimer.reset(seconds);
    restTimer.start();
  };

  const currentExercise = React.useMemo(() => {
    const selected = currentExerciseId ? workout.exercises.find(ex => ex.id === currentExerciseId) : undefined;
    if (selected) return selected;
    const firstIncomplete = workout.exercises.find(ex => {
      return (counters[ex.id]?.currentSet ?? 0) < ex.sets;
    });
    return firstIncomplete ?? workout.exercises[workout.exercises.length - 1];
  }, [workout.exercises, counters, currentExerciseId]);

  // Aggiorna automaticamente il timer base quando cambia esercizio corrente
  React.useEffect(() => {
    if (!currentExercise) return;
    setRestBase(currentExercise.restSeconds);
    restTimer.reset(currentExercise.restSeconds);
  }, [currentExercise.id, currentExercise.restSeconds]);

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

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / pageWidth);
    if (idx !== pageIndex) setPageIndex(idx);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{workout.title}</ThemedText>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Pagina 1: Schermata principale */}
        <View style={[styles.page, { width: pageWidth }]}>
          <View style={styles.timerCard}>
            <ThemedText style={styles.timerDigitsLarge} type="defaultSemiBold">
              {mode === 'countdown'
                ? formatTime(restTimer.seconds, restTimer.millis)
                : formatTime(stopwatch.seconds, stopwatch.millis)}
            </ThemedText>
            <View style={styles.timerButtonsRow}>
              <Pressable
                style={[styles.pillBtn, styles.pillSmall]}
                onPress={() => (mode === 'countdown' ? restTimer.reset(restBase) : stopwatch.reset())}
              >
                <ThemedText style={styles.pillTextSmall} type="defaultSemiBold">ripristina</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.pillBtn, styles.pillLarge]}
                onPress={() =>
                  mode === 'countdown'
                    ? restTimer.running ? restTimer.pause() : restTimer.start()
                    : stopwatch.running ? stopwatch.pause() : stopwatch.start()
                }
              >
                <ThemedText style={styles.pillTextLarge} type="defaultSemiBold">
                  {mode === 'countdown'
                    ? restTimer.running ? 'pausa' : 'avvia'
                    : stopwatch.running ? 'pausa' : 'avvia'}
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.modeSwitchRow}>
              <Pressable
                onPress={() => setMode('countdown')}
                style={[styles.modeBtn, mode === 'countdown' ? styles.modeBtnActive : null]}
              >
                <ThemedText style={mode === 'countdown' ? styles.modeTextActive : styles.modeTextInactive} type="defaultSemiBold">Timer</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setMode('stopwatch')}
                style={[styles.modeBtn, mode === 'stopwatch' ? styles.modeBtnActive : null]}
              >
                <ThemedText style={mode === 'stopwatch' ? styles.modeTextActive : styles.modeTextInactive} type="defaultSemiBold">Cronometro</ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={styles.exerciseBar}>
            <ThemedText type="defaultSemiBold">{currentExercise.name}</ThemedText>
          </View>
          <View style={styles.exerciseControls}>
            <Pressable
              style={[styles.bigBtn, styles.bigBtnMinus]}
              onPress={() => decSet(currentExercise.id)}
            >
              <ThemedText style={styles.bigBtnText} type="defaultSemiBold">−</ThemedText>
            </Pressable>
            <ThemedText type="defaultSemiBold">
              {(counters[currentExercise.id]?.currentSet ?? 0)}/{currentExercise.sets}
            </ThemedText>
            <Pressable
              style={[styles.bigBtn, styles.bigBtnPlus]}
              onPress={() => incSet(currentExercise.id, currentExercise.sets)}
            >
              <ThemedText style={styles.bigBtnText} type="defaultSemiBold">＋</ThemedText>
            </Pressable>
          </View>

          <View style={styles.dotsRow}>
            <View style={[styles.dot, pageIndex === 0 ? styles.dotActive : null]} />
            <View style={[styles.dot, pageIndex === 1 ? styles.dotActive : null]} />
          </View>
        </View>

        {/* Pagina 2: Lista esercizi */}
        <View style={[styles.page, { width: pageWidth }]}>
          <FlatList
            data={workout.exercises}
            keyExtractor={ex => ex.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const c = counters[item.id] ?? { currentSet: 0, done: false };
              const showDuration = item.durationSeconds && item.durationSeconds > 0;
              const isActive = currentExercise.id === item.id;
              const isCompleted = c.done || c.currentSet >= item.sets;
              
              return (
                <ThemedView style={[
                  styles.listCard, 
                  isActive && !isCompleted ? styles.listCardActive : null,
                  isCompleted ? styles.listCardCompleted : null
                ]}>
                  <Pressable onPress={() => setCurrentExerciseId(item.id)} style={styles.rowBetween}>
                    <ThemedText style={isActive || isCompleted ? styles.listCardActiveText : undefined} type="defaultSemiBold">{item.name}</ThemedText>
                    <ThemedText style={isActive || isCompleted ? styles.listCardActiveText : undefined} type="default">
                      {c.currentSet}/{item.sets} serie {isCompleted ? '✓' : ''}
                    </ThemedText>
                  </Pressable>
                  {item.description ? (
                    <ThemedText style={isActive || isCompleted ? styles.listCardActiveText : undefined} type="default">{item.description}</ThemedText>
                  ) : null}
                  <View style={styles.rowBetween}>
                    <View style={styles.rowGap}>
                      <Pressable style={[styles.smallBtn, styles.smallBtnOutline]} onPress={() => decSet(item.id)}>
                        <ThemedText style={isActive || isCompleted ? styles.listCardActiveText : undefined} type="defaultSemiBold">−</ThemedText>
                      </Pressable>
                      <Pressable style={[styles.smallBtn, styles.smallBtnOutline]} onPress={() => incSet(item.id, item.sets)}>
                        <ThemedText style={isActive || isCompleted ? styles.listCardActiveText : undefined} type="defaultSemiBold">＋</ThemedText>
                      </Pressable>
                    </View>
                    <Pressable onPress={() => startRest(item.restSeconds)}>
                      <ThemedText style={isActive || isCompleted ? styles.listCardActiveText : undefined} type="link">Start recupero ({item.restSeconds}s)</ThemedText>
                    </Pressable>
                  </View>
                  {showDuration ? (
                    <ThemedText style={isActive || isCompleted ? styles.listCardActiveText : undefined} type="default">Durata consigliata: {item.durationSeconds}s</ThemedText>
                  ) : null}
                </ThemedView>
              );
            }}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    backgroundColor: 'transparent', // Cambia qui
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  timerCard: {
    flex: 1.2,
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  timerDigitsLarge: {
    fontSize: 48,
    lineHeight: 56,
  },
  timerButtonsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  pillBtn: {
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pillSmall: {
    borderRadius: 18,
  },
  pillLarge: {
    borderRadius: 22,
  },
  pillTextSmall: {
    fontSize: 14,
  },
  pillTextLarge: {
    fontSize: 18,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modeBtn: {
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  modeBtnActive: {
    backgroundColor: '#0a84ff',
    borderColor: '#0a84ff',
  },
  modeTextActive: {
    color: '#fff',
  },
  modeTextInactive: {
    color: '#fff',
  },
  exerciseBar: {
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  exerciseControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#999',
  },
  dotActive: {
    backgroundColor: '#000',
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  listCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#000',
    gap: 8,
  },
  listCardActive: {
    borderColor: '#0a84ff',
    backgroundColor: '#000',
  },
  listCardCompleted: {
    borderColor: '#4CAF50',
    backgroundColor: '#1b5e20',
  },
  listCardActiveText: {
    color: '#fff',
  },
  bigControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  bigBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
  },
  bigBtnMinus: {},
  bigBtnPlus: {},
  bigBtnText: {
    fontSize: 36,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowGap: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  smallBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  smallBtnOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
  },
});


