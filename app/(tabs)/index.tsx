import { ColorPicker } from '@/components/ColorPicker';
import { Button, Card, Empty, HeroCard, IconButton, Pill, Screen, Section, Sheet, Stat, Txt, WeekStrip, MonthGrid, onColor, todayIndex } from '@/components/ui/kit';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PRIMARY_COLOR_OPTIONS, SECONDARY_COLOR_OPTIONS, useCustomTheme } from '@/context/CustomThemeContext';
import { WEEK_DAYS, useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { useWorkouts } from '@/context/WorkoutContext';
import { FREE_WORKOUT_ID, useHistory } from '@/context/HistoryContext';
import { ReloadDataContext, exportBackup, importBackup, importBackupFile, shareBackupFile } from '@/lib/backup';
import { seedDemo } from '@/lib/demo';
import { dayKey, thisWeek, volume, weekStreak } from '@/lib/stats';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useContext, useState } from 'react';
import { Alert, Modal, Pressable, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { UI } from '@/constants/theme';

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export default function HomeScreen() {
  const { plans, activePlanId } = useWeeklyPlans();
  const { workouts } = useWorkouts();
  const { sessions, draft, setDraft } = useHistory();
  const reloadData = useContext(ReloadDataContext);
  const [backupOpen, setBackupOpen] = useState(false);
  const { primaryColor, secondaryColor, setPrimaryColor, setSecondaryColor, darkMode, setDarkMode } = useCustomTheme();
  const [themeOpen, setThemeOpen] = useState(false);
  const [colorTarget, setColorTarget] = useState<'primary' | 'secondary'>('primary');

  const now = new Date();
  const today = todayIndex();
  // the active plan wins; without one, the first plan with something today
  const plan = plans.find(p => p?.id === activePlanId) ?? plans.find(p => p?.days?.[today]?.workoutId) ?? plans[0];
  const draftWorkout = !draft ? undefined : draft.workoutId === FREE_WORKOUT_ID ? { id: FREE_WORKOUT_ID, title: 'Allenamento libero' } : workouts.find(w => w?.id === draft.workoutId);
  const week = thisWeek(sessions, now);
  const weekKg = Math.round(week.reduce((n, l) => n + volume(l), 0));
  const monthCount = sessions.filter(l => new Date(l.date).getMonth() === now.getMonth() && new Date(l.date).getFullYear() === now.getFullYear()).length;
  const monthName = MONTHS[now.getMonth()];
  const todayWorkout = workouts.find(w => w?.id === plan?.days?.[today]?.workoutId);
  const totalSets = todayWorkout?.exercises.reduce((n, e) => n + (e.sets || 0), 0) ?? 0;
  const fg = onColor(primaryColor);

  const openWorkout = (workoutId: string) => router.push({ pathname: '/weekly-plans/workout-details', params: { workoutId } });

  const copyBackup = async () => {
    try {
      await Clipboard.setStringAsync(await exportBackup());
      Alert.alert('Backup copiato', 'Incollalo in una nota o mandatelo per email per tenerlo al sicuro.');
    } catch (e: any) {
      Alert.alert('Errore', 'Impossibile creare il backup: ' + e.message);
    }
  };

  const saveBackupFile = () => shareBackupFile().catch((e: any) => Alert.alert('Errore', 'Impossibile creare il file di backup: ' + e.message));

  const restoreBackupFile = () =>
    Alert.alert('Ripristina da file', 'Sostituisce allenamenti, schede, storico e peso corporeo con quelli del file che sceglierai. Continuare?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Scegli file',
        style: 'destructive',
        onPress: async () => {
          try {
            if (!(await importBackupFile())) return;
            setBackupOpen(false);
            reloadData();
            Alert.alert('Fatto', 'Dati ripristinati.');
          } catch (e: any) {
            Alert.alert('Backup non valido', e.message);
          }
        },
      },
    ]);

  const restoreBackup = () =>
    Alert.alert('Ripristina backup', 'Sostituisce allenamenti, schede, storico e peso corporeo con il backup copiato negli appunti. Continuare?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Ripristina',
        style: 'destructive',
        onPress: async () => {
          try {
            await importBackup(await Clipboard.getStringAsync());
            setBackupOpen(false);
            reloadData();
            Alert.alert('Fatto', 'Dati ripristinati.');
          } catch (e: any) {
            Alert.alert('Backup non valido', e.message);
          }
        },
      },
    ]);

  // no `draftWorkout!.id` here: React Compiler trusts `!` and reads .id during render to memoize, crashing when there's no draft
  const resume = () => draftWorkout && router.push({ pathname: '/workouts/session', params: { workoutId: draftWorkout.id } });

  return (
    <Screen
      tab
      subtitle={`${WEEK_DAYS[today]} ${now.getDate()} ${MONTHS[now.getMonth()]}`}
      title="Pronto ad allenarti?"
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="cloud-upload-outline" label="Backup dati" onPress={() => setBackupOpen(true)} />
          <IconButton icon="color-palette-outline" label="Personalizza colori" onPress={() => setThemeOpen(true)} />
        </View>
      }
    >
      {draft && draftWorkout ? (
        <Card onPress={resume}>
          <Txt v="label">Allenamento in sospeso</Txt>
          <Txt v="h2">{draftWorkout.title}</Txt>
          <Txt v="muted">{`${Object.values(draft.counters).reduce((n, c) => n + c.currentSet, 0)} serie fatte · iniziato ${new Date(draft.startedAt).toLocaleString('it-IT', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`}</Txt>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Riprendi" icon="play" small style={{ flex: 1 }} onPress={resume} />
            <IconButton icon="trash-outline" tone="danger" label="Scarta allenamento in sospeso" onPress={() => setDraft(null)} />
          </View>
        </Card>
      ) : null}

      {todayWorkout ? (
        <HeroCard>
          <Txt v="label" color={fg} style={{ opacity: 0.8 }}>Allenamento di oggi</Txt>
          <Txt v="h1" color={fg}>{todayWorkout.title}</Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pill tone="onAccent" icon="barbell-outline" text={`${todayWorkout.exercises.length} esercizi`} />
            <Pill tone="onAccent" icon="layers-outline" text={`${totalSets} serie`} />
          </View>
          <Button
            variant="onAccent"
            icon="play"
            title="Inizia allenamento"
            onPress={() => router.push({ pathname: '/workouts/session', params: { workoutId: todayWorkout.id } })}
          />
        </HeroCard>
      ) : plans.length > 0 ? (
        <Card>
          <Txt v="label">Oggi</Txt>
          <Txt v="h2">Giorno di riposo 😌</Txt>
          <Txt v="muted">{`Recupera bene: nella scheda "${plan?.name}" oggi non è previsto nessun allenamento.`}</Txt>
        </Card>
      ) : (
        <Empty
          icon="calendar-outline"
          title="Organizza la tua settimana"
          text="Crea una scheda settimanale e qui vedrai ogni giorno l'allenamento da fare."
          action="Crea scheda"
          onAction={() => router.push('/weekly-plans/add')}
        />
      )}

      {plan ? (
        <Section title={`Settimana · ${plan.name}`} action="Schede" onAction={() => router.push('/plans')}>
          <Card>
            <WeekStrip days={plan.days} onPressDay={i => openWorkout(plan.days[i].workoutId!)} />
          </Card>
        </Section>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Stat value={week.length} label="Questa settimana" />
        <Stat value={weekStreak(sessions, now)} label="Settimane di fila" />
        <Stat value={weekKg >= 1000 ? `${(weekKg / 1000).toFixed(1).replace('.', ',')} t` : `${weekKg} kg`} label="Volume settimana" />
      </View>

      <Section title={`${monthName[0].toUpperCase()}${monthName.slice(1)} · ${monthCount} allenamenti`}>
        <Card>
          <MonthGrid now={now} trained={new Set(sessions.map(l => dayKey(new Date(l.date))))} color={primaryColor} />
        </Card>
      </Section>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        {([
          ['add-circle-outline', 'Nuovo allenamento', 'A mano o con l\'AI', '/workouts/add'],
          ['calendar-outline', 'Nuova scheda', 'Pianifica la settimana', '/weekly-plans/add'],
        ] as const).map(([icon, title, sub, href]) => (
          <Card key={href} onPress={() => router.push(href)} style={{ flex: 1, gap: 8 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: primaryColor, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={icon} size={22} color={fg} />
            </View>
            <View>
              <Txt v="h3" numberOfLines={1} adjustsFontSizeToFit>{title}</Txt>
              <Txt v="muted" numberOfLines={1}>{sub}</Txt>
            </View>
          </Card>
        ))}
      </View>

      <Sheet visible={backupOpen} onClose={() => setBackupOpen(false)} title="Backup dati">
        <Txt v="muted">{`Allenamenti, schede, storico (${sessions.length} sessioni) e peso corporeo. Salva il file su Drive, email o dove vuoi: se disinstalli l'app potrai ripristinarlo da qui.`}</Txt>
        <Button title="Salva backup su file" icon="share-outline" onPress={saveBackupFile} />
        <Button title="Ripristina da file" icon="folder-open-outline" variant="secondary" onPress={restoreBackupFile} />
        <Txt v="muted">Oppure come testo negli appunti:</Txt>
        <Button title="Copia backup" icon="copy-outline" variant="secondary" onPress={copyBackup} />
        <Button title="Ripristina dagli appunti" icon="download-outline" variant="secondary" onPress={restoreBackup} />
        {__DEV__ ? (
          <Button
            title="Carica dati demo (debug)"
            icon="flask-outline"
            variant="secondary"
            onPress={() => seedDemo().then(() => { setBackupOpen(false); reloadData(); }, e => Alert.alert('Errore', e.message))}
          />
        ) : null}
      </Sheet>

      {/* full screen, no ScrollView: the color page must not move when dragging up/down */}
      <Modal visible={themeOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setThemeOpen(false)}>
        <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: UI.bg, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt v="h2">Personalizza colori</Txt>
          <IconButton icon="close" label="Chiudi" onPress={() => setThemeOpen(false)} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt v="h3">Tema scuro</Txt>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ true: primaryColor, false: UI.border }}
            thumbColor="#fff"
            accessibilityLabel="Tema scuro"
          />
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: UI.surface, borderRadius: 14, padding: 4, gap: 4 }}>
          {([['primary', 'Primario', primaryColor], ['secondary', 'Secondario', secondaryColor]] as const).map(([key, label, color]) => {
            const on = colorTarget === key;
            return (
              <Pressable
                key={key}
                onPress={() => setColorTarget(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10, backgroundColor: on ? UI.card : 'transparent' }}
              >
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: color, borderWidth: 1, borderColor: UI.border }} />
                <Text style={{ color: on ? UI.text : UI.muted, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {colorTarget === 'primary' ? (
          <ColorPicker key="primary" value={primaryColor} onChange={setPrimaryColor} presets={PRIMARY_COLOR_OPTIONS} />
        ) : (
          <ColorPicker key="secondary" value={secondaryColor} onChange={setSecondaryColor} presets={SECONDARY_COLOR_OPTIONS} />
        )}
        <View style={{ flex: 1 }} />
        <Button title="Fatto" onPress={() => setThemeOpen(false)} />
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </Screen>
  );
}
