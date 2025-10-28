import { Stack } from 'expo-router';

export default function WorkoutsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0d0d0d',
        },
        headerTintColor: '#7AA0FF',
        contentStyle: {
          backgroundColor: '#0d0d0d',
        },
      }}
    />
  );
}


