import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { WorkoutProvider } from '@/context/WorkoutContext';
import { WeeklyPlanProvider } from '@/context/WeeklyPlanContext';
import { CustomThemeProvider } from '@/context/CustomThemeContext';
import { MusicProvider } from '@/context/MusicContext';
import { PlaylistProvider } from '@/context/PlaylistContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { View, StyleSheet } from 'react-native';
import YTPlayerBridge from '@/components/YTPlayerBridge';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <View style={styles.container}>
      <CustomThemeProvider>
        <MusicProvider>
          <PlaylistProvider>
            {/*
             * YTPlayerBridge va DENTRO MusicProvider (usa useMusic())
             * ma FUORI dallo Stack di navigazione — così il WebView
             * non viene mai smontato quando si naviga tra le schermate.
             * È completamente invisibile (position: absolute, top: -9999).
             */}
            <YTPlayerBridge />

            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <WorkoutProvider>
                <WeeklyPlanProvider>
                  <Stack>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                    <Stack.Screen name="workouts" options={{ headerShown: false }} />
                  </Stack>
                  <StatusBar style="auto" />
                </WeeklyPlanProvider>
              </WorkoutProvider>
            </ThemeProvider>
          </PlaylistProvider>
        </MusicProvider>
      </CustomThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
});
