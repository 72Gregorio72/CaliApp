import { ThemedText } from '@/components/themed-text';
import { onColor, onInk } from '@/components/ui/kit';
import { UI, themed } from '@/constants/theme';
import { useCustomTheme } from '@/context/CustomThemeContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export type TimerMode = 'countdown' | 'stopwatch';

/** 90 -> "1:30" */
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Dark card with stopwatch/countdown switch, progress ring and controls. */
export function TimerCard({ mode, onMode, seconds, progress, running, onReset, onToggle, onPlus15 }: {
  mode: TimerMode;
  onMode: (m: TimerMode) => void;
  seconds: number;
  progress: number; // 0..1
  running: boolean;
  onReset: () => void;
  onToggle: () => void;
  onPlus15: () => void;
}) {
  const { primaryColor, secondaryColor } = useCustomTheme();
  const [ringSize, setRingSize] = React.useState(0);
  const ringR = Math.max(0, ringSize / 2 - 6);
  const ringC = 2 * Math.PI * ringR;
  const fg = '#fff';

  return (
    <View style={[styles.card, { backgroundColor: UI.ink, borderColor: UI.ink }]}>
      <View style={[styles.segment, { backgroundColor: '#262626' }]}>
        {([['stopwatch', 'Cronometro', 'stopwatch-outline'], ['countdown', 'Timer', 'hourglass-outline']] as const).map(([key, label, icon]) => {
          const on = mode === key;
          const c = on ? onColor(primaryColor) : '#9a9a9a';
          return (
            <Pressable
              key={key}
              onPress={() => onMode(key)}
              style={[styles.segmentBtn, on && { backgroundColor: primaryColor }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Ionicons name={icon} size={16} color={c} />
              <Text style={[styles.segmentText, { color: c }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={styles.ringArea}
        // leave breathing room around the ring and cap it so tall phones don't get a giant dial
        onLayout={e => setRingSize(Math.max(0, Math.floor(Math.min(240, e.nativeEvent.layout.width - 24, e.nativeEvent.layout.height - 16))))}
      >
        <View style={[styles.ringWrap, { width: ringSize, height: ringSize }]}>
          <Svg width={ringSize} height={ringSize} style={StyleSheet.absoluteFill}>
            <Circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} stroke="#2c2c2c" strokeWidth={10} fill="none" />
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringR}
              stroke={onInk(primaryColor) === '#fff' ? secondaryColor : primaryColor}
              strokeWidth={10}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={ringC}
              strokeDashoffset={ringC * (1 - progress)}
              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
            />
          </Svg>
          <Text numberOfLines={1} style={[styles.digits, { color: fg, fontSize: Math.max(28, ringSize * 0.26) }]}>{clock(seconds)}</Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <Pressable style={styles.roundBtn} onPress={onReset} accessibilityLabel="Ripristina">
          <Ionicons name="refresh" size={20} color={fg} />
        </Pressable>
        <Pressable style={[styles.playBtn, { backgroundColor: primaryColor }]} onPress={onToggle} accessibilityLabel={running ? 'Pausa' : 'Avvia'}>
          <Ionicons name={running ? 'pause' : 'play'} size={28} color={onColor(primaryColor)} />
        </Pressable>
        {mode === 'countdown' ? (
          <Pressable style={styles.roundBtn} onPress={onPlus15} accessibilityLabel="Aggiungi 15 secondi">
            <Text style={styles.plus15}>+15 s</Text>
          </Pressable>
        ) : (
          <View style={styles.roundBtnSpacer} />
        )}
      </View>
    </View>
  );
}

/** Full-screen "rest over" alarm; tap anywhere to stop it. */
export function RestAlarm({ onStop }: { onStop: () => void }) {
  return (
    <Pressable style={styles.alarmOverlay} onPress={onStop}>
      <View style={styles.alarmCard}>
        <Ionicons name="alarm-outline" size={48} color={UI.text} />
        <ThemedText style={styles.alarmTitle} type="defaultSemiBold">Recupero Finito!</ThemedText>
        <ThemedText style={styles.alarmSub} type="default">Premi per fermare la sveglia</ThemedText>
        <Pressable style={[styles.alarmBtn, { backgroundColor: UI.ink }]} onPress={onStop}>
          <ThemedText style={styles.alarmBtnText} type="defaultSemiBold">Stop Sveglia</ThemedText>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { flex: 1, minHeight: 0, borderRadius: 28, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 8, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  segment: { flexDirection: 'row', alignSelf: 'stretch', borderRadius: 999, padding: 4 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 999 },
  segmentText: { fontSize: 14, fontWeight: '700' },
  ringArea: { flex: 1, minHeight: 150, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center', minWidth: 140, minHeight: 140 },
  digits: { fontWeight: '800', marginBottom: 2, fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36 },
  roundBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#3a3a3a', alignItems: 'center', justifyContent: 'center' },
  roundBtnSpacer: { width: 48 },
  playBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  plus15: { color: '#fff', fontSize: 13, fontWeight: '700' },
  alarmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  alarmCard: { backgroundColor: UI.card, borderWidth: StyleSheet.hairlineWidth, borderColor: UI.border, borderRadius: 16, padding: 28, alignItems: 'center', gap: 12, width: '85%' },
  alarmTitle: { fontSize: 26, color: UI.text, textAlign: 'center' },
  alarmSub: { fontSize: 14, color: UI.muted, textAlign: 'center' },
  alarmBtn: { marginTop: 8, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12, alignItems: 'center' },
  alarmBtnText: { color: '#fff', fontSize: 18 },
}));
