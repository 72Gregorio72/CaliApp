import { UI } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS: { name: string; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'training', title: 'Allenamenti', icon: 'barbell' },
  { name: 'plans', title: 'Schede', icon: 'calendar' },
  { name: 'stats', title: 'Stats', icon: 'stats-chart' },
];

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: UI.text,
        tabBarInactiveTintColor: UI.subtle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: UI.bg,
          borderTopColor: UI.border,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
        },
      }}>
      {TABS.map(t => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? t.icon : (`${t.icon}-outline` as keyof typeof Ionicons.glyphMap)} size={24} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
