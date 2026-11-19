import { UI } from '@/constants/theme';
import { Stack } from 'expo-router';

export default function WorkoutsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: UI.bg },
        headerTintColor: UI.text,
        headerTitleAlign: 'center',
        headerTitleStyle: { color: UI.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: UI.bg },
      }}
    >
      <Stack.Screen name="session" options={{ title: 'Allenamento' }} />
    </Stack>
  );
}
