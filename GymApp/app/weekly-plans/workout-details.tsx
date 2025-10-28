import { useWorkouts } from '@/app/context/WorkoutContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const COLORS = {
  background: '#121212',
  textPrimary: '#E0E0E0',
  textMuted: '#A0A0A0',
  cardBackground: '#1C1C1C',
  accent: '#7AA0FF',
};

export default function WorkoutDetailsScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const { workouts } = useWorkouts();
  const workout = workouts?.find(w => w.id === workoutId);

  if (!workout) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>Allenamento non trovato</ThemedText>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ThemedText style={styles.backButtonText}>Indietro</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const startWorkout = () => {
    router.push({ pathname: '/workouts/session', params: { workoutId: workout.id } });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>{workout.title}</ThemedText>
        
        <View style={styles.infoCard}>
          <ThemedText style={styles.infoText}>
            {workout.exercises.length} esercizi
          </ThemedText>
        </View>

        <ThemedText type="subtitle" style={styles.sectionTitle}>Esercizi</ThemedText>

        {workout.exercises.map((exercise, index) => (
          <View key={exercise.id || `ex_${index}`} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <ThemedText type="defaultSemiBold" style={styles.exerciseNumber}>
                {index + 1}.
              </ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.exerciseName}>
                {exercise.name}
              </ThemedText>
            </View>
            
            <View style={styles.exerciseDetails}>
              <ThemedText style={styles.detailText}>
                Serie: {exercise.sets}
              </ThemedText>
              <ThemedText style={styles.detailText}>
                Ripetizioni: {exercise.reps}
              </ThemedText>
              <ThemedText style={styles.detailText}>
                Recupero: {exercise.restSeconds}s
              </ThemedText>
              {exercise.durationSeconds && (
                <ThemedText style={styles.detailText}>
                  Durata: {exercise.durationSeconds}s
                </ThemedText>
              )}
            </View>

            {exercise.description && (
              <ThemedText style={styles.description}>
                {exercise.description}
              </ThemedText>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.startButton} onPress={startWorkout}>
          <ThemedText style={styles.startButtonText}>Inizia Allenamento</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  title: {
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: COLORS.cardBackground,
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: COLORS.cardBackground,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  exerciseNumber: {
    fontSize: 18,
    color: COLORS.accent,
  },
  exerciseName: {
    fontSize: 18,
    color: COLORS.textPrimary,
    flex: 1,
  },
  exerciseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  description: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 8,
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  startButton: {
    backgroundColor: COLORS.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 32,
    color: COLORS.textMuted,
  },
  backButton: {
    marginTop: 16,
    alignSelf: 'center',
    padding: 12,
  },
  backButtonText: {
    color: COLORS.accent,
    fontSize: 16,
  },
});
