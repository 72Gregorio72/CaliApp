import { UI, themed } from '@/constants/theme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SystemUI from 'expo-system-ui';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { WorkoutProvider, useWorkouts } from '@/context/WorkoutContext';
import { WeeklyPlanProvider, useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { CustomThemeProvider, useCustomTheme } from '@/context/CustomThemeContext';
import { HistoryProvider } from '@/context/HistoryContext';
import { ReloadDataContext, unifyExercises } from '@/lib/backup';
import { syncReminders } from '@/lib/notifications';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export const unstable_settings = {
  anchor: '(tabs)',
};

/** Light/dark: UI is swapped in place (constants/theme), so the `key` remounts every screen to re-read it. */
function Themed({ children }: { children: ReactNode }) {
  const { darkMode } = useCustomTheme();
  const base = darkMode ? DarkTheme : DefaultTheme;
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(UI.bg).catch(() => {});
  }, [darkMode]);
  return (
    <View key={darkMode ? 'dark' : 'light'} style={{ flex: 1, backgroundColor: UI.bg }}>
      <ThemeProvider value={{ ...base, colors: { ...base.colors, background: UI.bg, card: UI.bg, text: UI.text, border: UI.border } }}>
        {children}
      </ThemeProvider>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
    </View>
  );
}

/** Keeps the scheduled weekly reminders in line with the active plan. */
function ReminderSync() {
  const { plans, activePlanId, isLoading } = useWeeklyPlans();
  const { workouts, isLoading: workoutsLoading } = useWorkouts();
  const plan = plans.find(p => p.id === activePlanId);
  const entries = (plan?.days ?? []).flatMap((d, dayIndex) => {
    const w = d.reminder && workouts.find(x => x.id === d.workoutId);
    return w && d.reminder ? [{ dayIndex, time: d.reminder, title: w.title }] : [];
  });
  const key = JSON.stringify(entries); // reschedule only when something actually changed
  useEffect(() => {
    if (!isLoading && !workoutsLoading) syncReminders(JSON.parse(key));
  }, [key, isLoading, workoutsLoading]);
  return null;
}

export default function RootLayout() {
  // bumping the key remounts the data providers, which reload from storage (used after a backup restore)
  const [epoch, setEpoch] = useState(0);
  const reload = useCallback(() => setEpoch(e => e + 1), []);
  // providers mount only after the exercise-id merge, so they never load (and re-save) pre-merge data
  const [migrated, setMigrated] = useState(-1);
  useEffect(() => {
    unifyExercises()
      .catch(e => console.error('Unificazione esercizi:', e))
      .finally(() => setMigrated(epoch));
  }, [epoch]);
  return (
    <GestureHandlerRootView style={styles.container}>
      <CustomThemeProvider>
        <Themed>
          <ReloadDataContext.Provider value={reload}>
          {migrated === epoch ? (
          <WorkoutProvider key={epoch}>
            <WeeklyPlanProvider>
              <ReminderSync />
              <HistoryProvider>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                <Stack.Screen name="workouts" options={{ headerShown: false }} />
                <Stack.Screen name="weekly-plans" options={{ headerShown: false }} />
              </Stack>
              </HistoryProvider>
            </WeeklyPlanProvider>
          </WorkoutProvider>
          ) : null}
          </ReloadDataContext.Provider>
        </Themed>
      </CustomThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = themed(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.bg,
  },
}));
