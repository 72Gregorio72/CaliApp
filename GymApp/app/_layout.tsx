import { UI, themed } from '@/constants/theme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SystemUI from 'expo-system-ui';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { WorkoutProvider } from '@/context/WorkoutContext';
import { WeeklyPlanProvider } from '@/context/WeeklyPlanContext';
import { CustomThemeProvider, useCustomTheme } from '@/context/CustomThemeContext';
import { HistoryProvider } from '@/context/HistoryContext';
import { ReloadDataContext } from '@/lib/backup';
import { View, StyleSheet } from 'react-native';

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

export default function RootLayout() {
  // bumping the key remounts the data providers, which reload from storage (used after a backup restore)
  const [epoch, setEpoch] = useState(0);
  const reload = useCallback(() => setEpoch(e => e + 1), []);
  return (
    <View style={styles.container}>
      <CustomThemeProvider>
        <Themed>
          <ReloadDataContext.Provider value={reload}>
          <WorkoutProvider key={epoch}>
            <WeeklyPlanProvider>
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
          </ReloadDataContext.Provider>
        </Themed>
      </CustomThemeProvider>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.bg,
  },
}));
