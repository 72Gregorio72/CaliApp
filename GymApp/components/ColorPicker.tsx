import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from './themed-text';

type ColorPickerProps = {
  value: string;
  onChange: (hex: string) => void;
};

// Conversione da HEX a HSL
function hexToHsl(hex: string) {
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

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);
  const [hsl, setHsl] = useState({ h: 220, s: 95, l: 50 });
  const [trackWidth, setTrackWidth] = useState(1);

  // Sincronizza lo stato HSL quando cambia il valore HEX esterno
  useEffect(() => {
    if (isValidHex(value)) {
      setHexInput(value);
      setHsl(hexToHsl(value));
    }
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

  const handleHueTouch = (e: any) => {
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    const h = Math.round(ratio * 360);
    const newHex = hslToHex(h, hsl.s, hsl.l);
    setHsl(prev => ({ ...prev, h }));
    onChange(newHex);
  };

  const handleLightnessTouch = (e: any) => {
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    // Limitiamo la luminosità tra il 25% e il 75% per garantire contrasto ottimale
    const l = Math.round(25 + ratio * 50);
    const newHex = hslToHex(hsl.h, hsl.s, l);
    setHsl(prev => ({ ...prev, l }));
    onChange(newHex);
  };

  const hexForMidLightness = hslToHex(hsl.h, 100, 50);

  // Calcola la posizione percentuale dei cursori
  const huePercent = (hsl.h / 360) * 100;
  // Mappa la luminosità (25-75%) in una percentuale (0-100%) per la visualizzazione sul cursore
  const lightnessPercent = ((hsl.l - 25) / 50) * 100;

  return (
    <View style={styles.container}>
      {/* Box Anteprima e Input HEX */}
      <View style={styles.headerRow}>
        <View style={[styles.previewBox, { backgroundColor: value }]} />
        <View style={styles.inputContainer}>
          <ThemedText style={styles.inputLabel}>{"Codice HEX:"}</ThemedText>
          <TextInput
            value={hexInput}
            onChangeText={handleHexChange}
            placeholder="#FFFFFF"
            placeholderTextColor="#666"
            maxLength={7}
            style={styles.hexInput}
          />
        </View>
      </View>

      {/* Cursore Tonalità (Hue) */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderLabelRow}>
          <ThemedText style={styles.sliderName}>{"Tonalità (Colore)"}</ThemedText>
          <ThemedText style={styles.sliderValue}>{`${hsl.h}°`}</ThemedText>
        </View>
        <View
          style={styles.trackContainer}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          onTouchStart={handleHueTouch}
          onTouchMove={handleHueTouch}
        >
          <LinearGradient
            colors={['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientBar}
          />
          {/* Cursore che indica il punto selezionato */}
          <View 
            pointerEvents="none" 
            style={[styles.thumb, { left: `${huePercent}%`, backgroundColor: value }]} 
          />
        </View>
      </View>

      {/* Cursore Luminosità (Lightness) */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderLabelRow}>
          <ThemedText style={styles.sliderName}>{"Luminosità (Contrasto)"}</ThemedText>
          <ThemedText style={styles.sliderValue}>{`${hsl.l}%`}</ThemedText>
        </View>
        <View
          style={styles.trackContainer}
          onTouchStart={handleLightnessTouch}
          onTouchMove={handleLightnessTouch}
        >
          <LinearGradient
            colors={['#404040', hexForMidLightness, '#e0e0e0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientBar}
          />
          {/* Cursore che indica il punto selezionato */}
          <View 
            pointerEvents="none" 
            style={[styles.thumb, { left: `${lightnessPercent}%`, backgroundColor: value }]} 
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    width: '100%',
    paddingVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  previewBox: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  inputContainer: {
    flex: 1,
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    color: '#999',
  },
  hexInput: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sliderSection: {
    gap: 8,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderName: {
    fontSize: 14,
    color: '#ccc',
  },
  sliderValue: {
    fontSize: 12,
    color: '#999',
  },
  trackContainer: {
    height: 20,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    paddingVertical: 4,
  },
  gradientBar: {
    height: 12,
    borderRadius: 6,
    width: '100%',
  },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    top: 3,
    marginLeft: -11, // Centra il thumb rispetto alla coordinata left
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 3,
  },
});
