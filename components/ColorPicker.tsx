import { UI, themed } from '@/constants/theme';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TextInput, Pressable, useWindowDimensions, GestureResponderEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { ThemedText } from './themed-text';

type ColorPickerProps = {
  value: string;
  onChange: (hex: string) => void;
  presets?: { name: string; value: string }[];
};

type Hsl = { h: number; s: number; l: number };

// Conversione da HEX a HSL
function hexToHsl(hex: string): Hsl {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Conversione da HSL a HEX
function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Verifica se la stringa è un colore HEX valido
function isValidHex(hex: string) {
  return /^#[0-9A-F]{6}$/i.test(hex);
}

// Ruota statica a luminosità 50%: disegnata una volta sola, la luminosità è un velo nero/bianco sopra
// (in HSL la luminosità è proprio una miscela lineare verso nero/bianco, quindi il risultato è esatto).
const D = 200;
const R = D / 2;
const SEGMENTS = 120;
const point = (deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return `${R + R * Math.cos(rad)} ${R + R * Math.sin(rad)}`;
};
const WHEEL_SVG = (
  <Svg width="100%" height="100%" viewBox={`0 0 ${D} ${D}`} pointerEvents="none">
    <Defs>
      <RadialGradient id="sat" cx={R} cy={R} r={R} gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor="#808080" stopOpacity={1} />
        <Stop offset="1" stopColor="#808080" stopOpacity={0} />
      </RadialGradient>
    </Defs>
    {Array.from({ length: SEGMENTS }, (_, i) => {
      const step = 360 / SEGMENTS;
      // +0.5° overlap hides the hairline gaps between wedges
      return <Path key={i} d={`M${R} ${R} L${point(i * step)} A${R} ${R} 0 0 1 ${point((i + 1) * step + 0.5)} Z`} fill={hslToHex(i * step, 100, 50)} />;
    })}
    <Circle cx={R} cy={R} r={R} fill="url(#sat)" />
  </Svg>
);

export function ColorPicker({ value, onChange, presets }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);
  const [hsl, setHsl] = useState<Hsl>(() => (isValidHex(value) ? hexToHsl(value) : { h: 220, s: 95, l: 50 }));
  const hslRef = useRef(hsl);
  hslRef.current = hsl;
  const [trackWidth, setTrackWidth] = useState(1);
  const origin = useRef({ x: 0, y: 0 });
  const { width, height } = useWindowDimensions();
  const size = Math.round(Math.min(300, width - 64, height * 0.34));

  const current = hslToHex(hsl.h, hsl.s, hsl.l);

  // Sincronizza lo stato HSL quando cambia il valore HEX esterno
  useEffect(() => {
    if (!isValidHex(value)) return;
    setHexInput(value.toUpperCase());
    // keep the user's hue when the color is gray (hexToHsl would reset it to 0)
    setHsl(prev => (hslToHex(prev.h, prev.s, prev.l) === value.toUpperCase() ? prev : hexToHsl(value)));
  }, [value]);

  const handleHexChange = (text: string) => {
    let cleaned = text.toUpperCase();
    if (!cleaned.startsWith('#')) {
      cleaned = '#' + cleaned;
    }
    setHexInput(cleaned);

    if (isValidHex(cleaned)) {
      onChange(cleaned);
    }
  };

  const onWheel = (x: number, y: number) => {
    const dx = x - size / 2;
    const dy = y - size / 2;
    const h = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360);
    const s = Math.round(Math.min(1, Math.hypot(dx, dy) / (size / 2)) * 100);
    setHsl(prev => ({ ...prev, h, s }));
  };

  const onLightness = (x: number) => {
    // Limitiamo la luminosità tra il 25% e il 75% per garantire contrasto ottimale
    const l = Math.round(25 + Math.max(0, Math.min(1, x / trackWidth)) * 50);
    setHsl(prev => ({ ...prev, l }));
  };

  // While dragging only this component updates; the app theme (and its storage write) changes on release.
  // Coordinates come from pageX/Y minus the origin fixed at touch start: locationX jumps around on Android.
  const drag = (handler: (x: number, y: number) => void) => ({
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      const n = e.nativeEvent;
      origin.current = { x: n.pageX - n.locationX, y: n.pageY - n.locationY };
      handler(n.locationX, n.locationY);
    },
    onResponderMove: (e: GestureResponderEvent) => handler(e.nativeEvent.pageX - origin.current.x, e.nativeEvent.pageY - origin.current.y),
    onResponderRelease: commit,
    onResponderTerminate: commit,
  });
  function commit() {
    const { h, s, l } = hslRef.current;
    onChange(hslToHex(h, s, l));
  }

  // Posizione del cursore sulla ruota
  const rad = ((hsl.h - 90) * Math.PI) / 180;
  const thumbX = size / 2 + (hsl.s / 100) * (size / 2) * Math.cos(rad);
  const thumbY = size / 2 + (hsl.s / 100) * (size / 2) * Math.sin(rad);
  // Mappa la luminosità (25-75%) in una percentuale (0-100%) per la visualizzazione sul cursore
  const lightnessPercent = ((hsl.l - 25) / 50) * 100;

  return (
    <View style={styles.container}>
      {/* Anteprima, HEX e colori rapidi */}
      <View style={styles.headerRow}>
        <View style={[styles.previewBox, { backgroundColor: current }]} />
        <TextInput
          value={hexInput}
          onChangeText={handleHexChange}
          placeholder="#FFFFFF"
          placeholderTextColor={UI.subtle}
          maxLength={7}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Codice HEX"
          style={styles.hexInput}
        />
      </View>

      {presets?.length ? (
        <View style={styles.presets}>
          {presets.map(p => {
            const selected = p.value.toUpperCase() === value.toUpperCase();
            return (
              <Pressable
                key={p.value}
                onPress={() => onChange(p.value)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={p.name}
                accessibilityState={{ selected }}
                style={[styles.swatch, { backgroundColor: p.value }, selected && styles.swatchSelected]}
              />
            );
          })}
        </View>
      ) : null}

      {/* Ruota dei colori: angolo = tonalità, distanza dal centro = saturazione */}
      <View
        style={{ width: size, height: size, alignSelf: 'center' }}
        accessibilityLabel={`Ruota dei colori, tonalità ${hsl.h}°, saturazione ${hsl.s}%`}
        {...drag(onWheel)}
      >
        {WHEEL_SVG}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: hsl.l < 50 ? '#000' : '#fff', opacity: Math.abs(hsl.l - 50) / 50 }]}
        />
        <View pointerEvents="none" style={[styles.wheelThumb, { left: thumbX - 14, top: thumbY - 14, backgroundColor: current }]} />
      </View>

      {/* Cursore Luminosità (Lightness) */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderLabelRow}>
          <ThemedText style={styles.sliderName}>{"Luminosità"}</ThemedText>
          <ThemedText style={styles.sliderValue}>{`${hsl.l}%`}</ThemedText>
        </View>
        <View
          style={styles.trackContainer}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          {...drag(onLightness)}
        >
          <LinearGradient
            pointerEvents="none"
            colors={[hslToHex(hsl.h, hsl.s, 25), hslToHex(hsl.h, hsl.s, 50), hslToHex(hsl.h, hsl.s, 75)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientBar}
          />
          <View
            pointerEvents="none"
            style={[styles.thumb, { left: `${lightnessPercent}%`, backgroundColor: current }]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: {
    gap: 12,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.borderStrong,
  },
  hexInput: {
    flex: 1,
    backgroundColor: UI.input,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: UI.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  presets: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: UI.border,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: UI.text,
  },
  wheelThumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  sliderSection: {
    gap: 4,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderName: {
    fontSize: 14,
    color: UI.text,
  },
  sliderValue: {
    fontSize: 12,
    color: UI.muted,
  },
  trackContainer: {
    height: 32,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  gradientBar: {
    height: 14,
    borderRadius: 7,
    width: '100%',
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#fff',
    top: 4,
    marginLeft: -12, // Centra il thumb rispetto alla coordinata left
  },
}));
