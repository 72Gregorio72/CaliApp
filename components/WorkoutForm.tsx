import { DragList } from '@/components/DragList';
import { ExercisePicker } from '@/components/ExercisePicker';
import { Button, Card, Field, IconButton, Screen, Section, Sheet, Txt, onInk } from '@/components/ui/kit';
import { UI, themed } from '@/constants/theme';
import { useCustomTheme } from '@/context/CustomThemeContext';
import type { Exercise, Workout } from '@/context/WorkoutContext';
import { blockLabel, groupAt, groupsOf, normalizeBlocks, type Block } from '@/lib/blocks';
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
  superset?: boolean; // linked to the next exercise: same block
  block?: Block; // only read on the first exercise of a block
  maxWeight?: string; // legacy, carried through untouched
};

const BLOCK_HELP = {
  none: 'Gli esercizi collegati si fanno in superserie: uno dopo l\'altro, recupero alla fine del giro.',
  emom: 'Ogni minuto parte un esercizio del blocco, a rotazione: fai le ripetizioni e riposi fino al minuto dopo. Le serie si calcolano dai minuti.',
  amrap: 'Più giri possibili del blocco nel tempo dato. Le serie sono i giri che punti a fare.',
} as const;

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
    block: ex.block,
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
  // block settings sheet: id of the block's first exercise
  const [blockFor, setBlockFor] = useState<string | null>(null);
  const [blockDraft, setBlockDraft] = useState<{ type: 'none' | Block['type']; minutes: string }>({ type: 'none', minutes: '10' });
  const groups = groupsOf(exercises.map(e => ({ supersetWithNext: e.superset, block: e.block })));

  const openBlock = (headId: string) => {
    const b = exercises.find(e => e.id === headId)?.block;
    setBlockDraft({ type: b?.type ?? 'none', minutes: String(b?.minutes ?? 10) });
    setBlockFor(headId);
  };
  const saveBlock = () => {
    if (!blockFor) return;
    const minutes = parseInt(blockDraft.minutes, 10);
    if (blockDraft.type !== 'none' && !(minutes > 0)) return Alert.alert('Minuti non validi', 'Indica quanti minuti dura il blocco.');
    setExercises(prev => prev.map(e => (e.id === blockFor ? { ...e, block: blockDraft.type === 'none' ? undefined : { type: blockDraft.type, minutes } } : e)));
    setBlockFor(null);
  };
  const blockHead = blockFor ? exercises.findIndex(e => e.id === blockFor) : -1;
  const blockSize = blockHead >= 0 ? (groupAt(groups, blockHead)?.end ?? blockHead + 1) - blockHead : 1;

  // the picked exercise keeps its id, so it shares history with the workouts it comes from;
  // one already in this workout is copied with a new id (an id must be unique within a workout)
  const pickExisting = (ex: Exercise) => {
    const replace = picker?.replace;
    if (ex.id === replace) return;
    const d = toDraftEx(exercises.some(e => e.id === ex.id) ? { ...ex, id: newId() } : ex);
    // links and block belong to the slot, not to the exercise: a replacement keeps the slot's, a new one starts unlinked
    setExercises(prev => (replace ? prev.map(e => (e.id === replace ? { ...d, superset: e.superset, block: e.block } : e)) : [...prev, { ...d, superset: false, block: undefined }]));
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
        ...(e.block ? { block: e.block } : {}),
        ...(e.maxWeight ? { maxWeight: e.maxWeight } : {}),
      }));
    // on the saved list (empty names dropped): a block survives only on its first exercise
    const final: Exercise[] = normalizeBlocks(cleaned);
    if (final.length === 0) {
      Alert.alert('Nessun esercizio', 'Aggiungi almeno un esercizio');
      return;
    }
    onSubmit({ title: title.trim(), exercises: final });
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
        {exercises.length > 1 ? <Txt v="muted">{"Tieni premuto un esercizio e trascinalo per cambiare l'ordine. Collega esercizi per farne una superserie, un EMOM o un AMRAP."}</Txt> : null}
        <DragList data={exercises} keyOf={ex => ex.id} onMove={reorder} render={(ex, i) => {
          const open = expanded === ex.id;
          const g = groupAt(groups, i)!;
          const head = exercises[g.start];
          const inBlock = g.type !== null;
          return (
            <Card style={[styles.exCard, inBlock && { borderLeftWidth: 4, borderLeftColor: primaryColor }]}>
              {inBlock && i === g.start ? (
                <Pressable onPress={() => openBlock(ex.id)} style={styles.blockHead} accessibilityRole="button" accessibilityLabel={`${blockLabel(g)}, modifica blocco`}>
                  <Ionicons name={g.type === 'superset' ? 'git-merge-outline' : g.type === 'emom' ? 'alarm-outline' : 'flame-outline'} size={16} color={UI.text} />
                  <Txt v="label" color={UI.text} style={{ flex: 1, letterSpacing: 0.5 }}>{blockLabel(g).toUpperCase()}</Txt>
                  {g.type === 'emom' ? <Txt v="label">serie dai minuti</Txt> : null}
                  <Ionicons name="options-outline" size={16} color={UI.muted} />
                </Pressable>
              ) : null}
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
                  <Pressable onPress={() => openBlock(head.id)} style={styles.switchRow} accessibilityRole="button">
                    <Txt v="body">Modalità blocco</Txt>
                    <Txt v="label">{inBlock ? blockLabel(g) : 'Normale'} ›</Txt>
                  </Pressable>
                  <View style={styles.switchRow}>
                    <Txt v="body">Posizione</Txt>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <IconButton icon="arrow-up" label="Sposta su" onPress={() => move(ex.id, -1)} />
                      <IconButton icon="arrow-down" label="Sposta giù" onPress={() => move(ex.id, 1)} />
                    </View>
                  </View>
                </View>
              ) : null}
              {i < exercises.length - 1 ? (
                <Pressable
                  onPress={() => update(ex.id, 'superset', !ex.superset)}
                  style={[styles.link, ex.superset && { backgroundColor: UI.ink }]}
                  accessibilityRole="button"
                  accessibilityLabel={ex.superset ? 'Scollega dal successivo' : 'Collega al successivo'}
                >
                  <Ionicons name={ex.superset ? 'link' : 'add'} size={14} color={ex.superset ? onInk(primaryColor) : UI.muted} />
                  <Txt v="label" color={ex.superset ? onInk(primaryColor) : UI.muted}>{ex.superset ? 'Collegato al successivo · tocca per scollegare' : 'Collega al successivo'}</Txt>
                </Pressable>
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

      <Sheet visible={blockFor !== null} onClose={() => setBlockFor(null)} title="Modalità blocco">
        <Txt v="muted">{blockSize > 1 ? `Vale per i ${blockSize} esercizi collegati.` : 'Vale per questo esercizio. Collegane altri per fare un blocco di più esercizi.'}</Txt>
        <View style={styles.choices}>
          {([['none', blockSize > 1 ? 'Superserie' : 'Normale', 'git-merge-outline'], ['emom', 'EMOM', 'alarm-outline'], ['amrap', 'AMRAP', 'flame-outline']] as const).map(([key, label, icon]) => {
            const on = blockDraft.type === key;
            return (
              <Pressable
                key={key}
                onPress={() => setBlockDraft(d => ({ ...d, type: key }))}
                style={[styles.choice, on && { backgroundColor: UI.ink, borderColor: UI.ink }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Ionicons name={icon} size={20} color={on ? onInk(primaryColor) : UI.text} />
                <Txt v="h3" color={on ? onInk(primaryColor) : UI.text}>{label}</Txt>
              </Pressable>
            );
          })}
        </View>
        <Txt v="muted">{BLOCK_HELP[blockDraft.type]}</Txt>
        {blockDraft.type !== 'none' ? (
          <Field label="Durata (minuti)" keyboardType="number-pad" value={blockDraft.minutes} onChangeText={t => setBlockDraft(d => ({ ...d, minutes: t }))} />
        ) : null}
        <Button title="Applica" icon="checkmark" onPress={saveBlock} />
      </Sheet>

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
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: -4 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10, backgroundColor: UI.surface },
  choices: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: UI.border },
}));
