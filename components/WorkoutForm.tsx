import { DragList } from '@/components/DragList';
import { ExercisePicker } from '@/components/ExercisePicker';
import { Button, Card, Field, IconButton, Screen, Section, Sheet, Txt, onInk } from '@/components/ui/kit';
import { UI, themed } from '@/constants/theme';
import { useCustomTheme } from '@/context/CustomThemeContext';
import type { Exercise, Workout } from '@/context/WorkoutContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Stack } from 'expo-router';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

type DraftExercise = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  restSeconds: string;
  durationEnabled?: boolean;
  durationSeconds?: string;
  description?: string;
  superset?: boolean;
  maxWeight?: string; // legacy, carried through untouched
};

type WorkoutInput = Omit<Workout, 'id' | 'createdAt'>;

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

/** JSON incollato dall'AI: toglie eventuali ``` e fa il parse. */
export const parseAiJson = (raw: string) => {
  let text = raw.trim();
  if (text.startsWith('```')) text = text.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '');
  return JSON.parse(text);
};

/** Esercizi dal JSON dell'AI, con default per i campi mancanti. */
export const aiExercises = (list: any[]): Exercise[] =>
  list.map((ex, idx) => {
    if (!ex?.name) throw new Error(`L'esercizio al posto ${idx + 1} deve avere un nome.`);
    return {
      id: newId(idx),
      name: String(ex.name),
      sets: Number(ex.sets) || 3,
      reps: Number(ex.reps) || 10,
      restSeconds: Number(ex.restSeconds) || 60,
      ...(Number(ex.durationSeconds) > 0 ? { durationSeconds: Number(ex.durationSeconds) } : {}),
      ...(ex.description ? { description: String(ex.description) } : {}),
    };
  });

/** 90 -> "1:30" */
const fmtRest = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
/** "1:30" -> 90, "90" -> 90 */
const parseRest = (t: string) => {
  const [m, s] = t.split(':');
  return s === undefined ? Number(m) || 0 : (Number(m) || 0) * 60 + (Number(s) || 0);
};

const BOXES = [
  ['sets', 'Serie', '3'],
  ['reps', 'Ripetizioni', '10'],
  ['restSeconds', 'Recupero', '1:00'],
] as const;

const newId = (i = 0) => `draft_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 11)}`;

const toDraftEx = (ex: Exercise): DraftExercise => ({
    id: ex.id,
    name: ex.name,
    sets: String(ex.sets),
    reps: String(ex.reps),
    restSeconds: fmtRest(ex.restSeconds),
    durationEnabled: !!ex.durationSeconds,
    durationSeconds: ex.durationSeconds ? String(ex.durationSeconds) : '',
    description: ex.description ?? '',
    superset: !!ex.supersetWithNext,
    maxWeight: ex.maxWeight,
  });
const toDraft = (w?: Workout): DraftExercise[] => (w?.exercises ?? []).map(toDraftEx);

