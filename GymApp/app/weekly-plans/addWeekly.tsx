import { useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { useWorkouts } from '@/context/WorkoutContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link, router } from 'expo-router';
import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

// --- CONFIGURAZIONE STILI ---
const COLORS = {
    background: '#121212',
    textPrimary: '#E0E0E0',
    textMuted: '#A0A0A0',
    cardBackground: '#1C1C1C',
    accent: '#7AA0FF',
    deleteColor: '#ff4444',
};

export default function WeeklyPlansScreen() {
    const { plans, deletePlan } = useWeeklyPlans();
    const { workouts } = useWorkouts();
    const [expandedId, setExpandedId] = React.useState<string | null>(null);

    const handleDelete = (id: string, name: string) => {
        Alert.alert(
            'Elimina scheda',
            `Vuoi eliminare "${name}"?`,
            [
                { text: 'Annulla', style: 'cancel' },
                { text: 'Elimina', style: 'destructive', onPress: () => deletePlan(id) },
            ]
        );
    };

    const getWorkoutName = (workoutId: string | null) => {
        if (!workoutId) return 'Riposo';
        // Aggiungi un controllo per assicurarti che workouts esista e sia un array
        if (!workouts || !Array.isArray(workouts)) return 'Caricamento...'; 
        
        const workout = workouts.find(w => w.id === workoutId);
        return workout?.title || 'Allenamento non trovato';
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <ThemedText type="title">Schede Settimanali</ThemedText>
                <Link href="/weekly-plans/add" asChild>
                    <Pressable style={styles.createButton}>
                        <ThemedText style={styles.createButtonText}>+ Crea Scheda</ThemedText>
                    </Pressable>
                </Link>
            </View>
            <FlatList
                data={plans}
                keyExtractor={(p) => p.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                    // ------------------------------------------------------------------
                    // CORREZIONE CRITICA: Controlli di validità dei dati prima del rendering
                    if (!item || !Array.isArray(item.days)) {
                        return null; // Salta l'elemento non valido per evitare il crash
                    }
                    // ------------------------------------------------------------------

                    const isExpanded = expandedId === item.id;
                    const assignedDays = item.days.filter(d => d.workoutId).length;
                    
                    return (
                        <ThemedView style={styles.card}>
                            <Pressable style={styles.cardHeader} onPress={() => setExpandedId(isExpanded ? null : item.id)}>
                                <ThemedText type="defaultSemiBold" style={styles.cardTitle}>{isExpanded ? '▾' : '▸'} {item.name}</ThemedText>
                                <ThemedText type="default" style={styles.cardCount}>{assignedDays}/7 giorni</ThemedText>
                            </Pressable>
                            {isExpanded ? (
                                <View style={styles.cardBody}>
                                    {item.days.map((day, idx) => (
                                        <View key={`${item.id}-${idx}`} style={styles.dayRow}>
                                            <ThemedText type="defaultSemiBold" style={styles.dayName}>{day.day}</ThemedText>
                                            {day.workoutId ? (
                                                <Pressable onPress={() => router.push(`/weekly-plans/workout-details?workoutId=${day.workoutId}`)}>
                                                    <ThemedText type="default" style={[styles.workoutName, styles.workoutLink]}>
                                                        {getWorkoutName(day.workoutId)}
                                                    </ThemedText>
                                                </Pressable>
                                            ) : (
                                                <ThemedText type="default" style={styles.workoutName}>
                                                    {getWorkoutName(day.workoutId)}
                                                </ThemedText>
                                            )}
                                        </View>
                                    ))}
                                    <View style={styles.actions}>
                                        <Pressable style={styles.actionButton} onPress={() => router.push({ pathname: '/weekly-plans/edit', params: { planId: item.id } })}>
                                            <ThemedText style={styles.actionText}>Modifica</ThemedText>
                                        </Pressable>
                                        <Pressable style={styles.actionButton} onPress={() => handleDelete(item.id, item.name)}>
                                            <ThemedText style={styles.deleteText}>Elimina</ThemedText>
                                        </Pressable>
                                    </View>
                                </View>
                            ) : null}
                        </ThemedView>
                    );
                }}
                ListEmptyComponent={
                    <ThemedText style={styles.emptyText}>
                        Nessuna scheda creata. Tocca "+ Crea Scheda" per iniziare.
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
        backgroundColor: 'transparent', // Cambia qui
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    createButton: {
        backgroundColor: COLORS.cardBackground, // Usa il grigio scuro
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 8,
    },
    createButtonText: {
        color: COLORS.accent, // Accento blu/ciano
        fontWeight: 'bold',
    },
    listContent: {
        gap: 12,
    },
    card: {
        padding: 16,
        borderRadius: 12,
        backgroundColor: COLORS.cardBackground,
        // Rimosso borderWidth/borderColor di default per un look più pulito
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    cardTitle: {
        fontSize: 18,
        color: COLORS.textPrimary,
    },
    cardCount: {
        color: COLORS.textMuted,
        fontSize: 14,
    },
    cardBody: {
        gap: 8,
        marginTop: 12,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.textMuted,
    },
    dayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    dayName: {
        color: COLORS.textMuted,
    },
    workoutName: {
        color: COLORS.textPrimary,
        fontWeight: '600',
    },
    workoutLink: {
        color: COLORS.accent,
        textDecorationLine: 'underline',
    },
    actions: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 12,
        justifyContent: 'flex-end',
    },
    actionButton: {
        paddingVertical: 8,
    },
    actionText: {
        color: COLORS.accent,
        fontWeight: '600',
    },
    deleteText: {
        color: COLORS.deleteColor,
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 32,
        color: COLORS.textMuted,
    },
});