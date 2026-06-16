import { useWeeklyPlans, type DayWorkout } from '@/context/WeeklyPlanContext';
import { useWorkouts } from '@/context/WorkoutContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';

const WEEK_DAYS: DayWorkout['day'][] = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export default function AddWeeklyPlanScreen() {
  const { addPlan } = useWeeklyPlans();
  const { workouts, isLoading } = useWorkouts();
  const [name, setName] = useState('Nuova Scheda');
  const [days, setDays] = useState(WEEK_DAYS.map(day => ({ day, workoutId: null as string | null })));
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  const openWorkoutPicker = (index: number) => {
    setSelectedDayIndex(index);
    setModalVisible(true);
  };

  const selectWorkout = (workoutId: string | null) => {
    if (selectedDayIndex !== null) {
      setDays(prev => prev.map((d, i) => i === selectedDayIndex ? { ...d, workoutId } : d));
    }
    setModalVisible(false);
    setSelectedDayIndex(null);
  };

  const getWorkoutName = (workoutId: string | null) => {
    if (!workoutId) return 'Riposo';
    if (!Array.isArray(workouts)) return 'Caricamento...';
    const workout = workouts.find(w => w.id === workoutId);
    return workout?.title || 'Allenamento non trovato';
  };

  const onSave = () => {
    if (!name.trim()) {
      Alert.alert('Nome mancante', 'Inserisci un nome per la scheda');
      return;
    }
    addPlan({ name: name.trim(), days });
    router.back();
  };

  const viewWorkoutDetails = (workoutId: string | null) => {
    if (!workoutId) {
      Alert.alert('Riposo', 'Nessun allenamento assegnato per questo giorno.');
      return;
    }
    const workout = workouts?.find(w => w.id === workoutId);
    if (!workout) {
      Alert.alert('Errore', 'Allenamento non trovato');
      return;
    }
    
    Alert.alert(
      workout.title,
      `${workout.exercises.length} esercizi\n\nVuoi visualizzare i dettagli?`,
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Visualizza', 
          onPress: () => {
            setModalVisible(false);
            router.push(`/weekly-plans/workout-details?workoutId=${workoutId}`);
          }
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.loadingText}>Caricamento allenamenti...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedText type="title" style={styles.title}>Nuova Scheda Settimanale</ThemedText>
          
          <TextInput
            placeholder="Nome scheda"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor="#999"
          />

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => router.back()}>
              <ThemedText style={styles.linkText}>Annulla</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave}>
              <ThemedText style={styles.linkText}>Salva</ThemedText>
            </TouchableOpacity>
          </View>

          {days.map((day, index) => (
            <TouchableOpacity
              key={`day_${index}`}
              style={styles.dayCard}
              onPress={() => openWorkoutPicker(index)}
            >
              <View style={styles.dayContent}>
                <ThemedText style={styles.dayName}>{day.day}</ThemedText>
                <ThemedText style={styles.workoutName}>{getWorkoutName(day.workoutId)}</ThemedText>
              </View>
              <ThemedText style={styles.arrow}>›</ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>Seleziona Allenamento</ThemedText>
            
            <FlatList
              data={[{ id: null, title: 'Riposo' }, ...(Array.isArray(workouts) ? workouts : [])]}
              keyExtractor={(item) => item.id || 'rest'}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.workoutOption}
                  onPress={() => selectWorkout(item.id)}
                  onLongPress={() => viewWorkoutDetails(item.id)}
                >
                  <ThemedText style={styles.workoutOptionText}>{item.title}</ThemedText>
                  {item.id && (
                    <ThemedText style={styles.workoutHint}>Tieni premuto per dettagli</ThemedText>
                  )}
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <ThemedText style={styles.closeButtonText}>Chiudi</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(122, 160, 255, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#fff',
    backgroundColor: '#1C2341',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  linkText: {
    color: '#7AA0FF',
    fontSize: 16,
    fontWeight: '600',
  },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C2341',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(122, 160, 255, 0.2)',
  },
  dayContent: {
    flex: 1,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  workoutName: {
    fontSize: 14,
    color: '#999',
  },
  arrow: {
    fontSize: 24,
    color: '#666',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 32,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  workoutOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#1C2341',
    borderRadius: 8,
    marginBottom: 4,
  },
  workoutOptionText: {
    fontSize: 16,
  },
  workoutHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  closeButton: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
