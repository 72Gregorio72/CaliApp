import { Card, Empty, IconButton, MonthGrid, Row, Screen, Section, Txt } from '@/components/ui/kit';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { useHistory } from '@/context/HistoryContext';
import { useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { dayKey, type SessionLog } from '@/lib/stats';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, View } from 'react-native';

export default function StatsScreen() {
  const { sessions } = useHistory();
  const { plans, activePlanId } = useWeeklyPlans();

  const openPlan = (planId: string) => router.push({ pathname: '/weekly-plans/history', params: { planId } });

  return (
    <Screen tab subtitle="Progressi" title="Stats">
      {plans.length ? (
        <Section title="Storico per scheda">
          {plans.map(p => (
            <Row
              key={p.id}
              icon={p.id === activePlanId ? 'checkmark-circle' : 'calendar-outline'}
              title={p.name}
              subtitle={`${sessions.filter(s => s.planId === p.id).length} allenamenti${p.id === activePlanId ? ' · attiva' : ''}`}
              onPress={() => openPlan(p.id)}
            />
          ))}
        </Section>
      ) : null}

      <Section title="Storico generale">
        {sessions.length === 0 ? (
          <Empty icon="stats-chart-outline" title="Nessun allenamento" text="Completa un allenamento e lo troverai qui." />
        ) : (
          <Card>
            <MonthPager sessions={sessions} />
          </Card>
        )}
      </Section>
    </Screen>
  );
}

/** Swipeable months, from the first logged session to the current month; opens on the current one. */
function MonthPager({ sessions }: { sessions: SessionLog[] }) {
  const { primaryColor } = useCustomTheme();
  const list = useRef<FlatList<Date>>(null);
  const [width, setWidth] = useState(0);
  const now = new Date();
  // at least the last 12 months, further back if the history goes further (stored newest first)
  const oldest = Math.min(new Date(sessions[sessions.length - 1].date).getTime(), new Date(now.getFullYear(), now.getMonth() - 11, 1).getTime());
  const months: Date[] = [];
  for (let d = new Date(new Date(oldest).getFullYear(), new Date(oldest).getMonth(), 1); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
  const [index, setIndex] = useState(months.length - 1);
  const trained = new Set(sessions.map(l => dayKey(new Date(l.date))));
  const shown = months[index] ?? now;
  const count = sessions.filter(l => {
    const d = new Date(l.date);
    return d.getMonth() === shown.getMonth() && d.getFullYear() === shown.getFullYear();
  }).length;
  const label = shown.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  const go = (i: number) => {
    if (i < 0 || i >= months.length) return;
    setIndex(i);
    list.current?.scrollToOffset({ offset: i * width, animated: true });
  };
  // dimmed and inert at the ends, so a dead arrow doesn't look broken
  const arrow = (dir: -1 | 1) => {
    const ok = index + dir >= 0 && index + dir < months.length;
    return (
      <View style={{ opacity: ok ? 1 : 0.3 }} pointerEvents={ok ? 'auto' : 'none'}>
        <IconButton icon={dir < 0 ? 'chevron-back' : 'chevron-forward'} label={dir < 0 ? 'Mese precedente' : 'Mese successivo'} onPress={() => go(index + dir)} />
      </View>
    );
  };

  return (
    <View style={{ gap: 10 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {arrow(-1)}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Txt v="h3" style={{ textTransform: 'capitalize' }}>{label}</Txt>
          <Txt v="muted">{`${count} allenamenti`}</Txt>
        </View>
        {arrow(1)}
      </View>
      {width > 0 ? (
        <FlatList
          ref={list}
          data={months}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={d => d.toISOString()}
          initialScrollIndex={months.length - 1}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={{ width }}>
              <MonthGrid now={item} trained={trained} color={primaryColor} />
            </View>
          )}
        />
      ) : null}
      <Txt v="muted" style={{ textAlign: 'center' }}>Scorri per cambiare mese · tocca un giorno colorato per lo storico</Txt>
    </View>
  );
}
