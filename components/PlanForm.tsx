import { Button, Card, Field, Row, Screen, Section, Sheet, Txt, onColor, onInk, todayIndex } from '@/components/ui/kit';
import { aiExercises, parseAiJson } from '@/components/WorkoutForm';
import { UI, themed } from '@/constants/theme';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { WEEK_DAYS, type WeeklyPlan } from '@/context/WeeklyPlanContext';
import { useWorkouts } from '@/context/WorkoutContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

type PlanInput = Omit<WeeklyPlan, 'id' | 'createdAt'>;

const PROMPT_AI = `Analizza questa foto di una scheda di allenamento settimanale. Per ogni giornata di allenamento estrai il giorno della settimana in cui va svolta, il titolo e l'elenco degli esercizi con serie, ripetizioni, recupero ed eventuali note.
Se la scheda non indica i giorni, distribuisci le giornate nella settimana lasciando giorni di riposo in mezzo.
Restituisci ESCLUSIVAMENTE un JSON valido con questa struttura (senza altri testi o spiegazioni):

{
  "name": "Nome Scheda",
  "days": [
    {
      "day": "Lunedì",
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
    }
  ]
}

I valori ammessi per "day" sono: Lunedì, Martedì, Mercoledì, Giovedì, Venerdì, Sabato, Domenica.`;

// "Lun", "lunedi", "LUNEDÌ" -> 'Lunedì' (le prime 3 lettere sono già uniche)
const matchDay = (raw: unknown) => WEEK_DAYS.find(d => d.slice(0, 3).toLowerCase() === String(raw ?? '').trim().slice(0, 3).toLowerCase());

