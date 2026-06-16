import { StyleSheet, TouchableOpacity, View, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { useWorkouts } from '@/context/WorkoutContext';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { ColorPicker } from '@/components/ColorPicker';
import { MiniPlayer } from '@/components/MiniPlayer';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const COLORS = {
  background: '#0d0d0d',
  cardBackground: '#1a1a1a',
  textPrimary: '#E0E0E0',
  textMuted: '#A0A0A0',
  accent: '#7AA0FF',
  success: '#4CAF50',
};

// --- HOME SCREEN PRINCIPALE ---
export default function HomeScreen() {
  const { plans } = useWeeklyPlans();
  const { workouts } = useWorkouts();
  const { primaryColor, secondaryColor, setPrimaryColor, setSecondaryColor } = useCustomTheme();
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.contentContainer}>

          {/* Header con titolo */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.themeSelectorBtn} 
              onPress={() => setThemeModalVisible(true)}
            >
              <ThemedText style={styles.themeSelectorIcon}>🎨</ThemedText>
            </TouchableOpacity>
			<ThemedText style={[styles.appTitle, { textShadowColor: `${primaryColor}4d` }]} numberOfLines={1} adjustsFontSizeToFit>GYMApp</ThemedText>
            <ThemedText style={styles.subtitle}>Il tuo compagno di allenamentoaaa</ThemedText>
          </View>

          {/* Statistiche veloci */}
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { borderColor: `${primaryColor}33` }]}>
              <ThemedText style={[styles.statNumber, { color: primaryColor }]}>{workouts?.length || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Piani</ThemedText>
            </View>
            <View style={[styles.statCard, { borderColor: `${primaryColor}33` }]}>
              <ThemedText style={[styles.statNumber, { color: primaryColor }]}>{plans?.length || 0}</ThemedText>
              <ThemedText style={styles.statLabel}>Schede</ThemedText>
            </View>
            <View style={[styles.statCard, { borderColor: `${primaryColor}33` }]}>
              <ThemedText style={[styles.statNumber, { color: primaryColor }]}>
                {workouts?.reduce((sum, w) => sum + w.exercises.length, 0) || 0}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Esercizi</ThemedText>
            </View>
          </View>

          {/* Azioni principali */}
          <View style={styles.actionsContainer}>
            <ThemedText style={styles.sectionTitle}>Azioni Rapide</ThemedText>
            
            <Link href="/workouts/add" asChild>
              <TouchableOpacity style={[styles.actionButton, { borderColor: `${primaryColor}33` }]}>
                <View style={styles.actionIcon}>
                  <ThemedText style={styles.iconText}>➕</ThemedText>
                </View>
                <View style={styles.actionContent}>
                  <ThemedText style={styles.actionTitle}>Crea Allenamento</ThemedText>
                  <ThemedText style={styles.actionDescription}>
                    Personalizza i tuoi esercizi
                  </ThemedText>
                </View>
              </TouchableOpacity>
            </Link>


            <Link href="/workouts/addTraining" asChild>
              <TouchableOpacity style={[styles.actionButton, { borderColor: `${primaryColor}33` }]}>
                <View style={styles.actionIcon}>
				  <ThemedText style={styles.iconText}>💪</ThemedText>
                </View>
                <View style={styles.actionContent}>
                  <ThemedText style={styles.actionTitle}>Allenamenti</ThemedText>
                  <ThemedText style={styles.actionDescription}>
                    Personalizza i tuoi allenamenti
                  </ThemedText>
                </View>
              </TouchableOpacity>
            </Link>

            <Link href="/weekly-plans/addWeekly" asChild>
              <TouchableOpacity style={[styles.actionButton, { borderColor: `${primaryColor}33` }]}>
                <View style={styles.actionIcon}>
                  <ThemedText style={styles.iconText}>📅</ThemedText>
                </View>
                <View style={styles.actionContent}>
                  <ThemedText style={styles.actionTitle}>Schede Settimanali</ThemedText>
                  <ThemedText style={styles.actionDescription}>
                    {plans.length === 0
                      ? 'Organizza la tua settimana'
                      : `${plans.length} scheda${plans.length > 1 ? 'e' : ''} attiva${plans.length > 1 ? 'e' : ''}`}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            </Link>
          </View>

        </ThemedView>
      </ScrollView>

      {/* Modal di Selezione Colori */}
      <Modal
        visible={themeModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>{"Personalizza Colori"}</ThemedText>
            
            <ScrollView style={styles.modalScroll} contentContainerStyle={{ gap: 12, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
              <ThemedText type="defaultSemiBold" style={styles.colorGroupTitle}>{"Colore Primario"}</ThemedText>
              <ColorPicker value={primaryColor} onChange={setPrimaryColor} />

              <View style={{ height: 1, backgroundColor: '#333', marginVertical: 12 }} />

              <ThemedText type="defaultSemiBold" style={styles.colorGroupTitle}>{"Colore Secondario"}</ThemedText>
              <ColorPicker value={secondaryColor} onChange={setSecondaryColor} />
            </ScrollView>

            <TouchableOpacity 
              style={[styles.closeModalBtn, { backgroundColor: primaryColor }]} 
              onPress={() => setThemeModalVisible(false)}
            >
              <ThemedText type="defaultSemiBold" style={{ color: '#fff' }}>{"Salva e Chiudi"}</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </View>
      </Modal>
      <MiniPlayer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: 'transparent',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 16,
    position: 'relative',
    width: '100%',
  },
  appTitle: {
    fontSize: 48, // Riduci da 56 a 48
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 4,
    textShadowColor: 'rgba(122, 160, 255, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    lineHeight: 56, // Aggiungi lineHeight per dare più spazio
    includeFontPadding: false, // Rimuovi padding extra del font su Android
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 8,
    letterSpacing: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(122, 160, 255, 0.2)',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
    letterSpacing: 0.5,
	textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(122, 160, 255, 0.2)',
  },
  primaryAction: {
    backgroundColor: '#1a2332',
    borderColor: COLORS.accent,
    borderWidth: 2,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconText: {
    fontSize: 28,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  motivationCard: {
    backgroundColor: COLORS.cardBackground,
    padding: 24,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  motivationText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 12,
  },
  motivationAuthor: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'right',
  },
  themeSelectorBtn: {
    position: 'absolute',
    top: 10,
    right: 0,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    zIndex: 10,
  },
  themeSelectorIcon: {
    fontSize: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#444',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  modalScroll: {
    marginVertical: 8,
  },
  colorGroupTitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
    fontWeight: 'bold',
  },
  closeModalBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
});

// useWeeklyPlans is provided by '@/context/WeeklyPlanContext'.
// Local stub removed to avoid conflict with the imported hook.
