/**
 * FullPlayerModal.tsx
 *
 * Modale fullscreen del player musicale, stile Spotify.
 * Mostra album art, titolo, artista, seek bar interattiva e controlli.
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Pressable,
  GestureResponderEvent,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMusic } from '@/context/MusicContext';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { ThemedText } from './themed-text';
import Ionicons from '@expo/vector-icons/Ionicons';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function FullPlayerModal({ visible, onClose }: Props) {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    isShuffle,
    isRepeat,
    queue,
    togglePlay,
    skipNext,
    skipPrevious,
    seekTo,
    removeFromQueue,
    clearQueue,
    toggleShuffle,
    toggleRepeat,
  } = useMusic();

  const { primaryColor } = useCustomTheme();
  const [showQueue, setShowQueue] = useState(false);
  const [barWidth, setBarWidth] = useState(0);

  // Animazione "breathe" dell'album art mentre suona
  const [scaleAnim] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (visible && isPlaying) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.03, duration: 2000, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      scaleAnim.setValue(1);
    }
  }, [visible, isPlaying, scaleAnim]);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSeekBar = (e: GestureResponderEvent) => {
    if (!duration || duration <= 0 || barWidth <= 0) return;
    const x = e.nativeEvent.locationX;
    const pct = Math.min(Math.max(0, x / barWidth), 1);
    seekTo(pct * duration);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </TouchableOpacity>
          <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
            {showQueue ? 'Coda di Riproduzione' : 'In Riproduzione'}
          </ThemedText>
          <TouchableOpacity onPress={() => setShowQueue((v) => !v)} style={styles.iconBtn}>
            <Ionicons name="list" size={24} color={showQueue ? primaryColor : '#fff'} />
          </TouchableOpacity>
        </View>

        {!showQueue ? (
          /* ════════════════════════════════════════
             VISTA PLAYER PRINCIPALE
          ════════════════════════════════════════ */
          <View style={styles.playerContent}>

            {/* Album Art */}
            <Animated.View style={[styles.coverContainer, { transform: [{ scale: scaleAnim }] }]}>
              <Image source={{ uri: currentTrack.thumbnail }} style={styles.coverImage} />
              {/* Riflesso sfocato sotto il cover */}
              <View style={styles.coverShadow} />
            </Animated.View>

            {/* Titolo e Artista */}
            <View style={styles.trackInfo}>
              <ThemedText numberOfLines={1} style={styles.trackTitle}>
                {currentTrack.title}
              </ThemedText>
              <ThemedText numberOfLines={1} style={styles.trackArtist}>
                {currentTrack.artist}
              </ThemedText>
            </View>

            {/* Seek Bar */}
            <View style={styles.seekSection}>
              <Pressable
                onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                onPress={handleSeekBar}
                style={styles.progressBg}
              >
                {/* Barra riempita */}
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercent}%`, backgroundColor: primaryColor },
                  ]}
                />
                {/* Pallino trascinabile */}
                {duration > 0 && (
                  <View
                    style={[
                      styles.progressKnob,
                      { left: `${progressPercent}%`, backgroundColor: primaryColor },
                    ]}
                  />
                )}
              </Pressable>

              <View style={styles.timeRow}>
                <ThemedText style={styles.timeText}>{formatTime(currentTime)}</ThemedText>
                {duration > 0 ? (
                  <ThemedText style={styles.timeText}>{formatTime(duration)}</ThemedText>
                ) : (
                  <ThemedText style={styles.timeText}>—:——</ThemedText>
                )}
              </View>
            </View>

            {/* Controlli */}
            <View style={styles.controls}>
              {/* Shuffle */}
              <TouchableOpacity onPress={toggleShuffle} style={styles.sideBtn}>
                <Ionicons
                  name="shuffle"
                  size={24}
                  color={isShuffle ? primaryColor : '#555'}
                />
                {isShuffle && (
                  <View style={[styles.activeDot, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>

              {/* Precedente */}
              <TouchableOpacity onPress={skipPrevious} style={styles.skipBtn}>
                <Ionicons name="play-skip-back" size={34} color="#fff" />
              </TouchableOpacity>

              {/* Play / Pause */}
              <TouchableOpacity
                onPress={togglePlay}
                style={[styles.playPauseBtn, { backgroundColor: primaryColor }]}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color="#000" style={{ marginLeft: isPlaying ? 0 : 3 }} />
                )}
              </TouchableOpacity>

              {/* Successivo */}
              <TouchableOpacity onPress={skipNext} style={styles.skipBtn}>
                <Ionicons name="play-skip-forward" size={34} color="#fff" />
              </TouchableOpacity>

              {/* Repeat */}
              <TouchableOpacity onPress={toggleRepeat} style={styles.sideBtn}>
                <Ionicons
                  name={isRepeat === 'track' ? 'repeat-outline' : 'repeat'}
                  size={24}
                  color={isRepeat !== 'off' ? primaryColor : '#555'}
                />
                {isRepeat !== 'off' && (
                  <View style={[styles.activeDot, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>
            </View>

          </View>
        ) : (
          /* ════════════════════════════════════════
             VISTA CODA
          ════════════════════════════════════════ */
          <View style={styles.queueContainer}>
            <View style={styles.queueHeaderRow}>
              <ThemedText style={styles.queueSectionLabel}>IN RIPRODUZIONE</ThemedText>
              {queue.length > 0 && (
                <TouchableOpacity onPress={clearQueue}>
                  <ThemedText style={[styles.clearBtn, { color: primaryColor }]}>
                    Svuota coda
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>

            {/* Traccia attiva */}
            <View style={[styles.trackRow, styles.activeRow, { borderColor: `${primaryColor}55` }]}>
              <Image source={{ uri: currentTrack.thumbnail }} style={styles.qThumb} />
              <View style={styles.qMeta}>
                <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ color: primaryColor }}>
                  {currentTrack.title}
                </ThemedText>
                <ThemedText style={styles.qArtist} numberOfLines={1}>
                  {currentTrack.artist}
                </ThemedText>
              </View>
              <Ionicons name="volume-high" size={20} color={primaryColor} />
            </View>

            <ThemedText style={styles.queueSectionLabel}>PROSSIMI ({queue.length})</ThemedText>

            <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
              {queue.length === 0 ? (
                <ThemedText style={styles.emptyQueue}>
                  La coda è vuota.{'\n'}Aggiungi brani dalla playlist.
                </ThemedText>
              ) : (
                queue.map((track, idx) => (
                  <View key={`q_${track.id}_${idx}`} style={styles.trackRow}>
                    <Image source={{ uri: track.thumbnail }} style={styles.qThumb} />
                    <View style={styles.qMeta}>
                      <ThemedText type="defaultSemiBold" numberOfLines={1}>
                        {track.title}
                      </ThemedText>
                      <ThemedText style={styles.qArtist}>{track.artist}</ThemedText>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeFromQueue(idx)}
                      style={styles.removeBtn}
                    >
                      <Ionicons name="close-circle" size={22} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070707',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 13,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  iconBtn: {
    padding: 8,
  },
  // Player content
  playerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  coverContainer: {
    width: SCREEN_WIDTH - 72,
    height: SCREEN_WIDTH - 72,
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  trackInfo: {
    width: '100%',
    alignItems: 'flex-start',
    gap: 4,
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  trackArtist: {
    fontSize: 16,
    color: '#888',
  },
  // Seek
  seekSection: {
    width: '100%',
  },
  progressBg: {
    width: '100%',
    height: 4,
    backgroundColor: '#2a2a2a',
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    transform: [{ translateX: -7 }],
    elevation: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  sideBtn: {
    padding: 8,
    position: 'relative',
    alignItems: 'center',
  },
  skipBtn: {
    padding: 8,
  },
  playPauseBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  // Queue
  queueContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  queueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  queueSectionLabel: {
    fontSize: 11,
    color: '#555',
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
  },
  clearBtn: {
    fontSize: 13,
    fontWeight: '600',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeRow: {
    backgroundColor: '#181818',
    borderWidth: 1,
  },
  qThumb: {
    width: 46,
    height: 46,
    borderRadius: 4,
    marginRight: 12,
  },
  qMeta: {
    flex: 1,
    gap: 2,
  },
  qArtist: {
    fontSize: 12,
    color: '#666',
  },
  removeBtn: {
    padding: 6,
  },
  emptyQueue: {
    color: '#444',
    textAlign: 'center',
    marginTop: 40,
    lineHeight: 22,
    fontSize: 14,
  },
});