export function WorkoutForm({
  screenTitle,
  initial,
  allowImport,
  onSubmit,
}: {
  screenTitle: string;
  initial?: Workout;
  allowImport?: boolean;
  onSubmit: (w: WorkoutInput) => void;
}) {
  const { primaryColor } = useCustomTheme();
  const [title, setTitle] = useState(initial?.title ?? 'Allenamento Personalizzato');
  const [exercises, setExercises] = useState<DraftExercise[]>(() => toDraft(initial));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  // existing exercise picker: replace = id of the exercise to swap out, otherwise it adds at the end
  const [picker, setPicker] = useState<{ replace?: string } | null>(null);

  // the picked exercise keeps its id, so it shares history with the workouts it comes from;
  // one already in this workout is copied with a new id (an id must be unique within a workout)
  const pickExisting = (ex: Exercise) => {
    const replace = picker?.replace;
    if (ex.id === replace) return;
    const d = toDraftEx(exercises.some(e => e.id === ex.id) ? { ...ex, id: newId() } : ex);
    setExercises(prev => (replace ? prev.map(e => (e.id === replace ? { ...d, superset: e.superset } : e)) : [...prev, d]));
  };

  const reorder = (from: number, to: number) =>
    setExercises(prev => {
      const next = [...prev];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });

  const update = (id: string, field: keyof DraftExercise, value: string | boolean) =>
    setExercises(prev => prev.map(e => (e.id === id ? { ...e, [field]: value } : e)));

  const addExercise = () => {
    const id = newId();
    setExercises(prev => [...prev, { id, name: '', sets: '3', reps: '10', restSeconds: '1:00', durationEnabled: false, durationSeconds: '', description: '' }]);
    setExpanded(id);
  };

  const move = (id: string, by: -1 | 1) =>
    setExercises(prev => {
      const i = prev.findIndex(e => e.id === id);
      const j = i + by;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const removeExercise = (id: string) =>
    Alert.alert('Elimina esercizio', 'Vuoi eliminare questo esercizio?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => setExercises(prev => prev.filter(e => e.id !== id)) },
    ]);

  const save = () => {
    if (!title.trim()) {
      Alert.alert('Titolo mancante', "Inserisci un titolo per l'allenamento");
      return;
    }
    const cleaned = exercises
      .filter(e => e.name.trim())
      .map(e => ({
        id: e.id,
        name: e.name.trim(),
        sets: Number(e.sets) || 0,
        reps: Number(e.reps) || 0,
        restSeconds: parseRest(e.restSeconds),
        ...(e.durationEnabled && Number(e.durationSeconds) > 0 ? { durationSeconds: Number(e.durationSeconds) } : {}),
        ...(e.description && e.description.trim().length > 0 ? { description: e.description.trim() } : {}),
        ...(e.superset ? { supersetWithNext: true } : {}),
        ...(e.maxWeight ? { maxWeight: e.maxWeight } : {}),
      }));
    if (cleaned.length === 0) {
      Alert.alert('Nessun esercizio', 'Aggiungi almeno un esercizio');
      return;
    }
    onSubmit({ title: title.trim(), exercises: cleaned });
  };

  const copyPrompt = async () => {
    try {
      await Clipboard.setStringAsync(PROMPT_AI);
      Alert.alert('Copiato!', 'Il prompt è stato copiato negli appunti.');
    } catch {
      Alert.alert('Errore', 'Impossibile copiare il testo.');
    }
  };

  const handleImport = () => {
    if (!importText.trim()) {
      Alert.alert('Errore', 'Incolla il testo prima di procedere.');
      return;
    }
    try {
      const parsed = parseAiJson(importText);
      if (!parsed.title || !Array.isArray(parsed.exercises)) {
        throw new Error('Il JSON deve contenere "title" (stringa) e "exercises" (array).');
      }
      const imported = toDraft({ exercises: aiExercises(parsed.exercises) } as Workout);
      setTitle(parsed.title);
      setExercises(imported);
      setImportOpen(false);
      setImportText('');
      Alert.alert('Importazione completata!', `Caricato l'allenamento "${parsed.title}" con ${imported.length} esercizi.`);
    } catch (e: any) {
      Alert.alert('Errore di formato', 'Il formato del testo non è valido. Assicurati che sia un JSON corretto.\n\nDettaglio: ' + e.message);
    }
  };

  return (
    <Screen title={screenTitle} footer={<Button title="Salva allenamento" icon="checkmark" onPress={save} />}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={save} hitSlop={10} accessibilityRole="button">
              <Text style={styles.headerSave}>Salva</Text>
            </Pressable>
          ),
        }}
      />
      <Field label="Nome allenamento" value={title} onChangeText={setTitle} placeholder="Es. Push Day" style={styles.titleInput} />

      {allowImport ? (
        <Card onPress={() => setImportOpen(true)} style={styles.importCard}>
          <View style={[styles.num, { backgroundColor: UI.ink }]}>
            <Ionicons name="sparkles" size={18} color={onInk(primaryColor)} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="h3">{"Importa da foto con l'AI"}</Txt>
            <Txt v="muted">Fotografa la scheda e incolla il risultato</Txt>
          </View>
          <Ionicons name="chevron-forward" size={20} color={UI.subtle} />
        </Card>
      ) : null}

      <Section title={`Esercizi · ${exercises.length}`}>
        {exercises.length > 1 ? <Txt v="muted">Tieni premuto un esercizio e trascinalo per cambiare l'ordine.</Txt> : null}
        <DragList data={exercises} keyOf={ex => ex.id} onMove={reorder} render={(ex, i) => {
          const open = expanded === ex.id;
          return (
            <Card style={styles.exCard}>
              <View style={styles.exHead}>
                <TextInput
                  value={ex.name}
                  onChangeText={t => update(ex.id, 'name', t)}
                  placeholder="Nome esercizio"
                  placeholderTextColor={UI.subtle}
                  selectionColor={UI.text}
                  autoFocus={!ex.name}
                  style={styles.exName}
                />
                <Pressable onPress={() => setExpanded(open ? null : ex.id)} hitSlop={8} accessibilityLabel="Opzioni esercizio">
                  <Ionicons name={open ? 'chevron-up' : 'ellipsis-horizontal'} size={18} color={UI.muted} />
                </Pressable>
                <Pressable onPress={() => setPicker({ replace: ex.id })} hitSlop={8} accessibilityLabel="Sostituisci con un esercizio esistente">
                  <Ionicons name="swap-horizontal" size={18} color={UI.muted} />
                </Pressable>
                <Pressable onPress={() => removeExercise(ex.id)} hitSlop={8} accessibilityLabel="Elimina esercizio">
                  <Ionicons name="trash-outline" size={18} color={UI.muted} />
                </Pressable>
              </View>
              <View style={styles.row3}>
                {BOXES.map(([key, label, placeholder]) => (
                  <View key={key} style={styles.box}>
                    <Txt style={styles.boxLabel}>{label}</Txt>
                    <TextInput
                      value={ex[key]}
                      onChangeText={t => update(ex.id, key, t)}
                      placeholder={placeholder}
                      placeholderTextColor={UI.subtle}
                      selectionColor={UI.text}
                      keyboardType={key === 'restSeconds' ? 'numbers-and-punctuation' : 'number-pad'}
                      selectTextOnFocus
                      accessibilityLabel={label}
                      style={styles.boxValue}
                    />
                  </View>
                ))}
              </View>

              {open ? (
                <View style={{ gap: 12 }}>
                  <View style={styles.switchRow}>
                    <Txt v="body">Esercizio a tempo</Txt>
                    <Switch
                      value={!!ex.durationEnabled}
                      onValueChange={v => update(ex.id, 'durationEnabled', v)}
                      trackColor={{ true: UI.ink, false: UI.border }}
                      thumbColor={ex.durationEnabled ? primaryColor : '#fff'}
                    />
                  </View>
                  {ex.durationEnabled ? (
                    <Field label="Durata (secondi)" keyboardType="number-pad" value={ex.durationSeconds ?? ''} onChangeText={t => update(ex.id, 'durationSeconds', t)} />
                  ) : null}
                  <Field label="Note (opzionale)" placeholder="Tecnica, carico, dettagli…" value={ex.description ?? ''} onChangeText={t => update(ex.id, 'description', t)} multiline />
                  {i < exercises.length - 1 ? (
                    <View style={styles.switchRow}>
                      <Txt v="body">Superserie con il successivo</Txt>
                      <Switch
                        value={!!ex.superset}
                        onValueChange={v => update(ex.id, 'superset', v)}
                        trackColor={{ true: UI.ink, false: UI.border }}
                        thumbColor={ex.superset ? primaryColor : '#fff'}
                      />
                    </View>
                  ) : null}
                  <View style={styles.switchRow}>
                    <Txt v="body">Posizione</Txt>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <IconButton icon="arrow-up" label="Sposta su" onPress={() => move(ex.id, -1)} />
                      <IconButton icon="arrow-down" label="Sposta giù" onPress={() => move(ex.id, 1)} />
                    </View>
                  </View>
                </View>
              ) : null}
            </Card>
          );
        }} />
        <Pressable onPress={addExercise} style={({ pressed }) => [styles.addCard, pressed && { opacity: 0.6 }]} accessibilityRole="button">
          <Ionicons name="add" size={20} color={UI.muted} />
          <Txt v="body" color={UI.muted} style={{ fontWeight: '600' }}>Aggiungi esercizio</Txt>
        </Pressable>
        <Pressable onPress={() => setPicker({})} style={({ pressed }) => [styles.addCard, pressed && { opacity: 0.6 }]} accessibilityRole="button">
          <Ionicons name="albums-outline" size={20} color={UI.muted} />
          <Txt v="body" color={UI.muted} style={{ fontWeight: '600' }}>Aggiungi dai tuoi allenamenti</Txt>
        </Pressable>
      </Section>

      <ExercisePicker
        visible={picker !== null}
        title={picker?.replace ? 'Sostituisci esercizio' : 'Aggiungi esercizio esistente'}
        inUse={exercises.map(e => e.id)}
        onPick={pickExisting}
        onClose={() => setPicker(null)}
      />

      <Sheet visible={importOpen} onClose={() => setImportOpen(false)} title="Importa con l'AI">
        <Txt v="muted">
          {'1. Copia il prompt.\n2. Invialo a ChatGPT/Gemini insieme alla foto della scheda.\n3. Incolla qui sotto il JSON che ti restituisce.'}
        </Txt>
        <Button title="Copia prompt" icon="copy-outline" variant="secondary" onPress={copyPrompt} />
        <Field
          label="JSON dell'AI"
          placeholder={'{ "title": "...", "exercises": [...] }'}
          value={importText}
          onChangeText={setImportText}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={{ minHeight: 160, fontFamily: 'monospace', fontSize: 13 }}
        />
        <Button title="Importa" icon="download-outline" onPress={handleImport} />
      </Sheet>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  importCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  exCard: { gap: 12 },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  exName: { flex: 1, fontSize: 16, fontWeight: '700', color: UI.text, paddingVertical: 4 },
  num: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  row3: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, backgroundColor: UI.surface, borderRadius: 12, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  boxLabel: { fontSize: 11, color: UI.muted },
  boxValue: { fontSize: 20, fontWeight: '600', color: UI.text, paddingVertical: 2 },
  addCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: UI.borderStrong },
  titleInput: { fontSize: 22, fontWeight: '700', paddingVertical: 16 },
  headerSave: { fontSize: 16, fontWeight: '700', color: UI.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
}));
