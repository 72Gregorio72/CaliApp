// Shared UI kit: every screen is built from these pieces so the app looks the same everywhere.
import { UI, themed } from '@/constants/theme';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { WEEK_DAYS, type DayWorkout } from '@/context/WeeklyPlanContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Stack, router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { dayKey, fmtVal, type Unit } from '@/lib/stats';

export type IconName = keyof typeof Ionicons.glyphMap;

/** Black or white, whichever reads better on `hex` (the user can pick a yellow accent). */
export function onColor(hex: string) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 160 ? '#0d0d0d' : '#fff';
}

/** Accent for icons/text on `UI.ink` (always dark): a dark accent would vanish there, so fall back to white. */
export const onInk = (accent: string) => (onColor(accent) === '#fff' ? '#fff' : accent);

/** Monday = 0 … Sunday = 6, matching WEEK_DAYS. */
export const todayIndex = () => (new Date().getDay() + 6) % 7;

// ---------- Text ----------
type TxtVariant = 'h1' | 'h2' | 'h3' | 'body' | 'muted' | 'label' | 'num';
export function Txt({ v = 'body', color, style, ...rest }: TextProps & { v?: TxtVariant; color?: string }) {
  return <Text style={[txt[v], color ? { color } : null, style]} {...rest} />;
}
const txt = themed(() => StyleSheet.create({
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '700', color: UI.text },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: UI.text },
  h3: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: UI.text },
  body: { fontSize: 15, lineHeight: 21, color: UI.text },
  muted: { fontSize: 14, lineHeight: 20, color: UI.muted },
  label: { fontSize: 13, fontWeight: '600', color: UI.muted },
  num: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: UI.text },
}));

// ---------- Screen ----------
/**
 * tab: full-bleed tab screen with its own big header.
 * otherwise: stack screen, `title` goes to the native header.
 */
export function Screen({
  title,
  subtitle,
  right,
  tab,
  footer,
  children,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  tab?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const body = (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={tab ? 0 : 90}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" bounces={false} overScrollMode="never">
        {tab && (title || right) ? (
          <View style={s.header}>
            <View style={s.flex}>
              {subtitle ? <Txt v="label">{subtitle}</Txt> : null}
              {title ? <Txt v="h1">{title}</Txt> : null}
            </View>
            {right}
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
  if (!tab) {
    return (
      <View style={s.screen}>
        {title ? <Stack.Screen options={{ title }} /> : null}
        {body}
      </View>
    );
  }
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {body}
    </SafeAreaView>
  );
}

// ---------- Surfaces ----------
export function Card({ children, onPress, onLongPress, style }: { children: ReactNode; onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle> }) {
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [s.card, pressed && s.pressed, style]}>
      {children}
    </Pressable>
  );
}

/** Solid accent card used for the main call to action of a screen. */
export function HeroCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { primaryColor } = useCustomTheme();
  return <View style={[s.hero, { backgroundColor: primaryColor }, style]}>{children}</View>;
}

