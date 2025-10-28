import { useWorkouts } from '@/app/context/WorkoutContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

type DraftExercise = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  restSeconds: string;
  durationEnabled?: boolean;
  durationSeconds?: string;
  description?: string;
};

export default function EditWorkoutScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const { workouts, updateWorkout } = useWorkouts();
  const workout = workouts.find(w => w.id === workoutId);

  const [title, setTitle] = useState(workout?.title || '');
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!workout) {
      Alert.alert('Errore', 'Allenamento non trovato');
      router.back();
      return;
    }

    // Converti gli esercizi in formato draft
    const draftExercises: DraftExercise[] = workout.exercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      sets: ex.sets.toString(),
      reps: ex.reps.toString(),
      restSeconds: ex.restSeconds.toString(),
      durationEnabled: !!ex.durationSeconds,
      durationSeconds: ex.durationSeconds?.toString() || '',
      description: ex.description || '',
    }));
    setExercises(draftExercises);
  }, [workout]);

  const addDraftExercise = () => {
    setExercises(prev => {
      const next = [
        ...prev,
        { 
          id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: '', 
          sets: '3', 
          reps: '10', 
          restSeconds: '60', 
          durationEnabled: false, 
          durationSeconds: '', 
          description: '' 
        },
      ];
      setExpandedIndex(next.length - 1);
      return next;
    });
  };

  const removeExercise = (index: number) => {
    Alert.alert(
      'Elimina esercizio',
      'Vuoi eliminare questo esercizio?',
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Elimina', 
          style: 'destructive',
          onPress: () => setExercises(prev => prev.filter((_, i) => i !== index))
        },
      ]
    );
  };

  const updateExercise = (index: number, field: keyof DraftExercise, value: string | boolean) => {
    setExercises(prev => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  };

  const onSave = () => {
    if (!title.trim()) {
      Alert.alert('Titolo mancante', 'Inserisci un titolo per l\'allenamento');
      return;
    }
    const cleaned = exercises
      .filter(e => e.name.trim())
      .map(e => ({
        id: e.id,
        name: e.name.trim(),
        sets: Number(e.sets) || 0,
        reps: Number(e.reps) || 0,
        restSeconds: Number(e.restSeconds) || 0,
        ...(e.durationEnabled && Number(e.durationSeconds) > 0
          ? { durationSeconds: Number(e.durationSeconds) }
          : {}),
        ...(e.description && e.description.trim().length > 0 ? { description: e.description.trim() } : {}),
      }));
    if (cleaned.length === 0) {
      Alert.alert('Nessun esercizio', 'Aggiungi almeno un esercizio');
      return;
    }
    if (workoutId) {
      updateWorkout(workoutId, { title: title.trim(), exercises: cleaned });
      router.back();
    }
  };

  if (!workout) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Caricamento...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardView}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ThemedView style={styles.container}>
        <ThemedText type="title">Modifica Allenamento</ThemedText>
        <TextInput
          placeholder="Titolo allenamento"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          placeholderTextColor="#bbb"
        />
        <View style={styles.actions}>
          <ThemedText type="link" onPress={addDraftExercise}>+ Aggiungi esercizio</ThemedText>
          <ThemedText type="link" onPress={onSave}>Salva</ThemedText>
        </View>
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            const isExpanded = expandedIndex === index;
            return (
              <ThemedView style={styles.card}>
                <Pressable
                  onPress={() => setExpandedIndex(isExpanded ? null : index)}
                  style={styles.cardHeader}
                >
                  <ThemedText type="defaultSemiBold">
                    {isExpanded ? '▾' : '▸'} Esercizio {index + 1}
                  </ThemedText>
                  <Pressable onPress={() => removeExercise(index)}>
                    <ThemedText style={styles.deleteText}>Elimina</ThemedText>
                  </Pressable>
                </Pressable>
                <TextInput
                  placeholder="Nome esercizio"
                  value={item.name}
                  onChangeText={(t) => updateExercise(index, 'name', t)}
                  style={styles.input}
                  placeholderTextColor="#bbb"
                />
                {isExpanded ? (
                  <>
                    <View style={styles.rowLabels}>
                      <ThemedText type="default">Serie</ThemedText>
                      <ThemedText type="default">Ripetizioni</ThemedText>
                      <ThemedText type="default">Recupero (s)</ThemedText>
                    </View>
                    <View style={styles.row}>
                      <TextInput
                        keyboardType="number-pad"
                        value={item.sets}
                        onChangeText={(t) => updateExercise(index, 'sets', t)}
                        style={[styles.input, styles.inputSmall]}
                        placeholderTextColor="#bbb"
                      />
                      <TextInput
                        keyboardType="number-pad"
                        value={item.reps}
                        onChangeText={(t) => updateExercise(index, 'reps', t)}
                        style={[styles.input, styles.inputSmall]}
                        placeholderTextColor="#bbb"
                      />
                      <TextInput
                        keyboardType="number-pad"
                        value={item.restSeconds}
                        onChangeText={(t) => updateExercise(index, 'restSeconds', t)}
                        style={[styles.input, styles.inputSmall]}
                        placeholderTextColor="#bbb"
                      />
                    </View>
                    <View style={styles.rowBetween}>
                      <ThemedText type="default">Durata esercizio (opzionale)</ThemedText>
                      <Switch
                        value={!!item.durationEnabled}
                        onValueChange={(v) => updateExercise(index, 'durationEnabled', v)}
                      />
                    </View>
                    {item.durationEnabled ? (
                      <View>
                        <ThemedText type="default">Durata (secondi)</ThemedText>
                        <TextInput
                          keyboardType="number-pad"
                          value={item.durationSeconds ?? ''}
                          onChangeText={(t) => updateExercise(index, 'durationSeconds', t)}
                          style={styles.input}
                          placeholderTextColor="#bbb"
                        />
                      </View>
                    ) : null}
                    <View>
                      <ThemedText type="default">Descrizione (opzionale)</ThemedText>
                      <TextInput
                        placeholder="Aggiungi dettagli, tecnica, note..."
                        value={item.description ?? ''}
                        onChangeText={(t) => updateExercise(index, 'description', t)}
                        style={styles.input}
                        placeholderTextColor="#bbb"
                        multiline
                      />
                    </View>
                  </>
                ) : null}
              </ThemedView>
            );
          }}
          ListEmptyComponent={<ThemedText>Nessun esercizio aggiunto.</ThemedText>}
        />
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  listContent: {
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  rowLabels: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
  },
  inputSmall: {
    flex: 1,
  },
  deleteText: {
    color: '#ff4444',
    fontSize: 14,
  },
});
