import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

type CustomThemeContextType = {
  primaryColor: string;
  secondaryColor: string;
  setPrimaryColor: (color: string) => Promise<void>;
  setSecondaryColor: (color: string) => Promise<void>;
  isLoading: boolean;
};

const CustomThemeContext = createContext<CustomThemeContextType | null>(null);

const PRIMARY_KEY = '@gym_app_primary_color';
const SECONDARY_KEY = '@gym_app_secondary_color';

// Colori di default
export const DEFAULT_PRIMARY = '#7AA0FF'; // Azzurro
export const DEFAULT_SECONDARY = '#FF8A65'; // Arancio

export const PRIMARY_COLOR_OPTIONS = [
  { name: 'Azzurro', value: '#7AA0FF' },
  { name: 'Smeraldo', value: '#4CAF50' },
  { name: 'Corallo', value: '#FF6B6B' },
  { name: 'Viola', value: '#BA68C8' },
  { name: 'Arancio', value: '#FF8A65' },
  { name: 'Giallo', value: '#FFD54F' },
];

export const SECONDARY_COLOR_OPTIONS = [
  { name: 'Arancio', value: '#FF8A65' },
  { name: 'Viola', value: '#BA68C8' },
  { name: 'Smeraldo', value: '#4CAF50' },
  { name: 'Azzurro', value: '#7AA0FF' },
  { name: 'Grigio', value: '#A0A0A0' },
  { name: 'Rosa', value: '#FF80AB' },
];

export function CustomThemeProvider({ children }: { children: React.ReactNode }) {
  const [primaryColor, setPrimaryState] = useState(DEFAULT_PRIMARY);
  const [secondaryColor, setSecondaryState] = useState(DEFAULT_SECONDARY);
  const [isLoading, setIsLoading] = useState(true);

  // Carica i colori memorizzati all'avvio
  useEffect(() => {
    loadThemeColors();
  }, []);

  const loadThemeColors = async () => {
    try {
      const storedPrimary = await AsyncStorage.getItem(PRIMARY_KEY);
      const storedSecondary = await AsyncStorage.getItem(SECONDARY_KEY);
      if (storedPrimary) {
        setPrimaryState(storedPrimary);
      }
      if (storedSecondary) {
        setSecondaryState(storedSecondary);
      }
    } catch (error) {
      console.error('Errore nel caricamento del tema personalizzato:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setPrimaryColor = async (color: string) => {
    try {
      setPrimaryState(color);
      await AsyncStorage.setItem(PRIMARY_KEY, color);
    } catch (error) {
      console.error('Errore nel salvataggio del colore primario:', error);
    }
  };

  const setSecondaryColor = async (color: string) => {
    try {
      setSecondaryState(color);
      await AsyncStorage.setItem(SECONDARY_KEY, color);
    } catch (error) {
      console.error('Errore nel salvataggio del colore secondario:', error);
    }
  };

  return (
    <CustomThemeContext.Provider
      value={{
        primaryColor,
        secondaryColor,
        setPrimaryColor,
        setSecondaryColor,
        isLoading,
      }}
    >
      {children}
    </CustomThemeContext.Provider>
  );
}

export function useCustomTheme() {
  const context = useContext(CustomThemeContext);
  if (!context) {
    throw new Error('useCustomTheme deve essere utilizzato all\'interno di un CustomThemeProvider');
  }
  return context;
}