export function Pill({ text, icon, tone = 'neutral' }: { text: string; icon?: IconName; tone?: 'neutral' | 'accent' | 'onAccent' }) {
  const { primaryColor } = useCustomTheme();
  const fg = tone === 'neutral' ? UI.muted : onColor(primaryColor);
  const bg = tone === 'accent' ? primaryColor : tone === 'onAccent' ? 'rgba(0,0,0,0.12)' : UI.surface;
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={13} color={fg} /> : null}
      <Text style={[s.pillText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Txt v="label">{title}</Txt>
        {action ? (
          <Pressable onPress={onAction} hitSlop={10}>
            <Text style={s.sectionAction}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={[s.card, s.stat]}>
      <Txt v="num">{value}</Txt>
      <Txt v="label" numberOfLines={1} adjustsFontSizeToFit>{label}</Txt>
    </View>
  );
}

/** List row: icon bubble, title/subtitle, chevron. */
export function Row({ icon, title, subtitle, onPress, right }: { icon?: IconName; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode }) {
  return (
    <Card onPress={onPress} style={s.row}>
      {icon ? (
        <View style={s.bubble}>
          <Ionicons name={icon} size={22} color={UI.text} />
        </View>
      ) : null}
      <View style={s.flex}>
        <Txt v="h3">{title}</Txt>
        {subtitle ? <Txt v="muted" numberOfLines={1}>{subtitle}</Txt> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={20} color={UI.subtle} /> : null)}
    </Card>
  );
}

export function Empty({ icon, title, text, action, actionIcon = 'add', onAction }: { icon: IconName; title: string; text?: string; action?: string; actionIcon?: IconName; onAction?: () => void }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={36} color={UI.text} />
      </View>
      <Txt v="h3" style={s.center}>{title}</Txt>
      {text ? <Txt v="muted" style={s.center}>{text}</Txt> : null}
      {action ? <Button title={action} icon={actionIcon} onPress={onAction} style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

// ---------- Controls ----------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onAccent';
export function Button({
  title,
  icon,
  onPress,
  variant = 'primary',
  small,
  disabled,
  iconRight,
  style,
}: {
  title: string;
  icon?: IconName;
  iconRight?: boolean;
  onPress?: () => void;
  variant?: ButtonVariant;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { primaryColor } = useCustomTheme();
  const look: Record<ButtonVariant, { bg: string; fg: string }> = {
    primary: { bg: UI.ink, fg: '#fff' },
    secondary: { bg: UI.card, fg: UI.text },
    ghost: { bg: 'transparent', fg: UI.text },
    danger: { bg: `${UI.danger}1f`, fg: UI.danger },
    onAccent: { bg: onColor(primaryColor), fg: primaryColor },
  };
  const { bg, fg } = look[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: bg }, variant === 'secondary' && s.btnOutline, iconRight && { flexDirection: 'row-reverse' }, (pressed || disabled) && s.pressed, style]}
    >
      {icon ? <Ionicons name={icon} size={small ? 16 : 20} color={variant === 'primary' ? onInk(primaryColor) : fg} /> : null}
      <Text style={[s.btnText, small && s.btnTextSmall, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, tone = 'neutral', label }: { icon: IconName; onPress?: () => void; tone?: 'neutral' | 'accent' | 'danger'; label: string }) {
  const { primaryColor } = useCustomTheme();
  const fg = tone === 'accent' ? onColor(primaryColor) : tone === 'danger' ? UI.danger : UI.text;
  const bg = tone === 'accent' ? primaryColor : tone === 'danger' ? `${UI.danger}1f` : UI.surface;
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} hitSlop={6} style={({ pressed }) => [s.iconBtn, { backgroundColor: bg }, pressed && s.pressed]}>
      <Ionicons name={icon} size={20} color={fg} />
    </Pressable>
  );
}

export function Field({ label, style, ...rest }: TextInputProps & { label?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.field}>
      {label ? <Txt v="label">{label}</Txt> : null}
      <TextInput
        placeholderTextColor={UI.subtle}
        selectionColor={UI.text}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[s.input, focused && { borderColor: UI.text }, rest.multiline && s.inputMulti, style]}
        {...rest}
      />
    </View>
  );
}

/** Bottom sheet modal. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} accessibilityLabel="Chiudi" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheet}>
        <View style={s.handle} />
        <Txt v="h2" style={{ marginBottom: 12 }}>{title}</Txt>
        <ScrollView keyboardShouldPersistTaps="handled" bounces={false} overScrollMode="never" contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** 7 dots Mon→Sun; filled = workout planned, ring = today. */
