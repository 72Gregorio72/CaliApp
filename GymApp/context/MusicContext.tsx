/**
 * MusicContext.tsx
 *
 * Contesto globale per il player musicale YouTube.
 * Usa react-native-youtube-iframe tramite YTPlayerBridge (montato nel root layout).
 *
 * ─── COME CAMBIARE I BRANI ───────────────────────────────────────────────────
 * 1. Trova il video su YouTube
 * 2. Copia il videoId dall'URL (la parte dopo ?v= o l'ID a 11 caratteri)
 *    Esempio: youtube.com/watch?v=dQw4w9WgXcQ → id: 'dQw4w9WgXcQ'
 * 3. Aggiorna il campo `id` nella traccia corrispondente in CURATED_PLAYLISTS
 * 4. Aggiorna anche `title`, `artist` e `duration` (durata in secondi)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  RefObject,
} from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PLAYER_STATES } from 'react-native-youtube-iframe';
import type { YTPlayerBridgeRef } from '@/components/YTPlayerBridge';
import { getYoutubeVideoIdForMetadata } from '@/services/YouTubeSearchService';


// ═══════════════════════════════════════════════════════════════
// TIPI
// ═══════════════════════════════════════════════════════════════

export type Track = {
  /**
   * YouTube videoId — 11 caratteri, es. "dQw4w9WgXcQ"
   * Trovalo nell'URL: youtube.com/watch?v=<QUI>
   */
  id: string;
  title: string;
  artist: string;
  /** URL thumbnail — generata automaticamente da YouTube */
  thumbnail: string;
  /** Durata in secondi (usato per la progress bar). 0 = sconosciuta */
  duration: number;
};

export type CuratedPlaylist = {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  tracks: Track[];
};

