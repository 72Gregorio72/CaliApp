import { useWorkouts } from '@/context/WorkoutContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MiniPlayer } from '@/components/MiniPlayer';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';
import { FlatList, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, TextInput, Vibration, View, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as MediaLibrary from 'expo-media-library';
import { useCustomTheme } from '@/context/CustomThemeContext';

type Counters = Record<string, { currentSet: number; done: boolean }>;

function useCountdown(initialSeconds: number, onComplete?: () => void) {
  const [remainingMs, setRemainingMs] = React.useState(initialSeconds * 1000);
  const [running, setRunning] = React.useState(false);
  const lastTsRef = React.useRef<number | null>(null);
  // Ref per evitare stale closure nel callback
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  React.useEffect(() => {
    if (!running) return;
    if (remainingMs <= 0) {
      // Timer finito: auto-stop e callback
      setRunning(false);
      onCompleteRef.current?.();
      return;
    }
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
  const setSeconds = React.useCallback((s: number) => {
    setRemainingMs(s * 1000);
  }, []);
  return { seconds, millis, running, start, pause, reset, setSeconds };
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

const NUMBER_ITEMS = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

interface ScrollWheelProps {
  items: string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  itemHeight?: number;
  activeColor: string;
  inactiveColor?: string;
}

function ScrollWheel({ items, selectedValue, onValueChange, itemHeight = 44, activeColor, inactiveColor = '#888' }: ScrollWheelProps) {
  const flatListRef = React.useRef<FlatList>(null);
  const selectedIndex = items.indexOf(selectedValue);
  const lastLoggedValueRef = React.useRef(selectedValue);

  React.useEffect(() => {
    if (selectedValue !== lastLoggedValueRef.current) {
      lastLoggedValueRef.current = selectedValue;
      const index = items.indexOf(selectedValue);
      if (index !== -1) {
        flatListRef.current?.scrollToOffset({
          offset: index * itemHeight,
          animated: false,
        });
      }
    }
  }, [selectedValue, itemHeight, items]);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / itemHeight);
    if (index >= 0 && index < items.length) {
      const val = items[index];
      if (val !== lastLoggedValueRef.current) {
        lastLoggedValueRef.current = val;
        onValueChange(val);
      }
    }
  };

  const data = React.useMemo(() => ['', ...items, ''], [items]);

  return (
    <View style={[scrollWheelStyles.container, { height: itemHeight * 3 }]}>
      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(item, index) => index.toString()}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        scrollEventThrottle={16}
        initialScrollIndex={selectedIndex !== -1 ? selectedIndex : 0}
        getItemLayout={(data, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
        renderItem={({ item, index }) => {
          const isSelected = index === selectedIndex + 1;
          return (
            <View style={[scrollWheelStyles.item, { height: itemHeight }]}>
              <ThemedText style={[
                scrollWheelStyles.itemText,
                { color: isSelected ? activeColor : inactiveColor },
                isSelected && scrollWheelStyles.itemTextSelected
              ]}>
                {item}
              </ThemedText>
            </View>
          );
        }}
      />
      <View 
        style={[
          scrollWheelStyles.indicator, 
          { 
            height: itemHeight, 
            top: itemHeight,
            borderColor: activeColor,
          }
        ]} 
        pointerEvents="none" 
      />
    </View>
  );
}

const scrollWheelStyles = StyleSheet.create({
  container: {
    width: 65,
    overflow: 'hidden',
    position: 'relative',
  },
  item: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 28,
    fontWeight: '500',
  },
  itemTextSelected: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    opacity: 0.3,
  },
});

export default function SessionScreen() {
  const params = useLocalSearchParams<{ workoutId: string }>();
  const { workouts, updateWorkout } = useWorkouts();
  const { primaryColor, secondaryColor } = useCustomTheme();
  const insets = useSafeAreaInsets();
  const workout = workouts.find(w => w.id === params.workoutId);
  const { width } = useWindowDimensions();
  const horizontalPadding = 16; // match container padding
  const pageWidth = width - horizontalPadding * 2;
  const [pageIndex, setPageIndex] = React.useState(0);

  const [counters, setCounters] = React.useState<Counters>({});
  const [currentExerciseId, setCurrentExerciseId] = React.useState<string | null>(null);
  const [exerciseWeights, setExerciseWeights] = React.useState<Record<string, string>>({});
  const [mode, setMode] = React.useState<'countdown' | 'stopwatch'>('countdown');
  const [isWeightModalVisible, setIsWeightModalVisible] = React.useState(false);
  const [isVideoModalVisible, setIsVideoModalVisible] = React.useState(false);
  const [isAlarmActive, setIsAlarmActive] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [videoUri, setVideoUri] = React.useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = React.useState<'front' | 'back'>('back');
  const [recordSeconds, setRecordSeconds] = React.useState(0);
  const [restBase, setRestBase] = React.useState<number>(workout?.exercises[0]?.restSeconds ?? 60);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const cameraRef = React.useRef<any>(null);

  const player = useVideoPlayer('', playerInstance => {
    playerInstance.loop = true;
  });

  React.useEffect(() => {
    // init counters per esercizio
    const init: Counters = {};
    workout?.exercises?.forEach(ex => {
      if (ex.id) {
        init[ex.id] = { currentSet: 0, done: false };
      }
    });
    setCounters(init);
  }, [workout?.id, workout?.exercises]);

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

  const startRest = (seconds: number) => {
    isAlarmActiveRef.current = false;
    setRestBase(seconds);
    restBaseRef.current = seconds;
    setIsAlarmActive(false);
    Vibration.cancel();
    restTimer.reset(seconds);
    restTimer.start();
  };

  React.useEffect(() => {
    if (videoUri) {
      player.replace(videoUri);
      player.play();
    } else {
      player.pause();
    }
  }, [videoUri]);

  React.useEffect(() => {
    let interval: any;
    if (isRecording) {
      setRecordSeconds(0);
      interval = setInterval(() => {
        setRecordSeconds(s => s + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatRecordTime = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startVideoRecording = async () => {
    if (!cameraRef.current || isRecording) return;
    setIsRecording(true);
    try {
      const video = await cameraRef.current.recordAsync();
      if (video) {
        setVideoUri(video.uri);
      }
    } catch (e) {
      console.error('Errore nella registrazione video:', e);
      setIsRecording(false);
    }
  };

  const stopVideoRecording = async () => {
    if (!cameraRef.current || !isRecording) return;
    cameraRef.current.stopRecording();
    setIsRecording(false);
  };

  const saveVideoToGallery = async () => {
    if (!videoUri) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(videoUri);
        alert('Video salvato in galleria!');
        setVideoUri(null);
      } else {
        alert('GymApp necessita dei permessi della galleria per salvare il video.');
      }
    } catch (err) {
      console.error('Errore nel salvare il video:', err);
      alert('Impossibile salvare il video.');
    }
  };

  const closeVideoModal = () => {
    if (isRecording) {
      cameraRef.current?.stopRecording();
    }
    setIsRecording(false);
    setVideoUri(null);
    player.pause();
    setIsVideoModalVisible(false);
  };

  const saveExerciseWeight = async (exerciseId: string) => {
    const weight = exerciseWeights[exerciseId]?.trim();
    if (!weight || !workout) {
      alert('Inserisci un peso valido');
      return;
    }
    
    const updatedExercises = workout.exercises.map(ex => {
      if (ex.id === exerciseId) {
        return { ...ex, maxWeight: weight };
      }
      return ex;
    });
    
    await updateWorkout(workout.id, {
      title: workout.title,
      exercises: updatedExercises,
    });
    
    setExerciseWeights(prev => ({ ...prev, [exerciseId]: '' }));
    alert(`Peso salvato! ${currentExercise.name}: ${weight}`);
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
          <View style={[styles.timerCard, { borderColor: primaryColor }]}>
            <View style={styles.modeSwitchRow}>
              <Pressable
                onPress={() => setMode('countdown')}
                style={[styles.modeBtn, mode === 'countdown' ? { backgroundColor: primaryColor, borderColor: primaryColor } : null]}
              >
                <ThemedText style={mode === 'countdown' ? styles.modeTextActive : styles.modeTextInactive} type="defaultSemiBold">Timer</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setMode('stopwatch')}
                style={[styles.modeBtn, mode === 'stopwatch' ? { backgroundColor: primaryColor, borderColor: primaryColor } : null]}
              >
                <ThemedText style={mode === 'stopwatch' ? styles.modeTextActive : styles.modeTextInactive} type="defaultSemiBold">Cronometro</ThemedText>
              </Pressable>
            </View>

            {mode === 'countdown' && !restTimer.running ? (
              <View style={styles.pickerContainer}>
                <ScrollWheel
                  items={NUMBER_ITEMS}
                  selectedValue={Math.floor(restTimer.seconds / 60).toString().padStart(2, '0')}
                  onValueChange={(minStr) => {
                    const newMin = parseInt(minStr, 10);
                    const currentSec = restTimer.seconds % 60;
                    const newTotal = newMin * 60 + currentSec;
                    setRestBase(newTotal);
                    restTimer.setSeconds(newTotal);
                  }}
                  itemHeight={44}
                  activeColor={primaryColor}
                  inactiveColor="#888"
                />
                <ThemedText style={styles.pickerSeparator} type="defaultSemiBold">:</ThemedText>
                <ScrollWheel
                  items={NUMBER_ITEMS}
                  selectedValue={(restTimer.seconds % 60).toString().padStart(2, '0')}
                  onValueChange={(secStr) => {
                    const currentMin = Math.floor(restTimer.seconds / 60);
                    const newSec = parseInt(secStr, 10);
                    const newTotal = currentMin * 60 + newSec;
                    setRestBase(newTotal);
                    restTimer.setSeconds(newTotal);
                  }}
                  itemHeight={44}
                  activeColor={primaryColor}
                  inactiveColor="#888"
                />
              </View>
            ) : (
              <ThemedText style={styles.timerDigitsLarge} type="defaultSemiBold">
                {mode === 'countdown'
                  ? formatTime(restTimer.seconds, restTimer.millis)
                  : formatTime(stopwatch.seconds, stopwatch.millis)}
              </ThemedText>
            )}
            
            <View style={styles.timerButtonsRow}>
              <Pressable
                style={[styles.pillBtn, styles.pillSmall]}
                onPress={() => (mode === 'countdown' ? restTimer.reset(restBase) : stopwatch.reset())}
              >
                <ThemedText style={styles.pillTextSmall} type="defaultSemiBold">ripristina</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.pillBtn,
                  styles.pillLarge,
                  (mode === 'countdown' ? !restTimer.running : !stopwatch.running)
                    ? { backgroundColor: primaryColor, borderColor: primaryColor }
                    : styles.btnPauseRed
                ]}
                onPress={() =>
                  mode === 'countdown'
                    ? restTimer.running ? restTimer.pause() : restTimer.start()
                    : stopwatch.running ? stopwatch.pause() : stopwatch.start()
                }
              >
                <ThemedText style={styles.pillTextLargeBlueBtn} type="defaultSemiBold">
                  {mode === 'countdown'
                    ? restTimer.running ? 'pausa' : 'avvia'
                    : stopwatch.running ? 'pausa' : 'avvia'}
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={[styles.exerciseBar, { borderColor: primaryColor }]}>
            <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ flex: 1 }}>
              {currentExercise.name}
            </ThemedText>
            {currentExercise.reps > 0 && (
              <View style={[styles.repsBadge, { backgroundColor: `${primaryColor}26`, borderColor: `${primaryColor}55` }]}>
                <ThemedText style={[styles.repsBadgeText, { color: primaryColor }]} type="defaultSemiBold">
                  {currentExercise.reps} reps
                </ThemedText>
              </View>
            )}
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

          <View style={styles.actionButtonsRow}>
            <Pressable
              style={[styles.pillBtn, styles.actionBtn, { borderColor: secondaryColor, borderWidth: 3, borderRadius: 22 }]}
              onPress={() => setIsWeightModalVisible(true)}
            >
              <ThemedText style={[styles.openWeightModalBtnText, { color: secondaryColor }]} type="defaultSemiBold">
                🏋️‍♂️ Peso {currentExercise.maxWeight ? `(${currentExercise.maxWeight})` : ''}
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.pillBtn, styles.actionBtn, { borderColor: secondaryColor, borderWidth: 3, borderRadius: 22 }]}
              onPress={() => setIsVideoModalVisible(true)}
            >
              <ThemedText style={[styles.openVideoModalBtnText, { color: secondaryColor }]} type="defaultSemiBold">
                📹 Video Review
              </ThemedText>
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
                  isActive && !isCompleted ? [styles.listCardActive, { borderColor: primaryColor }] : null,
                  isCompleted ? styles.listCardCompleted : null
                ]}>
                  <Pressable onPress={() => setCurrentExerciseId(item.id)} style={styles.rowBetween}>
                    <ThemedText style={isActive || isCompleted ? styles.listCardActiveText : undefined} type="defaultSemiBold" numberOfLines={1}>
                      {item.name}
                    </ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {item.reps > 0 && (
                        <View style={[styles.repsBadge, { 
                          backgroundColor: isActive ? `${primaryColor}26` : 'rgba(128,128,128,0.12)',
                          borderColor: isActive ? `${primaryColor}55` : 'rgba(128,128,128,0.25)',
                        }]}>
                          <ThemedText style={[styles.repsBadgeText, { color: isActive ? '#fff' : primaryColor }, isCompleted ? styles.listCardActiveText : undefined]} type="defaultSemiBold">
                            {item.reps} reps
                          </ThemedText>
                        </View>
                      )}
                      <ThemedText style={isActive || isCompleted ? styles.listCardActiveText : undefined} type="default">
                        {c.currentSet}/{item.sets} serie {isCompleted ? '✓' : ''}
                      </ThemedText>
                    </View>
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
              Registra Kg - {currentExercise.name}
            </ThemedText>
            
            <ThemedText type="default" style={[styles.modalRecordDisplay, { color: primaryColor }]}>
              {currentExercise.maxWeight ? `Peso salvato: ${currentExercise.maxWeight}` : 'Nessun peso registrato'}
            </ThemedText>
            
            <TextInput
              style={[styles.modalInput, { borderColor: primaryColor }]}
              placeholder="Es: 80.5, 2x20 kg, bodyweight"
              placeholderTextColor="#999"
              keyboardType="default"
              autoFocus={true}
              value={exerciseWeights[currentExercise.id] ?? ''}
              onChangeText={(text) => setExerciseWeights(prev => ({ ...prev, [currentExercise.id]: text }))}
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
                style={[styles.modalBtn, { backgroundColor: primaryColor }]}
                onPress={() => {
                  saveExerciseWeight(currentExercise.id);
                  setIsWeightModalVisible(false);
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

      <Modal
        visible={isVideoModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={closeVideoModal}
      >
        <ThemedView style={styles.cameraModalContainer}>
          {!cameraPermission?.granted || !microphonePermission?.granted ? (
            <View style={styles.permissionContainer}>
              <ThemedText type="subtitle" style={styles.permissionTitle}>
                GymApp necessita dei permessi per registrare video review
              </ThemedText>
              <ThemedText type="default" style={styles.permissionSubtitle}>
                Per favore, consenti l&apos;accesso alla fotocamera e al microfono per esaminare la tua forma.
              </ThemedText>
              <Pressable
                style={[styles.pillBtn, styles.btnStartBlue, { marginTop: 16, borderCurve: 'continuous', borderRadius: 12 }]}
                onPress={async () => {
                  await requestCameraPermission();
                  await requestMicrophonePermission();
                }}
              >
                <ThemedText style={{ color: '#fff' }} type="defaultSemiBold">
                  Concedi Permessi
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.pillBtn, { borderColor: '#555', marginTop: 12, borderCurve: 'continuous', borderRadius: 12 }]}
                onPress={closeVideoModal}
              >
                <ThemedText type="defaultSemiBold">
                  Indietro
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              {videoUri === null ? (
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFillObject}
                  mode="video"
                  facing={cameraFacing}
                >
                  <View style={styles.cameraOverlay}>
                    {/* Top row controls */}
                    <View style={styles.cameraTopRow}>
                      <Pressable 
                        style={styles.cameraIconBtn} 
                        onPress={closeVideoModal}
                      >
                        <ThemedText style={styles.cameraIconText}>✕</ThemedText>
                      </Pressable>
                      
                      {isRecording && (
                        <View style={styles.recordTimerBadge}>
                          <View style={styles.recordTimerDot} />
                          <ThemedText style={styles.recordTimerText} type="defaultSemiBold">
                            {formatRecordTime(recordSeconds)}
                          </ThemedText>
                        </View>
                      )}

                      <Pressable 
                        style={styles.cameraIconBtn} 
                        onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}
                        disabled={isRecording}
                      >
                        <ThemedText style={styles.cameraIconText}>🔄</ThemedText>
                      </Pressable>
                    </View>

                    {/* Bottom row record button */}
                    <View style={styles.cameraBottomRow}>
                      <Pressable
                        style={styles.recordBtnOuter}
                        onPress={isRecording ? stopVideoRecording : startVideoRecording}
                      >
                        <View style={[
                          styles.recordBtnInner,
                          isRecording ? styles.recordBtnInnerRecording : null
                        ]} />
                      </Pressable>
                    </View>
                  </View>
                </CameraView>
              ) : (
                <View style={{ flex: 1 }}>
                  <VideoView
                    player={player}
                    style={StyleSheet.absoluteFillObject}
                    allowsFullscreen={false}
                    allowsPictureInPicture={false}
                    contentFit="contain"
                  />
                  
                  <View style={styles.previewOverlay}>
                    <ThemedText style={styles.previewTitle} type="subtitle">
                      Esamina la tua forma
                    </ThemedText>

                    <View style={styles.previewButtonsRow}>
                      <Pressable
                        style={[styles.previewBtn, styles.previewBtnDelete]}
                        onPress={() => setVideoUri(null)}
                      >
                        <ThemedText style={styles.previewBtnText} type="defaultSemiBold">
                          🗑️ Riprova
                        </ThemedText>
                      </Pressable>

                      <Pressable
                        style={[styles.previewBtn, styles.previewBtnSave]}
                        onPress={saveVideoToGallery}
                      >
                        <ThemedText style={styles.previewBtnText} type="defaultSemiBold">
                          💾 Salva in galleria
                        </ThemedText>
                      </Pressable>

                      <Pressable
                        style={[styles.previewBtn, styles.previewBtnClose]}
                        onPress={closeVideoModal}
                      >
                        <ThemedText style={styles.previewBtnText} type="defaultSemiBold">
                          Chiudi
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </ThemedView>
      </Modal>
      <MiniPlayer style={{ marginBottom: insets.bottom > 0 ? insets.bottom : 8 }} />

      {/* ── Allarme timer ── */}
      {isAlarmActive && (
        <Pressable
          style={styles.alarmOverlay}
          onPress={stopAlarm}
        >
          <View style={[styles.alarmCard, { borderColor: primaryColor }]}>
            <ThemedText style={styles.alarmEmoji}>⏰</ThemedText>
            <ThemedText style={styles.alarmTitle} type="defaultSemiBold">
              Recupero Finito!
            </ThemedText>
            <ThemedText style={styles.alarmSub} type="default">
              Premi per fermare la sveglia
            </ThemedText>
            <Pressable
              style={[styles.alarmBtn, { backgroundColor: primaryColor }]}
              onPress={stopAlarm}
            >
              <ThemedText style={styles.alarmBtnText} type="defaultSemiBold">
                Stop Sveglia
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      )}
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
    marginBottom: 16,
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
  btnStartBlue: {
    backgroundColor: '#0a84ff',
    borderColor: '#0a84ff',
  },
  btnPauseRed: {
    backgroundColor: '#ff453a',
    borderColor: '#ff453a',
  },
  pillTextLargeBlueBtn: {
    fontSize: 18,
    color: '#fff',
  },
  exerciseBar: {
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openWeightModalBtn: {
    borderColor: '#0a84ff',
    borderWidth: 3,
    borderRadius: 22,
    marginTop: 0,
    width: 'auto',
  },
  openWeightModalBtnText: {
    color: '#0a84ff',
    fontSize: 15,
  },
  openVideoModalBtn: {
    borderColor: '#34c759',
    borderWidth: 3,
    borderRadius: 22,
    marginTop: 0,
    width: 'auto',
  },
  openVideoModalBtnText: {
    color: '#34c759',
    fontSize: 15,
  },
  cameraModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#151718',
  },
  permissionTitle: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 20,
    marginBottom: 8,
  },
  permissionSubtitle: {
    color: '#aaa',
    textAlign: 'center',
    fontSize: 14,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 20,
  },
  cameraTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
  },
  cameraIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconText: {
    fontSize: 20,
    color: '#fff',
  },
  recordTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 69, 58, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff453a',
  },
  recordTimerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff453a',
  },
  recordTimerText: {
    color: '#fff',
    fontSize: 14,
  },
  cameraBottomRow: {
    alignItems: 'center',
    marginBottom: 40,
  },
  recordBtnOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  recordBtnInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ff453a',
  },
  recordBtnInnerRecording: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  previewOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 24,
    gap: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  previewTitle: {
    color: '#fff',
    textAlign: 'center',
  },
  previewButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  previewBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBtnDelete: {
    borderWidth: 1.5,
    borderColor: '#ff453a',
    backgroundColor: 'transparent',
  },
  previewBtnSave: {
    backgroundColor: '#34c759',
  },
  previewBtnClose: {
    backgroundColor: '#3a3a3c',
  },
  previewBtnText: {
    color: '#fff',
    fontSize: 14,
  },
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
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3a3a3c',
    gap: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    textAlign: 'center',
  },
  modalRecordDisplay: {
    color: '#0a84ff',
    fontSize: 14,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#0a84ff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 18,
    color: '#000',
    backgroundColor: '#fff',
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
    borderColor: '#3a3a3c',
    backgroundColor: 'transparent',
  },
  modalBtnCancelText: {
    color: '#ff453a',
  },
  modalBtnSave: {
    backgroundColor: '#0a84ff',
  },
  modalBtnSaveText: {
    color: '#fff',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 132,
    marginVertical: 12,
  },
  pickerSeparator: {
    fontSize: 28,
    marginHorizontal: 16,
    alignSelf: 'center',
  },
  repsBadge: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  repsBadgeText: {
    color: '#0a84ff',
    fontSize: 13,
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
    backgroundColor: '#1a1a1a',
    borderWidth: 3,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 24,
    width: '85%',
  },
  alarmEmoji: {
    fontSize: 64,
    lineHeight: 72,
  },
  alarmTitle: {
    fontSize: 26,
    color: '#fff',
    textAlign: 'center',
  },
  alarmSub: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
  alarmBtn: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 22,
    alignItems: 'center',
  },
  alarmBtnText: {
    color: '#fff',
    fontSize: 18,
  },
});


