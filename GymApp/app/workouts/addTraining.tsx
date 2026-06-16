import { useWorkouts } from '@/context/WorkoutContext';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, StyleSheet, View, Alert } from 'react-native';

export default function WorkoutsScreen() {
  const { workouts, deleteWorkout } = useWorkouts();
  const { primaryColor, secondaryColor } = useCustomTheme();

  const handleDelete = (id: string, title: string) => {
    Alert.alert(
      'Elimina allenamento',
      `Vuoi eliminare "${title}"?`,
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: () => deleteWorkout(id) },
      ]
    );
  };

  const handleEdit = (id: string) => {
    import('expo-router').then(({ router }) => router.push({ pathname: '/workouts/edit', params: { workoutId: id } }));
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Allenamenti</ThemedText>
        <Link href="/workouts/add">
          <Link.Trigger>
            <ThemedText type="link">+ Aggiungi</ThemedText>
          </Link.Trigger>
        </Link>
      </View>
      <FlatList
        data={workouts}
        keyExtractor={(w) => w.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          return (
            <ThemedView style={[styles.card, { borderColor: `${primaryColor}33` }]}>
              <View style={styles.cardHeader}>
                <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
                <ThemedText type="default">{item.exercises.length} esercizi</ThemedText>
              </View>
              <View style={styles.actionButtons}>
                <Pressable 
                  style={[styles.startButton, { borderColor: primaryColor, backgroundColor: `${primaryColor}1a` }]} 
                  onPress={() => {
                    import('expo-router').then(({ router }) => router.push({ pathname: '/workouts/session', params: { workoutId: item.id } }));
                  }}
                >
                  <ThemedText type="defaultSemiBold" style={[styles.startButtonText, { color: primaryColor }]}>Inizia</ThemedText>
                </Pressable>
                <Pressable 
                  style={[styles.editButton, { borderColor: secondaryColor, backgroundColor: `${secondaryColor}1a` }]} 
                  onPress={() => handleEdit(item.id)}
                >
                  <ThemedText style={[styles.editButtonText, { color: secondaryColor }]}>Modifica</ThemedText>
                </Pressable>
                <Pressable style={styles.deleteButton} onPress={() => handleDelete(item.id, item.title)}>
                  <ThemedText style={styles.deleteButtonText}>Elimina</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          );
        }}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>
            {"Nessun allenamento creato. Tocca \"+ Aggiungi\" per iniziare."}
          </ThemedText>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    backgroundColor: 'transparent', // Cambia da colore solido a transparent
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listContent: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  cardBody: {
    gap: 8,
    marginTop: 8,
  },
  exerciseRow: {
    gap: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  startButton: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  startButtonText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  editButton: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#7AA0FF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(122, 160, 255, 0.1)',
  },
  editButtonText: {
    color: '#7AA0FF',
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ff4444',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  deleteButtonText: {
    color: '#ff4444',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    color: '#999',
  },
});


