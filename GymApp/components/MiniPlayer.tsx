/**
 * MiniPlayer.tsx
 *
 * Barra player persistente in basso, visibile in tutto l'app.
 * Mostra il brano corrente con miniatura, titolo, artista,
 * pulsanti play/pause e skip, più una progress bar sottile.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Pressable,
  StyleProp,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { useMusic } from '@/context/MusicContext';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { ThemedText } from './themed-text';
import { FullPlayerModal } from './FullPlayerModal';
import Ionicons from '@expo/vector-icons/Ionicons';

export function MiniPlayer({ style }: { style?: StyleProp<ViewStyle> }) {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    togglePlay,
    skipNext,
  } = useMusic();

  const { primaryColor } = useCustomTheme();
  const [modalVisible, setModalVisible] = useState(false);

  if (!currentTrack) return null;

  // Progresso 0–100 — se duration è 0 (sconosciuta) non mostriamo la barra
  const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const showProgress = duration > 0;

  return (
    <>
      <Pressable onPress={() => setModalVisible(true)} style={[styles.container, style]}>
        {/* Miniatura + info brano */}
        <View style={styles.left}>
          <Image source={{ uri: currentTrack.thumbnail }} style={styles.thumb} />
          {/* Indicatore pulsante "in play" */}
          {isPlaying && !isLoading && (
            <View style={[styles.playingDot, { backgroundColor: primaryColor }]} />
          )}
          <View style={styles.meta}>
            <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.title}>
              {currentTrack.title}
            </ThemedText>
            <ThemedText numberOfLines={1} style={styles.artist}>
              {currentTrack.artist}
            </ThemedText>
          </View>
        </View>

        {/* Controlli destra */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={togglePlay}
            style={styles.ctrlBtn}
            disabled={isLoading}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={skipNext}
            style={styles.ctrlBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="play-skip-forward" size={22} color="#aaa" />
          </TouchableOpacity>
        </View>

        {/* Progress bar sottile in fondo */}
        {showProgress && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercent}%`, backgroundColor: primaryColor },
              ]}
            />
          </View>
        )}
      </Pressable>

      <FullPlayerModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    backgroundColor: '#141414',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a2a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    position: 'relative',
    // Bordi arrotondati in alto per sembrare un "card" che emerge
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    // Ombra sottile
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
    position: 'relative',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 12,
  },
  playingDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    bottom: 0,
    left: 36,
    borderWidth: 1,
    borderColor: '#141414',
  },
  meta: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  title: {
    fontSize: 13,
    color: '#fff',
  },
  artist: {
    fontSize: 11,
    color: '#777',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctrlBtn: {
    padding: 8,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#222',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