export function WeekStrip({ days, onPressDay }: { days: DayWorkout[]; onPressDay?: (index: number) => void }) {
  const { primaryColor } = useCustomTheme();
  const today = todayIndex();
  return (
    <View style={s.week}>
      {WEEK_DAYS.map((name, i) => {
        const on = !!days[i]?.workoutId;
        return (
          <Pressable key={name} onPress={on && onPressDay ? () => onPressDay(i) : undefined} style={s.weekDay} accessibilityLabel={`${name}${on ? ', allenamento' : ', riposo'}`}>
            <Text style={[s.weekLetter, i === today && { color: UI.text }]}>{name[0]}</Text>
            <View
              style={[
                s.weekDot,
                { backgroundColor: on ? UI.ink : UI.surface },
                i === today && { borderColor: UI.text, borderWidth: 2 },
              ]}
            >
              <Ionicons name={on ? 'barbell' : 'bed-outline'} size={14} color={on ? onInk(primaryColor) : UI.muted} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = themed(() => StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  screen: { flex: 1, backgroundColor: UI.bg },
  scroll: { padding: 20, paddingTop: 12, paddingBottom: 24, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  footer: { padding: 16, paddingBottom: 24, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: UI.border, backgroundColor: UI.bg },
  card: { backgroundColor: UI.card, borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: UI.border, gap: 10 },
  pressed: { opacity: 0.7 },
  hero: { borderRadius: 20, padding: 20, gap: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '600' },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionAction: { fontSize: 13, fontWeight: '500', color: UI.muted },
  stat: { flex: 1, alignItems: 'center', gap: 0, paddingVertical: 10, paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bubble: { width: 42, height: 42, borderRadius: 10, backgroundColor: UI.surface, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: UI.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  btn: { minHeight: 56, borderRadius: 999, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSmall: { minHeight: 40, paddingHorizontal: 14 },
  btnOutline: { borderWidth: 1, borderColor: UI.border },
  btnText: { fontSize: 16, fontWeight: '700' },
  btnTextSmall: { fontSize: 14 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  field: { gap: 6 },
  input: { backgroundColor: UI.input, borderWidth: 1, borderColor: UI.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: UI.text },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: UI.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 10, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: UI.borderStrong, marginBottom: 14 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 6, flex: 1 },
  weekLetter: { fontSize: 12, fontWeight: '600', color: UI.subtle },
  weekDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
}));

/** Weight trend; needs 2+ points to draw a line. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - ((v - min) / span) * 32}`).join(' ');
  return (
    <Svg width="100%" height={40} viewBox="0 0 100 40" preserveAspectRatio="none" accessibilityLabel={`Andamento: ${values.join(', ')}`}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </Svg>
  );
}

/** Change between two values: green up, red down, grey flat. */
export function Delta({ from, to, unit = 'kg' }: { from?: number; to?: number; unit?: Unit }) {
  if (from === undefined || to === undefined) return null;
  const d = Math.round((to - from) * 10) / 10;
  const color = d > 0 ? UI.success : d < 0 ? UI.danger : UI.muted;
  return (
    <View style={[s.pill, { backgroundColor: `${color}1f` }]}>
      <Ionicons name={d > 0 ? 'trending-up' : d < 0 ? 'trending-down' : 'remove'} size={13} color={color} />
      <Text style={[s.pillText, { color }]}>{`${d > 0 ? '+' : ''}${fmtVal(d, unit)}`}</Text>
    </View>
  );
}

/** Month of `now`, Monday first; filled days = at least one logged session, tap opens that day. */
export function MonthGrid({ now, trained, color }: { now: Date; trained: Set<string>; color: string }) {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cells = [...Array(offset).fill(0), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {WEEK_DAYS.map(d => (
        <Txt key={d} v="muted" style={{ width: `${100 / 7}%`, textAlign: 'center', fontSize: 11 }}>{d[0]}</Txt>
      ))}
      {cells.map((d, i) => {
        const on = d > 0 && trained.has(dayKey(new Date(now.getFullYear(), now.getMonth(), d)));
        const isToday = dayKey(new Date(now.getFullYear(), now.getMonth(), d)) === dayKey(new Date());
        return (
          <Pressable
            key={i}
            disabled={!on}
            onPress={() => router.push({ pathname: '/weekly-plans/day-history', params: { day: dayKey(new Date(now.getFullYear(), now.getMonth(), d)) } })}
            style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}
            accessibilityRole={on ? 'button' : undefined}
            accessibilityLabel={d ? `${d}${on ? ', allenamento fatto, apri storico' : ''}` : undefined}
          >
            {d ? (
              <View style={{ flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color : UI.surface, borderWidth: isToday ? 2 : 0, borderColor: UI.text }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: on ? onColor(color) : UI.muted }}>{d}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