type MusicContextType = {
  // Stato corrente
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  // Coda e preferenze
  queue: Track[];
  history: Track[];
  isShuffle: boolean;
  isRepeat: 'off' | 'track' | 'queue';
  // Dati
  curatedPlaylists: CuratedPlaylist[];
  customTracks: Track[];
  // Compat legacy
  apiKey: string | null;
  // Azioni pubbliche
  playTrack: (track: Track) => void;
  togglePlay: () => void;
  skipNext: () => void;
  skipPrevious: () => void;
  seekTo: (seconds: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playPlaylist: (playlist: CuratedPlaylist) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addCustomTrack: (title: string, artist: string, videoId: string) => Promise<void>;
  removeCustomTrack: (videoId: string) => Promise<void>;
  setApiKey: (key: string | null) => Promise<void>;
  // ─── Interni usati da YTPlayerBridge ───
  _ytBridgeRef: RefObject<YTPlayerBridgeRef | null>;
  _onYTStateChange: (state: string) => void;
  _onYTReady: () => void;
  _onYTError: (error: string) => void;
  _currentVideoId: string;
};

// ═══════════════════════════════════════════════════════════════
// PLAYLIST CURATE
// ═══════════════════════════════════════════════════════════════
//
// ▸ Per ogni traccia: cambia `id` con un videoId YouTube valido
// ▸ Le miniature vengono generate automaticamente da YouTube:
//   https://img.youtube.com/vi/<videoId>/mqdefault.jpg
//
export const CURATED_PLAYLISTS: CuratedPlaylist[] = [
  {
    id: 'hardcore_workout',
    name: 'Hardcore Workout',
    description: 'Hardstyle e Techno aggressivo per sollevamento pesante e nuovi PR.',
    coverImage:
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=400&auto=format&fit=crop',
    tracks: [
      {
        id: 'umkgO1V9BFE', // ← Cambia questo videoId per cambiare canzone
        title: 'B-day',
        artist: 'Noisecontrollers',
        thumbnail: 'https://img.youtube.com/vi/umkgO1V9BFE/mqdefault.jpg',
        duration: 270,
      },
      {
        id: 'l5aZJBLAu1E',
        title: 'Crash & Burn',
        artist: 'Headhunterz',
        thumbnail: 'https://img.youtube.com/vi/l5aZJBLAu1E/mqdefault.jpg',
        duration: 318,
      },
      {
        id: 'cPEAHm8VDFU',
        title: 'Loud & Proud',
        artist: 'Bass Modulators',
        thumbnail: 'https://img.youtube.com/vi/cPEAHm8VDFU/mqdefault.jpg',
        duration: 285,
      },
      {
        id: 'nqM-tNlEBM8',
        title: 'No Remorse',
        artist: 'Angerfist',
        thumbnail: 'https://img.youtube.com/vi/nqM-tNlEBM8/mqdefault.jpg',
        duration: 250,
      },
    ],
  },
  {
    id: 'cardio_beats',
    name: 'Cardio Beats',
    description: 'EDM e Pop veloce per corsa, HIIT e allenamenti cardio.',
    coverImage:
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=400&auto=format&fit=crop',
    tracks: [
      {
        id: 'gCYcHz2k5x0',
        title: 'Animals',
        artist: 'Martin Garrix',
        thumbnail: 'https://img.youtube.com/vi/gCYcHz2k5x0/mqdefault.jpg',
        duration: 235,
      },
      {
        id: 'hTGJfRPLe08',
        title: 'Levels',
        artist: 'Avicii',
        thumbnail: 'https://img.youtube.com/vi/hTGJfRPLe08/mqdefault.jpg',
        duration: 196,
      },
      {
        id: 'EPo5wWmKEaI',
        title: 'Red Lights',
        artist: 'Tiësto',
        thumbnail: 'https://img.youtube.com/vi/EPo5wWmKEaI/mqdefault.jpg',
        duration: 228,
      },
      {
        id: 'v7fFfP_Xj8Q',
        title: 'Titanium',
        artist: 'David Guetta ft. Sia',
        thumbnail: 'https://img.youtube.com/vi/v7fFfP_Xj8Q/mqdefault.jpg',
        duration: 245,
      },
    ],
  },
  {
    id: 'heavy_metal_gym',
    name: 'Heavy Metal Gym',
    description: 'Riff pesanti e batteria devastante per deadlift e squat pesanti.',
    coverImage:
      'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=400&auto=format&fit=crop',
    tracks: [
      {
        id: 'MJKYGuCuCiI',
        title: 'Master of Puppets',
        artist: 'Metallica',
        thumbnail: 'https://img.youtube.com/vi/MJKYGuCuCiI/mqdefault.jpg',
        duration: 515,
      },
      {
        id: 'cd-go0oBF4Y',
        title: 'Walk',
        artist: 'Pantera',
        thumbnail: 'https://img.youtube.com/vi/cd-go0oBF4Y/mqdefault.jpg',
        duration: 311,
      },
      {
        id: 'JtNSVb70Tjw',
        title: 'Raining Blood',
        artist: 'Slayer',
        thumbnail: 'https://img.youtube.com/vi/JtNSVb70Tjw/mqdefault.jpg',
        duration: 252,
      },
      {
        id: 'kXYiU_JCYtU',
        title: 'Numb',
        artist: 'Linkin Park',
        thumbnail: 'https://img.youtube.com/vi/kXYiU_JCYtU/mqdefault.jpg',
        duration: 187,
      },
    ],
  },
  {
    id: 'chill_gym',
    name: 'Chill Gym',
    description: 'Lo-fi e Hip-hop rilassato per giorni di volume e stretching.',
    coverImage:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=400&auto=format&fit=crop',
    tracks: [
      {
        id: '5qap5aO4i9A',
        title: 'Lofi Hip Hop Radio',
        artist: 'Chillhop Music',
        thumbnail: 'https://img.youtube.com/vi/5qap5aO4i9A/mqdefault.jpg',
        duration: 3600,
      },
      {
        id: 'jfKfPfyJRdk',
        title: 'Lofi Girl – Study / Chill',
        artist: 'Lofi Girl',
        thumbnail: 'https://img.youtube.com/vi/jfKfPfyJRdk/mqdefault.jpg',
        duration: 3600,
      },
      {
        id: 'DWcJFNfaw9c',
        title: 'Feather',
        artist: 'Nujabes',
        thumbnail: 'https://img.youtube.com/vi/DWcJFNfaw9c/mqdefault.jpg',
        duration: 268,
      },
      {
        id: '3qzLnuurMnw',
        title: 'Horizon',
        artist: 'Philanthrope & Tennyson',
        thumbnail: 'https://img.youtube.com/vi/3qzLnuurMnw/mqdefault.jpg',
        duration: 195,
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// COSTANTI
// ═══════════════════════════════════════════════════════════════
const CUSTOM_TRACKS_KEY = '@gym_app_yt_custom_tracks';

// ═══════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════
const MusicContext = createContext<MusicContextType | null>(null);

// ═══════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════
export function MusicProvider({ children }: { children: React.ReactNode }) {

  // ─── Stato player ────────────────────────────────────────────
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // ─── Coda e preferenze ───────────────────────────────────────
  const [queue, setQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState<'off' | 'track' | 'queue'>('off');

  // ─── Custom tracks ───────────────────────────────────────────
  const [customTracks, setCustomTracks] = useState<Track[]>([]);

  // ─── Stato passato a YTPlayerBridge ──────────────────────────
  const [_currentVideoId, _setCurrentVideoId] = useState('');

  // ─── Ref al bridge (riempito da YTPlayerBridge al mount) ─────
  const _ytBridgeRef = useRef<YTPlayerBridgeRef | null>(null);

  // ─── Refs per accesso non-stale nelle callback ────────────────
  const currentTrackRef = useRef<Track | null>(null);
  const queueRef = useRef<Track[]>([]);
  const historyRef = useRef<Track[]>([]);
  const isRepeatRef = useRef<'off' | 'track' | 'queue'>('off');
  const isShuffleRef = useRef(false);

  // Mantieni i refs sincronizzati con lo stato
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { isRepeatRef.current = isRepeat; }, [isRepeat]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);

  // ─── Timer polling currentTime ────────────────────────────────
  const timePollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isQueryPendingRef = useRef(false);

  useEffect(() => {
    if (isPlaying) {
      timePollerRef.current = setInterval(async () => {
        if (isQueryPendingRef.current) return;
        isQueryPendingRef.current = true;
        try {
          const t = await _ytBridgeRef.current?.getCurrentTime();
          if (t !== undefined) setCurrentTime(t);
          const d = await _ytBridgeRef.current?.getDuration();
          if (d !== undefined && d > 0) setDuration((prev) => (prev !== d ? d : prev));
        } catch { 
          /* player non ancora pronto */ 
        } finally {
          isQueryPendingRef.current = false;
        }
      }, 500);
    } else {
      isQueryPendingRef.current = false;
      if (timePollerRef.current) {
        clearInterval(timePollerRef.current);
        timePollerRef.current = null;
      }
    }
    return () => {
      isQueryPendingRef.current = false;
      if (timePollerRef.current) {
        clearInterval(timePollerRef.current);
        timePollerRef.current = null;
      }
    };
  }, [isPlaying]);

  // ─── Carica custom tracks da storage ─────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_TRACKS_KEY).then((raw) => {
      if (raw) setCustomTracks(JSON.parse(raw));
    }).catch(console.error);
  }, []);



  // ═══════════════════════════════════════════════════════════════
  // CALLBACK BRIDGE
  // ═══════════════════════════════════════════════════════════════

  const _onYTReady = useCallback(() => {
    setIsLoading(false);
  }, []);

  /**
   * Chiamato dal bridge ogni volta che lo stato del player YouTube cambia.
   * Mappa gli stati YT nel nostro stato React.
   *
   * Valori PLAYER_STATES:
   *   'unstarted' → player appena inizializzato
   *   'ended'     → video terminato → passa al prossimo
   *   'playing'   → in riproduzione
   *   'paused'    → in pausa
   *   'buffering' → caricamento/buffering
   *   'video cued'→ video in coda, pronto ma non avviato
   */
  const _onYTStateChange = useCallback((state: string) => {
    switch (state) {
      case PLAYER_STATES.PLAYING:
        setIsPlaying(true);
        setIsLoading(false);
        break;
      case PLAYER_STATES.PAUSED:
        setIsPlaying(false);
        setIsLoading(false);
        break;
      case PLAYER_STATES.BUFFERING:
        setIsLoading(true);
        break;
      case PLAYER_STATES.ENDED:
        skipNextFromCallback();
        break;
      case PLAYER_STATES.UNSTARTED:
        setIsLoading(true);
        break;
      default:
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const _onYTError = useCallback((error: string) => {
    console.warn('[MusicContext] YT error:', error);
    setIsLoading(false);

    /**
     * Codici errore YouTube IFrame:
     *   2   = parametro non valido
     *   5   = errore HTML5 player
     *   100 = video non trovato / rimosso
     *   101 = embedding non consentito dal proprietario
     *   150 = stessa cosa di 101 (alias)
     *   'embed_not_allowed' = stringa equivalente a 101/150
     *
     * Per 101/150/embed_not_allowed: skip silenzioso al prossimo brano.
     * Per altri errori: mostra alert.
     */
    const errorStr = String(error);
    const isEmbedError =
      errorStr === 'embed_not_allowed' ||
      errorStr === '101' ||
      errorStr === '150';

    if (isEmbedError) {
      // Skip silenzioso — il video non supporta embedding
      console.log('[MusicContext] Embedding non consentito, passo al prossimo brano...');
      setIsPlaying(false);
      // Piccolo delay prima dello skip per evitare loop troppo veloci
      setTimeout(() => skipNextFromCallback(), 500);
      return;
    }

    // Per altri errori mostra un alert
    setIsPlaying(false);
    _setShouldPlay(false);
    Alert.alert(
      'Video non disponibile',
      `Impossibile riprodurre questo video (errore: ${error}).\n\nProva con un altro brano.`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // LOGICA INTERNA SKIP (usa refs — no stale closure)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Funzione di skip usata da onStateChange (ENDED).
   * Usa refs per leggere lo stato corrente senza stale closure.
   */
  const skipNextFromCallback = useCallback(() => {
    const track = currentTrackRef.current;
    const q = [...queueRef.current];
    const h = [...historyRef.current];
    const repeat = isRepeatRef.current;
    const shuffle = isShuffleRef.current;

    if (!track) return;

    // Ripeti la traccia corrente
    if (repeat === 'track') {
      setCurrentTime(0);
      _setCurrentVideoId(track.id);
      setIsPlaying(true);
      return;
    }

    if (q.length > 0) {
      let nextTrack: Track;
      let newQueue: Track[];

      if (shuffle) {
        const idx = Math.floor(Math.random() * q.length);
        nextTrack = q[idx];
        newQueue = q.filter((_, i) => i !== idx);
      } else {
        [nextTrack, ...newQueue] = q;
      }

      const newHistory = [...h, track];
      if (repeat === 'queue') newQueue.push(track);

      setCurrentTrack(nextTrack);
      setQueue(newQueue);
      setHistory(newHistory);
      setCurrentTime(0);
      setDuration(nextTrack.duration);
      setIsLoading(true);
      _setCurrentVideoId(nextTrack.id);
      setIsPlaying(true);
    } else {
      // Coda vuota
      if (repeat === 'queue' && h.length > 0) {
        const fullQueue = [...h, track];
        const next = fullQueue[0];
        setCurrentTrack(next);
        setQueue(fullQueue.slice(1));
        setHistory([]);
        setCurrentTime(0);
        setDuration(next.duration);
        setIsLoading(true);
        _setCurrentVideoId(next.id);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // AZIONI PUBBLICHE
  // ═══════════════════════════════════════════════════════════════

  const playTrack = useCallback((track: Track) => {
    const startPlay = async () => {
      setIsLoading(true);
      let ytVideoId = track.id;

      // Se l'id è un MusicBrainz ID (formato UUID)
      const isMusicBrainzId = track.id.includes('-') && track.id.length > 20;

      if (isMusicBrainzId) {
        try {
          const resolvedId = await getYoutubeVideoIdForMetadata(track.title, track.artist);
          ytVideoId = resolvedId;
          track.id = resolvedId;
          track.thumbnail = `https://img.youtube.com/vi/${resolvedId}/mqdefault.jpg`;
        } catch {
          setIsLoading(false);
          Alert.alert('Errore', 'Impossibile trovare il brano corrispondente su YouTube.');
          return;
        }
      }

      setCurrentTrack((prev) => {
        if (prev && prev.id !== track.id) {
          setHistory((h) => [...h.filter((t) => t.id !== prev.id), prev]);
        }
        return track;
      });
      setCurrentTime(0);
      setDuration(track.duration);
      setIsPlaying(true);
      _setCurrentVideoId(ytVideoId);
    };

    startPlay();
  }, []);

  const togglePlay = useCallback(() => {
    if (!currentTrackRef.current) {
      const first = CURATED_PLAYLISTS[0]?.tracks[0];
      if (first) playTrack(first);
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [playTrack]);

  const skipNext = useCallback(() => {
    skipNextFromCallback();
  }, [skipNextFromCallback]);

  const skipPrevious = useCallback(() => {
    if (currentTime > 5) {
      _ytBridgeRef.current?.seekTo(0);
      setCurrentTime(0);
      return;
    }
    const h = [...historyRef.current];
    if (h.length === 0) {
      _ytBridgeRef.current?.seekTo(0);
      setCurrentTime(0);
      return;
    }
    const prev = h[h.length - 1];
    const newHistory = h.slice(0, -1);
    setHistory(newHistory);
    setCurrentTrack((curr) => {
      if (curr) setQueue((q) => [curr, ...q]);
      return prev;
    });
    setCurrentTime(0);
    setDuration(prev.duration);
    setIsLoading(true);
    _setCurrentVideoId(prev.id);
    setIsPlaying(true);
  }, [currentTime]);

  const seekTo = useCallback((seconds: number) => {
    _ytBridgeRef.current?.seekTo(seconds);
    setCurrentTime(seconds);
  }, []);

  const addToQueue = useCallback((track: Track) => {
    setQueue((q) => [...q, track]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((q) => q.filter((_, i) => i !== index));
  }, []);

  const clearQueue = useCallback(() => setQueue([]), []);

  const playPlaylist = useCallback((playlist: CuratedPlaylist) => {
    if (!playlist.tracks.length) return;
    let tracks = [...playlist.tracks];
    if (isShuffleRef.current) tracks.sort(() => Math.random() - 0.5);
    const [first, ...rest] = tracks;
    setHistory([]);
    setQueue(rest);
    playTrack(first);
  }, [playTrack]);

  const toggleShuffle = useCallback(() => setIsShuffle((v) => !v), []);

  const toggleRepeat = useCallback(() => {
    setIsRepeat((v) => (v === 'off' ? 'queue' : v === 'queue' ? 'track' : 'off'));
  }, []);

  const addCustomTrack = useCallback(async (
    title: string,
    artist: string,
    videoId: string
  ) => {
    // Supporta sia videoId puro che URL YouTube completo
    let id = videoId.trim();
    const urlMatch = id.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (urlMatch) id = urlMatch[1];

    const track: Track = {
      id,
      title: title.trim() || 'Video Personalizzato',
      artist: artist.trim() || 'YouTube',
      thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
      duration: 0,
    };
    const updated = [...customTracks, track];
    setCustomTracks(updated);
    await AsyncStorage.setItem(CUSTOM_TRACKS_KEY, JSON.stringify(updated));
  }, [customTracks]);

  const removeCustomTrack = useCallback(async (videoId: string) => {
    const updated = customTracks.filter((t) => t.id !== videoId);
    setCustomTracks(updated);
    await AsyncStorage.setItem(CUSTOM_TRACKS_KEY, JSON.stringify(updated));
  }, [customTracks]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <MusicContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isLoading,
        currentTime,
        duration,
        queue,
        history,
        isShuffle,
        isRepeat,
        curatedPlaylists: CURATED_PLAYLISTS,
        customTracks,
        apiKey: null,
        playTrack,
        togglePlay,
        skipNext,
        skipPrevious,
        seekTo,
        addToQueue,
        removeFromQueue,
        clearQueue,
        playPlaylist,
        toggleShuffle,
        toggleRepeat,
        addCustomTrack,
        removeCustomTrack,
        setApiKey: async () => {},
        // Interni bridge
        _ytBridgeRef,
        _onYTStateChange,
        _onYTReady,
        _onYTError,
        _currentVideoId,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════
export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic deve essere usato dentro MusicProvider');
  return ctx;
}
