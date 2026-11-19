import { ThemedText } from '@/components/themed-text';
import { UI, themed } from '@/constants/theme';
import { UNITS, parseKg, type Unit } from '@/lib/stats';
import React from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const PLACEHOLDER: Record<Unit, string> = { kg: 'kg, es. 80 o 82,5', reps: 'ripetizioni, es. 12', sec: 'secondi di tenuta, es. 30' };
const INVALID: Record<Unit, string> = {
  kg: 'Inserisci solo il numero di kg, es. 80 o 82,5.',
  reps: 'Inserisci solo il numero di ripetizioni, es. 12.',
  sec: 'Inserisci solo i secondi di tenuta, es. 30.',
};

/** Enter a value (kg / rep / tenuta) for one exercise. State resets each time it opens. */
export function WeightModal({ visible, title, value, unit, fixedUnit, info, onSave, onClose }: {
  visible: boolean;
  title: string;
  value?: number;
  unit: Unit;
  fixedUnit?: boolean; // hide the kg / rep / tenuta switch
  info?: (unit: Unit) => string;
  onSave: (value: number, unit: Unit) => void;
  onClose: () => void;
}) {
  const [text, setText] = React.useState('');
  const [u, setU] = React.useState<Unit>(unit);
  React.useEffect(() => {
    if (!visible) return;
    setText(value ? String(value).replace('.', ',') : '');
    setU(unit);
  }, [visible, value, unit]);

  const save = () => {
    const v = parseKg(text);
    if (v === undefined) return Alert.alert('Valore non valido', INVALID[u]);
    onSave(v, u);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={e => e.stopPropagation()}>
          <ThemedText type="subtitle" style={styles.title}>Registra - {title}</ThemedText>

          {fixedUnit ? null : <View style={styles.unitRow} accessibilityRole="tablist">
            {UNITS.map(({ unit: k, label }) => (
              <Pressable
                key={k}
                onPress={() => setU(k)}
                accessibilityRole="tab"
                accessibilityState={{ selected: u === k }}
                style={[styles.unitBtn, u === k && { backgroundColor: UI.ink }]}
              >
                <Text style={[styles.unitText, u === k && { color: '#fff' }]}>{label}</Text>
              </Pressable>
            ))}
          </View>}

          {info ? <ThemedText type="default" style={styles.info}>{info(u)}</ThemedText> : null}

          <TextInput
            style={styles.input}
            placeholder={PLACEHOLDER[u]}
            placeholderTextColor={UI.muted}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            value={text}
            onChangeText={setText}
          />

          <View style={styles.buttons}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose}>
              <ThemedText style={{ color: UI.danger }} type="defaultSemiBold">Annulla</ThemedText>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: UI.ink }]} onPress={save}>
              <ThemedText style={{ color: '#fff' }} type="defaultSemiBold">Salva</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { width: '100%', maxWidth: 340, backgroundColor: UI.card, borderRadius: 14, padding: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: UI.border, gap: 16 },
  title: { color: UI.text, fontSize: 20, textAlign: 'center' },
  unitRow: { flexDirection: 'row', backgroundColor: UI.surface, borderRadius: 12, padding: 4, gap: 4 },
  unitBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  unitText: { fontSize: 14, fontWeight: '700', color: UI.muted },
  info: { fontSize: 14, textAlign: 'center', color: UI.muted },
  input: { borderWidth: 1, borderColor: UI.border, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, fontSize: 18, color: UI.text, backgroundColor: UI.input, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { borderWidth: 1.5, borderColor: UI.borderStrong, backgroundColor: 'transparent' },
}));
