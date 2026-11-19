/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Accent = primaryColor from CustomThemeContext, used as a fill or on `ink` surfaces
// (lime text on a light background is unreadable).
const LIGHT = {
  bg: '#F2F1EC',
  card: '#FFFFFF',
  surface: '#F2F1EC', // elements nested in a card (value boxes, chips)
  input: '#FFFFFF',
  border: '#E6E4DE',
  borderStrong: '#D4D2CB',
  text: '#141414',
  muted: '#6E6D68',
  subtle: '#A3A29C',
  ink: '#141414', // black buttons / dark cards, always with white text on top
  danger: '#E5484D',
  success: '#2F9E44',
};
export type Palette = typeof LIGHT;

const DARK: Palette = {
  bg: '#0F0F0E',
  card: '#1C1C1B',
  surface: '#272725',
  input: '#1C1C1B',
  border: '#2E2E2C',
  borderStrong: '#3E3E3B',
  text: '#F2F1EC',
  muted: '#A3A29C',
  subtle: '#6E6D68',
  ink: '#2E2E2C',
  danger: '#FF5A5F',
  success: '#3DBE5A',
};

/**
 * Current palette. Mutated in place by setPalette(); every StyleSheet that reads it is built
 * with themed() so it gets rebuilt too, and app/_layout remounts the screens so they re-read both.
 */
export const UI: Palette = { ...LIGHT };
const sheets: [object, () => object][] = [];

export function themed<T extends object>(make: () => T): T {
  const sheet = make();
  sheets.push([sheet, make]);
  return sheet;
}

export function setPalette(darkMode: boolean) {
  Object.assign(UI, darkMode ? DARK : LIGHT);
  for (const [sheet, make] of sheets) Object.assign(sheet, make());
}

const dark = {
  get text() { return UI.text; },
  get background() { return UI.bg; },
  get tint() { return UI.text; },
  icon: '#9BA1A6',
  tabIconDefault: '#9BA1A6',
  get tabIconSelected() { return UI.text; },
};

export const Colors = { light: dark, dark };

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
