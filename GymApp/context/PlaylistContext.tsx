/**
 * PlaylistContext.tsx
 *
 * Gestione delle playlist personali dell'utente (stile Demus).
 *
 * FUNZIONALITÀ:
 * - Crea / rinomina / elimina playlist
 * - Aggiungi / rimuovi brani dalle playlist
 * - "❤️ Mi piace" — playlist speciale sempre presente
 * - Tutto persistito in AsyncStorage
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track } from '@/context/MusicContext';

// ═══════════════════════════════════════════════════════════
// TIPI
// ═══════════════════════════════════════════════════════════

export type UserPlaylist = {
  id: string;
  name: string;
  emoji: string;         // Emoji rappresentativa della playlist
  tracks: Track[];
  createdAt: number;     // timestamp ms
};

type PlaylistContextType = {
  userPlaylists: UserPlaylist[];
  likedSongs: Track[];
  isReady: boolean;
  // Playlist CRUD
  createPlaylist: (name: string, emoji?: string) => Promise<UserPlaylist>;
  renamePlaylist: (id: string, name: string, emoji?: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  // Track management
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<boolean>; // false = già presente
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  // Mi piace
  toggleLike: (track: Track) => Promise<void>;
  isLiked: (trackId: string) => boolean;
  // Utility
  getPlaylist: (id: string) => UserPlaylist | undefined;
  isTrackInPlaylist: (playlistId: string, trackId: string) => boolean;
};

// ═══════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════
const PLAYLISTS_KEY = '@gym_app_user_playlists_v2';
const LIKED_KEY = '@gym_app_liked_songs_v2';

// ═══════════════════════════════════════════════════════════
// HELPER — UUID semplice
// ═══════════════════════════════════════════════════════════
function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

// ═══════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════
const PlaylistContext = createContext<PlaylistContextType | null>(null);

// ═══════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════
export function PlaylistProvider({ children }: { children: ReactNode }) {
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [likedSongs, setLikedSongs] = useState<Track[]>([]);
  const [isReady, setIsReady] = useState(false);

  // ─── Carica dati al mount ─────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [rawPlaylists, rawLiked] = await Promise.all([
          AsyncStorage.getItem(PLAYLISTS_KEY),
          AsyncStorage.getItem(LIKED_KEY),
        ]);
        if (rawPlaylists) setUserPlaylists(JSON.parse(rawPlaylists));
        if (rawLiked) setLikedSongs(JSON.parse(rawLiked));
      } catch (e) {
        console.error('[PlaylistContext] Errore caricamento:', e);
      } finally {
        setIsReady(true);
      }
    };
    load();
  }, []);

  // ─── Salva playlists ──────────────────────────────────
  const savePlaylists = useCallback(async (updated: UserPlaylist[]) => {
    setUserPlaylists(updated);
    await AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(updated));
  }, []);

  // ─── Salva liked ──────────────────────────────────────
  const saveLiked = useCallback(async (updated: Track[]) => {
    setLikedSongs(updated);
    await AsyncStorage.setItem(LIKED_KEY, JSON.stringify(updated));
  }, []);

  // ─── Crea playlist ────────────────────────────────────
  const createPlaylist = useCallback(
    async (name: string, emoji = '🎵'): Promise<UserPlaylist> => {
      const pl: UserPlaylist = {
        id: generateId(),
        name: name.trim() || 'Nuova Playlist',
        emoji,
        tracks: [],
        createdAt: Date.now(),
      };
      await savePlaylists([...userPlaylists, pl]);
      return pl;
    },
    [userPlaylists, savePlaylists]
  );

  // ─── Rinomina playlist ────────────────────────────────
  const renamePlaylist = useCallback(
    async (id: string, name: string, emoji?: string) => {
      const updated = userPlaylists.map((pl) =>
        pl.id === id
          ? { ...pl, name: name.trim() || pl.name, emoji: emoji ?? pl.emoji }
          : pl
      );
      await savePlaylists(updated);
    },
    [userPlaylists, savePlaylists]
  );

  // ─── Elimina playlist ─────────────────────────────────
  const deletePlaylist = useCallback(
    async (id: string) => {
      await savePlaylists(userPlaylists.filter((pl) => pl.id !== id));
    },
    [userPlaylists, savePlaylists]
  );

  // ─── Aggiungi brano a playlist ────────────────────────
  const addTrackToPlaylist = useCallback(
    async (playlistId: string, track: Track): Promise<boolean> => {
      const pl = userPlaylists.find((p) => p.id === playlistId);
      if (!pl) return false;
      // Evita duplicati
      if (pl.tracks.some((t) => t.id === track.id)) return false;
      const updated = userPlaylists.map((p) =>
        p.id === playlistId ? { ...p, tracks: [...p.tracks, track] } : p
      );
      await savePlaylists(updated);
      return true;
    },
    [userPlaylists, savePlaylists]
  );

  // ─── Rimuovi brano da playlist ────────────────────────
  const removeTrackFromPlaylist = useCallback(
    async (playlistId: string, trackId: string) => {
      const updated = userPlaylists.map((p) =>
        p.id === playlistId
          ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }
          : p
      );
      await savePlaylists(updated);
    },
    [userPlaylists, savePlaylists]
  );

  // ─── Toggle Mi piace ──────────────────────────────────
  const toggleLike = useCallback(
    async (track: Track) => {
      const already = likedSongs.some((t) => t.id === track.id);
      const updated = already
        ? likedSongs.filter((t) => t.id !== track.id)
        : [...likedSongs, track];
      await saveLiked(updated);
    },
    [likedSongs, saveLiked]
  );

  const isLiked = useCallback(
    (trackId: string) => likedSongs.some((t) => t.id === trackId),
    [likedSongs]
  );

  // ─── Utility ──────────────────────────────────────────
  const getPlaylist = useCallback(
    (id: string) => userPlaylists.find((p) => p.id === id),
    [userPlaylists]
  );

  const isTrackInPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      const pl = userPlaylists.find((p) => p.id === playlistId);
      return pl?.tracks.some((t) => t.id === trackId) ?? false;
    },
    [userPlaylists]
  );

  // ─── Render ──────────────────────────────────────────
  return (
    <PlaylistContext.Provider
      value={{
        userPlaylists,
        likedSongs,
        isReady,
        createPlaylist,
        renamePlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        toggleLike,
        isLiked,
        getPlaylist,
        isTrackInPlaylist,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════
export function usePlaylists() {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error('usePlaylists deve essere usato dentro PlaylistProvider');
  return ctx;
}
