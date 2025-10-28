import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { WorkoutProvider } from '@/app/context/WorkoutContext';
import { WeeklyPlanProvider } from '@/app/context/WeeklyPlanContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { View, StyleSheet } from 'react-native';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
});