export function PlanForm({ screenTitle, initial, onSubmit }: { screenTitle: string; initial?: WeeklyPlan; onSubmit: (p: PlanInput) => void }) {
  const { workouts, addWorkout } = useWorkouts();
  const { primaryColor } = useCustomTheme();
  const [name, setName] = useState(initial?.name ?? 'Nuova Scheda');
  const [days, setDays] = useState(initial?.days ?? WEEK_DAYS.map(day => ({ day, workoutId: null as string | null })));
  const [picking, setPicking] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const today = todayIndex();

  const title = (id: string | null) => (id ? workouts.find(w => w.id === id)?.title ?? 'Allenamento eliminato' : 'Riposo');

  const pick = (workoutId: string | null) => {
    setDays(prev => prev.map((d, i) => (i === picking ? { ...d, workoutId } : d)));
    setPicking(null);
  };

  const save = () => {
    if (!name.trim()) {
      Alert.alert('Nome mancante', 'Inserisci un nome per la scheda');
      return;
    }
    onSubmit({ name: name.trim(), days });
  };

  const copyPrompt = async () => {
    try {
      await Clipboard.setStringAsync(PROMPT_AI);
      Alert.alert('Copiato!', 'Il prompt è stato copiato negli appunti.');
    } catch {
      Alert.alert('Errore', 'Impossibile copiare il testo.');
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      Alert.alert('Errore', 'Incolla il testo prima di procedere.');
      return;
    }
    try {
      const parsed = parseAiJson(importText);
      if (!Array.isArray(parsed.days) || parsed.days.length === 0) {
        throw new Error('Il JSON deve contenere "days" (array non vuoto).');
      }
      // valida tutto prima di creare qualcosa, così un errore non lascia allenamenti a metà
      const entries = parsed.days.map((d: any, i: number) => {
        const day = matchDay(d?.day);
        if (!day) throw new Error(`Giorno non valido alla giornata ${i + 1}: "${d?.day}".`);
        if (!Array.isArray(d.exercises)) throw new Error(`La giornata ${i + 1} deve contenere "exercises" (array).`);
        return { day, title: String(d.title || `Allenamento ${day}`), exercises: aiExercises(d.exercises) };
      });
      const assigned: Record<string, string> = {};
      for (const e of entries) assigned[e.day] = await addWorkout({ title: e.title, exercises: e.exercises });
      setDays(prev => prev.map(d => (assigned[d.day] ? { ...d, workoutId: assigned[d.day] } : d)));
      if (parsed.name) setName(String(parsed.name));
      setImportOpen(false);
      setImportText('');
      Alert.alert('Importazione completata!', `Creati ${entries.length} allenamenti e assegnati ai giorni. Ricordati di salvare la scheda.`);
    } catch (e: any) {
      Alert.alert('Errore di formato', 'Il formato del testo non è valido. Assicurati che sia un JSON corretto.\n\nDettaglio: ' + e.message);
    }
  };

  const current = picking !== null ? days[picking]?.workoutId ?? null : null;

  return (
    <Screen title={screenTitle} footer={<Button title="Salva scheda" icon="checkmark" onPress={save} />}>
      <Field label="Nome scheda" value={name} onChangeText={setName} placeholder="Es. Push / Pull / Legs" />

      <Card onPress={() => setImportOpen(true)} style={styles.importCard}>
        <View style={[styles.num, { backgroundColor: UI.ink }]}>
          <Ionicons name="sparkles" size={18} color={onInk(primaryColor)} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="h3">{"Importa scheda con l'AI"}</Txt>
          <Txt v="muted">Più giornate insieme, ognuna nel suo giorno</Txt>
        </View>
        <Ionicons name="chevron-forward" size={20} color={UI.subtle} />
      </Card>

      <Section title={`Giorni · ${days.filter(d => d.workoutId).length}/7 attivi`}>
        {days.map((d, i) => (
          <Card key={d.day} onPress={() => setPicking(i)} style={styles.day}>
            <View style={[styles.badge, { backgroundColor: d.workoutId ? primaryColor : UI.surface }, i === today && styles.today]}>
              <Txt v="label" color={d.workoutId ? onColor(primaryColor) : UI.muted} style={{ letterSpacing: 0 }}>{d.day.slice(0, 3)}</Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="muted">{d.day}{i === today ? ' · oggi' : ''}</Txt>
              <Txt v="h3" color={d.workoutId ? undefined : UI.subtle} numberOfLines={1}>{title(d.workoutId)}</Txt>
            </View>
            <Ionicons name="swap-horizontal" size={20} color={UI.subtle} />
          </Card>
        ))}
      </Section>

      <Sheet visible={picking !== null} onClose={() => setPicking(null)} title={picking !== null ? days[picking].day : ''}>
        <Row icon="bed-outline" title="Riposo" onPress={() => pick(null)} right={current === null ? <Ionicons name="checkmark-circle" size={24} color={primaryColor} /> : <View />} />
        {workouts.map(w => (
          <Row
            key={w.id}
            icon="barbell-outline"
            title={w.title}
            subtitle={`${w.exercises.length} esercizi`}
            onPress={() => pick(w.id)}
            right={current === w.id ? <Ionicons name="checkmark-circle" size={24} color={primaryColor} /> : <View />}
          />
        ))}
        {workouts.length === 0 ? (
          <>
            <Txt v="muted">Non hai ancora allenamenti da assegnare.</Txt>
            <Button
              title="Crea allenamento"
              icon="add"
              variant="secondary"
              onPress={() => {
                setPicking(null);
                router.push('/workouts/add');
              }}
            />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={importOpen} onClose={() => setImportOpen(false)} title="Importa scheda con l'AI">
        <Txt v="muted">
          {"1. Copia il prompt.\n2. Invialo a ChatGPT/Gemini insieme alla foto della scheda.\n3. Incolla qui sotto il JSON: ogni giornata diventa un allenamento assegnato al suo giorno."}
        </Txt>
        <Button title="Copia prompt" icon="copy-outline" variant="secondary" onPress={copyPrompt} />
        <Field
          label="JSON dell'AI"
          placeholder={'{ "name": "...", "days": [{ "day": "Lunedì", ... }] }'}
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
  day: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  badge: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 2, borderColor: UI.text },
  importCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  num: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
}));
