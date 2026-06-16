import { useWorkouts } from '@/context/WorkoutContext';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Alert, FlatList, Pressable, StyleSheet, Switch, TextInput, View, KeyboardAvoidingView, Platform, Modal, ScrollView } from 'react-native';

type DraftExercise = {
  id: string; // Rimuovi opzionale
  name: string;
  sets: string;
  reps: string;
  restSeconds: string;
  durationEnabled?: boolean;
  durationSeconds?: string;
  description?: string;
};

const PROMPT_AI = `Analizza questa foto di una scheda di allenamento. Estrai il titolo dell'allenamento e l'elenco degli esercizi con serie, ripetizioni, recupero ed eventuali note.
Restituisci ESCLUSIVAMENTE un JSON valido con questa struttura (senza altri testi o spiegazioni):

{
  "title": "Nome Allenamento",
  "exercises": [
    {
      "name": "Nome Esercizio",
      "sets": 4,
      "reps": 10,
      "restSeconds": 90,
      "description": "Eventuale nota o tecnica"
    }
  ]
}`;

export default function AddWorkoutScreen() {
  const { addWorkout } = useWorkouts();
  const { primaryColor } = useCustomTheme();
  const [title, setTitle] = useState('Allenamento Personalizzato');
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importText, setImportText] = useState('');

  const copyToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(PROMPT_AI);
      Alert.alert('Copiato!', 'Il prompt è stato copiato negli appunti.');
    } catch {
      Alert.alert('Errore', 'Impossibile copiare il testo.');
    }
  };

  const addDraftExercise = () => {
    setExercises(prev => {
      const next = [
        ...prev,
        { 
          id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // ID univoco garantito
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
        id: e.id, // Mantieni l'ID originale
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
    addWorkout({ title: title.trim(), exercises: cleaned });
    router.back();
  };

  const handleImport = () => {
    if (!importText.trim()) {
      Alert.alert('Errore', 'Incolla il testo prima di procedere.');
      return;
    }

    try {
      let cleanedText = importText.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```[a-zA-Z]*\s*/, '');
        cleanedText = cleanedText.replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleanedText);

      if (!parsed.title || !Array.isArray(parsed.exercises)) {
        throw new Error('Il JSON deve contenere "title" (stringa) e "exercises" (array).');
      }

      const importedExercises = parsed.exercises.map((ex: any, idx: number) => {
        if (!ex.name) {
          throw new Error(`L'esercizio al posto ${idx + 1} deve avere un nome.`);
        }
        return {
          id: `draft_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`,
          name: String(ex.name),
          sets: ex.sets ? String(ex.sets) : '3',
          reps: ex.reps ? String(ex.reps) : '10',
          restSeconds: ex.restSeconds ? String(ex.restSeconds) : '60',
          durationEnabled: !!ex.durationSeconds,
          durationSeconds: ex.durationSeconds ? String(ex.durationSeconds) : '',
          description: ex.description ? String(ex.description) : '',
        };
      });

      setTitle(parsed.title);
      setExercises(importedExercises);
      setImportModalVisible(false);
      setImportText('');
      Alert.alert('Importazione completata!', `Caricato l'allenamento "${parsed.title}" con ${importedExercises.length} esercizi.`);
    } catch (e: any) {
      Alert.alert('Errore di formato', 'Il formato del testo non è valido. Assicurati che sia un JSON corretto.\\n\\nDettaglio: ' + e.message);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardView}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ThemedView style={styles.container}>
        <ThemedText type="title">Nuovo Allenamento</ThemedText>
        <TextInput
          placeholder="Titolo allenamento"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          placeholderTextColor="#bbb"
        />
        <View style={styles.actions}>
          <ThemedText type="link" onPress={addDraftExercise}>+ Esercizio</ThemedText>
          <ThemedText type="link" onPress={() => setImportModalVisible(true)}>Importa da AI</ThemedText>
          <ThemedText type="link" onPress={onSave}>Fine</ThemedText>
        </View>
        <FlatList
          data={exercises}
          keyExtractor={(_, i) => `ex_${i}`}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            const isExpanded = expandedIndex === index;
            return (
              <ThemedView style={[styles.card, { borderColor: `${primaryColor}33` }]}>
                <Pressable
                  onPress={() => setExpandedIndex(isExpanded ? null : index)}
                  style={styles.cardHeader}
                >
                  <ThemedText type="defaultSemiBold">
                    {isExpanded ? '▾' : '▸'} Esercizio {index + 1}
                  </ThemedText>
                  <ThemedText numberOfLines={1} style={styles.headerName}>
                    {item.name || 'Senza nome'}
                  </ThemedText>
                </Pressable>
                {/* Nome sempre visibile */}
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

      <Modal
        visible={importModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="subtitle" style={styles.modalTitle}>Importa da Testo/AI</ThemedText>
            
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <ThemedText type="defaultSemiBold">Istruzioni:</ThemedText>
              <ThemedText type="default" style={styles.instructionsText}>
                {"1. Copia il prompt di seguito.\n"}
                {"2. Invialo all'AI (ChatGPT/Gemini) con la foto dell'allenamento.\n"}
                {"3. Copia il JSON risultante e incollalo sotto."}
              </ThemedText>

              <View style={styles.promptContainer}>
                <View style={styles.promptHeader}>
                  <ThemedText type="defaultSemiBold">Prompt da copiare:</ThemedText>
                  <Pressable style={styles.copyBtn} onPress={copyToClipboard}>
                    <ThemedText style={[styles.copyBtnText, { color: primaryColor }]}>Copia</ThemedText>
                  </Pressable>
                </View>
                <TextInput
                  value={PROMPT_AI}
                  editable={false}
                  selectTextOnFocus={true}
                  multiline
                  style={styles.promptText}
                />
              </View>

              <ThemedText type="defaultSemiBold" style={{ marginTop: 16, marginBottom: 8 }}>{"Incolla il JSON dell'AI:"}</ThemedText>
              <TextInput
                placeholder={"Incolla qui il JSON... (es. { \"title\": \"...\", \"exercises\": [...] })"}
                placeholderTextColor="#999"
                value={importText}
                onChangeText={setImportText}
                multiline
                style={styles.importInput}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalBtn, styles.btnCancel]} onPress={() => setImportModalVisible(false)}>
                <ThemedText type="defaultSemiBold">Annulla</ThemedText>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.btnConfirm, { backgroundColor: primaryColor }]} onPress={handleImport}>
                <ThemedText type="defaultSemiBold" style={{ color: '#fff' }}>Importa</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>
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
    backgroundColor: 'transparent', // Cambia qui
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
    gap: 8,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  headerName: {
    flex: 1,
    textAlign: 'right',
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
    marginBottom: 12,
    textAlign: 'center',
  },
  modalScroll: {
    marginVertical: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 6,
    lineHeight: 20,
  },
  promptContainer: {
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#444',
  },
  promptText: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 6,
    padding: 8,
    backgroundColor: '#111',
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
  },
  importInput: {
    height: 120,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    backgroundColor: '#111',
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    borderWidth: 1,
    borderColor: '#555',
  },
  btnConfirm: {
    backgroundColor: '#0a7ea4',
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  copyBtn: {
    backgroundColor: '#333',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#555',
  },
  copyBtnText: {
    fontSize: 12,
    color: '#0a7ea4',
    fontWeight: 'bold',
  },
});


