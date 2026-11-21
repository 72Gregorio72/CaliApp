import { WeightChart } from '@/components/WeightChart';
import { Card, Empty, Pill, Screen, Section, Stat, Txt } from '@/components/ui/kit';
import { UI } from '@/constants/theme';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { useHistory } from '@/context/HistoryContext';
import { fmtDay, fmtShort, fmtVal } from '@/lib/stats';
import { Alert, View } from 'react-native';

/** All body weight entries, split in sections: trend chart, summary, full history. */
export default function BodyWeightScreen() {
  const { bodyWeights, removeBodyWeight } = useHistory(); // newest first
  const { primaryColor } = useCustomTheme();

  const confirmRemove = (date: string, kg: number) =>
    Alert.alert('Elimina pesata', `Eliminare ${fmtVal(kg)} del ${fmtShort(date)}?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => removeBodyWeight(date) },
    ]);

  if (bodyWeights.length === 0) {
    return (
      <Screen title="Peso corporeo">
        <Empty icon="body-outline" title="Nessuna pesata" text="Registra il tuo peso dalla tab Stats." />
      </Screen>
    );
  }

  const kgs = bodyWeights.map(b => b.kg);
  const total = Math.round((kgs[0] - kgs[kgs.length - 1]) * 10) / 10;

  return (
    <Screen title="Peso corporeo">
      <Section title="Andamento">
        <Card>
          <WeightChart points={[...bodyWeights].reverse()} color={primaryColor} unit="kg" height={220} />
        </Card>
      </Section>

      <Section title="Riepilogo">
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat value={fmtVal(kgs[0])} label="Attuale" />
          <Stat value={fmtVal(Math.min(...kgs))} label="Minimo" />
          <Stat value={fmtVal(Math.max(...kgs))} label="Massimo" />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat value={bodyWeights.length} label="Pesate" />
          <Stat value={`${total > 0 ? '+' : ''}${fmtVal(total)}`} label="Variazione totale" />
        </View>
      </Section>

      <Section title="Storico">
        {bodyWeights.map((b, i) => {
          const prev = bodyWeights[i + 1];
          const d = prev ? Math.round((b.kg - prev.kg) * 10) / 10 : undefined;
          return (
            <Card
              key={b.date}
              onPress={() => {}}
              onLongPress={() => confirmRemove(b.date, b.kg)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
            >
              <View style={{ flexShrink: 1 }}>
                <Txt v="h3">{fmtVal(b.kg)}</Txt>
                <Txt v="muted" numberOfLines={1}>{fmtDay(b.date)}</Txt>
              </View>
              {/* neutral like the Stats card: weight up or down isn't good or bad by itself */}
              {d !== undefined ? (
                <Pill icon={d > 0 ? 'trending-up' : d < 0 ? 'trending-down' : 'remove'} text={`${d > 0 ? '+' : ''}${fmtVal(d)}`} />
              ) : null}
            </Card>
          );
        })}
        <Txt v="muted" style={{ fontSize: 11, textAlign: 'center', color: UI.subtle }}>Tieni premuto una pesata per eliminarla</Txt>
      </Section>
    </Screen>
  );
}
