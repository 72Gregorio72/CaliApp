// app/weekly-plans/addWeekly.tsx (FILE COMPLETO E FINALE)

import { useWeeklyPlans, type DayWorkout } from '@/context/WeeklyPlanContext';
import { useWorkouts } from '@/context/WorkoutContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, TextInput, View } from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';

// --- COSTANTI DI STILE DARK MINIMAL ---
const COLORS = {
    background: '#121212',
    textPrimary: '#E0E0E0',
    textMuted: '#A0A0A0',
    inputBackground: '#1C1C1C',
    cardBackground: '#1C1C1C',
    accent: '#7AA0FF',
};

const WEEK_DAYS: DayWorkout['day'][] = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export default function AddWeeklyPlanScreen() {
    const { addPlan } = useWeeklyPlans();
    const { workouts } = useWorkouts();
    const [name, setName] = useState('Nuova Scheda');
    const [days, setDays] = useState(WEEK_DAYS.map(day => ({ day, workoutId: null as string | null })));

    const updateDay = (index: number, workoutId: string | null) => {
        setDays(prev => prev.map((d, i) => i === index ? { ...d, workoutId } : d));
    };

    const onSave = () => {
        if (!name.trim()) {
            Alert.alert('Nome mancante', 'Inserisci un nome per la scheda');
            return;
        }
        addPlan({ name: name.trim(), days });
        router.back();
    };

    return (
        <SafeAreaView style={styles.safeContainer}> 
            <ThemedView style={styles.container}>
                <ThemedText style={styles.title}>Nuova Scheda Settimanale</ThemedText>
                
                {/* Input Nome Scheda */}
                <TextInput
                    placeholder="Nome scheda"
                    value={name}
                    onChangeText={setName}
                    style={styles.input}
                    placeholderTextColor={COLORS.textMuted}
                />
                
                {/* Azioni (Salva/Annulla) */}
                <View style={styles.actions}>
                    <ThemedText style={styles.cancelText} onPress={() => router.back()}>Annulla</ThemedText>
                    <ThemedText style={styles.saveText} onPress={onSave}>Salva</ThemedText>
                </View>

                {/* Lista dei Giorni Settimanali */}
                <FlatList
                    data={days}
                    keyExtractor={(_, i) => `day_${i}`}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item, index }) => (
                        <ThemedView style={styles.card}>
                            <ThemedText style={styles.dayText}>{item.day}</ThemedText>
                            <Picker
                                selectedValue={item.workoutId}
                                onValueChange={(value) => updateDay(index, value)}
                                style={styles.picker}
                                itemStyle={styles.pickerItem}
                            >
                                {/* Assicurati che il valore 'null' sia gestito bene */}
                                <Picker.Item label="Riposo" value={null} color={COLORS.textMuted} />
                                {workouts.map(w => (
                                    <Picker.Item 
                                        key={w.id} 
                                        label={w.title} 
                                        value={w.id} 
                                        color={COLORS.textPrimary}
                                    />
                                ))}
                            </Picker>
                        </ThemedView>
                    )}
                />
            </ThemedView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: COLORS.background, // Sfondo scuro
    },
    container: {
        flex: 1,
        backgroundColor: 'transparent',
        padding: 16,
        gap: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end', // Allineato a destra
        gap: 20,
        marginBottom: 8,
    },
    cancelText: {
        color: COLORS.textMuted,
        fontSize: 16,
    },
    saveText: {
        color: COLORS.accent,
        fontSize: 16,
        fontWeight: 'bold',
    },
    listContent: {
        gap: 12,
        paddingBottom: 20,
    },
    card: {
        backgroundColor: COLORS.cardBackground,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dayText: {
        fontWeight: 'bold',
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    input: {
        backgroundColor: COLORS.inputBackground,
        borderWidth: 0, // Rimosso border per look minimal
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: COLORS.textPrimary,
        fontSize: 18,
        fontWeight: 'bold',
    },
    picker: {
        width: '50%', // Ridotto per stare affianco al giorno
        height: 40,
        color: COLORS.textPrimary, // Colore del testo visualizzato
    },
    pickerItem: {
        height: 40, // Fissa l'altezza per compatibilità
        backgroundColor: COLORS.background, // Colore di sfondo nel popover (varia tra iOS/Android)
    }
});