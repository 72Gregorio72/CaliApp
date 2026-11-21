import { WeightModal } from '@/components/session/WeightModal';
import { Card, Empty, IconButton, MonthGrid, Pill, Row, Screen, Section, Stat, Txt } from '@/components/ui/kit';
import { UI } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { useHistory } from '@/context/HistoryContext';
import { useWeeklyPlans } from '@/context/WeeklyPlanContext';
import { WeightChart } from '@/components/WeightChart';
import { dayKey, fmtDay, fmtVal, weeklyVolume, type SessionLog } from '@/lib/stats';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, View } from 'react-native';

export default function StatsScreen() {
  const { sessions, bodyWeights, addBodyWeight } = useHistory();
  const [weighing, setWeighing] = useState(false);
  const { plans, activePlanId } = useWeeklyPlans();
  const { primaryColor } = useCustomTheme();
  const weeks = weeklyVolume(sessions);

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

      {weeks.some(w => w.kg) ? (
        <Section title="Volume settimanale">
          <Card>
            <WeightChart points={weeks} color={primaryColor} unit="kg" />
            <Txt v="muted">Kg sollevati (serie × ripetizioni × peso) nelle ultime 12 settimane. Gli esercizi a rep o tenuta non contano.</Txt>
          </Card>
        </Section>
      ) : null}

      <Section title="Peso corporeo" action="Registra" onAction={() => setWeighing(true)}>
        {bodyWeights.length === 0 ? (
          <Empty icon="body-outline" title="Nessuna pesata" text="Registra il tuo peso ogni tanto per vederne l'andamento." action="Registra peso" onAction={() => setWeighing(true)} />
        ) : (
          <BodyWeightCard />
        )}
      </Section>
      <WeightModal visible={weighing} title="Peso corporeo" value={bodyWeights[0]?.kg} unit="kg" fixedUnit onSave={kg => addBodyWeight(kg)} onClose={() => setWeighing(false)} />

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

/** Current weight, changes, recent trend; tap opens every entry. */
function BodyWeightCard() {
  const { bodyWeights } = useHistory(); // newest first, never empty here
  const { primaryColor } = useCustomTheme();
  const cur = bodyWeights[0];
  // measured from the latest entry, not from now: Date.now() is impure during render
  const monthAgo = new Date(cur.date).getTime() - 30 * 864e5;
  // weight about 30 days ago: newest entry older than that, else the oldest one
  const base = bodyWeights.find((b, i) => new Date(b.date).getTime() < monthAgo || i === bodyWeights.length - 1);
  const kgs = bodyWeights.map(b => b.kg);
  // body weight up or down isn't good or bad by itself: neutral pills, no green/red
  const change = (from: number | undefined, label: string) => {
    if (from === undefined) return null;
    const d = Math.round((cur.kg - from) * 10) / 10;
    return <Pill icon={d > 0 ? 'trending-up' : d < 0 ? 'trending-down' : 'remove'} text={`${d > 0 ? '+' : ''}${fmtVal(d)} ${label}`} />;
  };

  return (
    <Card onPress={() => router.push('/weekly-plans/body-weight')}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <Txt v="label">Attuale</Txt>
          <Txt v="num">{fmtVal(cur.kg)}</Txt>
          <Txt v="muted" numberOfLines={1}>{fmtDay(cur.date)}</Txt>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {change(bodyWeights[1]?.kg, "dall'ultima")}
          {bodyWeights.length > 2 && base !== bodyWeights[1] ? change(base?.kg, 'in 30 gg') : null}
        </View>
      </View>
      {/* trend only: the full history is one tap away */}
      {bodyWeights.length > 1 ? <WeightChart points={bodyWeights.slice(0, 20).reverse()} color={primaryColor} unit="kg" height={180} /> : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Stat value={fmtVal(Math.min(...kgs))} label="Minimo" />
        <Stat value={fmtVal(Math.max(...kgs))} label="Massimo" />
        <Stat value={bodyWeights.length} label="Pesate" />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Txt v="label">Tutte le pesate</Txt>
        <Ionicons name="chevron-forward" size={14} color={UI.muted} />
      </View>
    </Card>
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
