/**
 * YouTubeSearchService.ts
 *
 * Ricerca YouTube in cascata — senza API key utente:
 *
 * 1. INNERTUBE ANDROID (primario)
 *    Usa la stessa API interna che usa l'app YouTube ufficiale Android.
 *    La chiave `AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8` è la chiave
 *    pubblica baked nell'app YouTube Android — non è una chiave utente.
 *    Questa è la tecnica usata da NewPipe, Invidious, Piped internamente.
 *
 * 2. YOUTUBE DATA API v3 (se l'utente configura la propria chiave gratuita)
 *    Più affidabile, 100 ricerche/giorno gratis.
 *
 * 3. INVIDIOUS (fallback istanze pubbliche)
 *    Usato solo se i primi due falliscono.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track } from '@/context/MusicContext';

// ─────────────────────────────────────────────────────────
// COSTANTI
// ─────────────────────────────────────────────────────────

/** Storage key per la chiave API utente */
export const API_KEY_STORAGE = '@gym_app_yt_api_key_v1';

/**
 * Chiave API pubblica di YouTube per client Android.
 * Non è una chiave personale — è hardcoded nell'app YouTube stessa.
 * Fonte: ingegneria inversa dell'app YouTube Android (usata da NewPipe).
 */
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/search';

const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://iv.datura.network',
  'https://invidious.io.lol',
  'https://invidious.einfachzocken.eu',
  'https://invidious.privacyredirect.com',
];

const REQUEST_TIMEOUT = 6000;

// Cache in-memory — evita doppie ricerche identiche
const cache = new Map<string, Track[]>();
const MAX_CACHE = 40;

// Chiave API utente (caricata una volta)
let _userApiKey: string | null = null;

// ─────────────────────────────────────────────────────────
// API KEY MANAGEMENT
// ─────────────────────────────────────────────────────────

/** Carica la chiave API salvata dall'utente. Chiamare all'avvio app. */
export async function loadApiKey(): Promise<string | null> {
  try {
    _userApiKey = await AsyncStorage.getItem(API_KEY_STORAGE);
    return _userApiKey;
  } catch {
    return null;
  }
}

/** Salva la chiave API utente. Passa null per rimuoverla. */
export async function saveApiKey(key: string | null): Promise<void> {
  _userApiKey = key?.trim() || null;
  if (_userApiKey) {
    await AsyncStorage.setItem(API_KEY_STORAGE, _userApiKey);
  } else {
    await AsyncStorage.removeItem(API_KEY_STORAGE);
  }
  cache.clear(); // Resetta la cache quando cambia la configurazione
}

/** Restituisce se c'è una chiave API configurata */
export function hasApiKey(): boolean {
  return !!_userApiKey;
}

// ─────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Converte testo durata "3:45" o "1:23:45" in secondi
 */
function parseDurationText(text: string): number {
  if (!text) return 0;
  const parts = text.split(':').map(Number);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  return 0;
}

// ─────────────────────────────────────────────────────────
// APPROCCIO 1 — YouTube Innertube API (Android client)
// ─────────────────────────────────────────────────────────
async function searchViaInnertube(query: string): Promise<Track[]> {
  const body = {
    context: {
      client: {
        // Simula il client Android dell'app YouTube ufficiale
        clientName: 'ANDROID',
        clientVersion: '17.31.35',
        androidSdkVersion: 30,
        hl: 'it',
        gl: 'IT',
        platform: 'MOBILE',
        userAgent:
          'com.google.android.youtube/17.31.35 (Linux; U; Android 11) gzip',
      },
    },
    query,
    // params = "EgIQAQ==" → filtro "video" nell'API Innertube
    params: 'EgIQAQ==',
  };

  const res = await fetchWithTimeout(
    `${INNERTUBE_URL}?key=${INNERTUBE_KEY}&prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': '3',       // 3 = ANDROID
        'X-YouTube-Client-Version': '17.31.35',
        'Origin': 'https://www.youtube.com',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) throw new Error(`Innertube HTTP ${res.status}`);

  const data = await res.json();
  return parseInnertubeResults(data);
}

/**
 * Parser per la risposta Innertube — naviga la struttura annidata.
 *
 * La struttura varia leggermente tra versioni ma segue sempre:
 * contents → sectionListRenderer → contents[] → itemSectionRenderer → contents[] → videoRenderer
 */
function parseInnertubeResults(data: any): Track[] {
  const tracks: Track[] = [];

  // Prova la struttura standard della ricerca
  const sections: any[] =
    data?.contents?.sectionListRenderer?.contents ??
    data?.onResponseReceivedCommands?.[0]?.appendContinuationItemsAction
      ?.continuationItems ??
    [];

  for (const section of sections) {
    const items: any[] =
      section?.itemSectionRenderer?.contents ??
      section?.musicShelfRenderer?.contents ??
      [];

    for (const item of items) {
      // Il risultato video può essere in videoRenderer o compactVideoRenderer
      const v = item?.videoRenderer ?? item?.compactVideoRenderer;
      if (!v?.videoId) continue;

      const title =
        v.title?.runs?.[0]?.text ??
        v.title?.simpleText ??
        'Senza titolo';

      const artist =
        v.ownerText?.runs?.[0]?.text ??
        v.shortBylineText?.runs?.[0]?.text ??
        v.longBylineText?.runs?.[0]?.text ??
        'YouTube';

      // La durata è in overlays o nel campo lengthText
      const durationText =
        v.lengthText?.simpleText ??
        v.thumbnailOverlays?.find(
          (o: any) => o?.thumbnailOverlayTimeStatusRenderer
        )?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText ??
        '';

      tracks.push({
        id: v.videoId,
        title,
        artist,
        thumbnail: `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`,
        duration: parseDurationText(durationText),
      });

      if (tracks.length >= 20) break;
    }
    if (tracks.length >= 20) break;
  }

  return tracks;
}

// ─────────────────────────────────────────────────────────
// APPROCCIO 2 — YouTube Data API v3 (chiave utente)
// ─────────────────────────────────────────────────────────
async function searchViaYouTubeAPI(query: string, apiKey: string): Promise<Track[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', '20');
  url.searchParams.set('key', apiKey);
  // Categoria 10 = Musica (migliora la qualità dei risultati)
  url.searchParams.set('videoCategoryId', '10');

  const res = await fetchWithTimeout(url.toString());
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`YouTube API: ${msg}`);
  }

  const data = await res.json();
  return (data.items ?? []).map((item: any) => ({
    id: item.id?.videoId ?? '',
    title: item.snippet?.title ?? 'Senza titolo',
    artist: item.snippet?.channelTitle ?? 'YouTube',
    thumbnail:
      item.snippet?.thumbnails?.medium?.url ??
      `https://img.youtube.com/vi/${item.id?.videoId}/mqdefault.jpg`,
    duration: 0, // La search API non restituisce la durata
  })).filter((t: Track) => t.id.length === 11);
}

// ─────────────────────────────────────────────────────────
// APPROCCIO 3 — Invidious (fallback)
// ─────────────────────────────────────────────────────────
async function searchViaInvidious(query: string): Promise<Track[]> {
  const encoded = encodeURIComponent(query);

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetchWithTimeout(
        `${instance}/api/v1/search?q=${encoded}&type=video&pretty=0`
      );
      if (!res.ok) continue;

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      const tracks = data
        .filter((item: any) => item.type === 'video' && item.videoId)
        .slice(0, 20)
        .map((item: any) => ({
          id: item.videoId,
          title: item.title ?? 'Senza titolo',
          artist: item.author ?? 'YouTube',
          thumbnail: `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`,
          duration: item.lengthSeconds ?? 0,
        }));

      if (tracks.length > 0) {
        console.log(`[YTSearch] Invidious OK: ${instance}`);
        return tracks;
      }
    } catch (err: any) {
      console.log(`[YTSearch] Invidious FAIL: ${instance} — ${err?.message}`);
    }
  }

  throw new Error('Tutte le istanze Invidious non sono raggiungibili');
}

// ─────────────────────────────────────────────────────────
// EXPORT PRINCIPALE
// ─────────────────────────────────────────────────────────

/**
 * Cerca video YouTube senza richiedere una chiave API utente.
 *
 * Ordine di priorità:
 * 1. YouTube Data API v3 (se chiave configurata nelle impostazioni)
 * 2. YouTube Innertube Android (nessuna chiave utente)
 * 3. Invidious public instances (fallback)
 */
export async function searchYouTube(query: string): Promise<Track[]> {
  const key = query.toLowerCase().trim();
  if (!key) return [];

  // Cache hit
  if (cache.has(key)) return cache.get(key)!;

  let tracks: Track[] = [];

  // ── Tentativo 1: Chiave API utente ───────────────────
  if (_userApiKey) {
    try {
      tracks = await searchViaYouTubeAPI(query, _userApiKey);
      console.log(`[YTSearch] YouTube Data API OK (${tracks.length} risultati)`);
    } catch (err: any) {
      console.log('[YTSearch] YouTube Data API FAIL:', err.message);
    }
  }

  // ── Tentativo 2: Innertube Android ───────────────────
  if (tracks.length === 0) {
    try {
      tracks = await searchViaInnertube(query);
      console.log(`[YTSearch] Innertube OK (${tracks.length} risultati)`);
    } catch (err: any) {
      console.log('[YTSearch] Innertube FAIL:', err.message);
    }
  }

  // ── Tentativo 3: Invidious ────────────────────────────
  if (tracks.length === 0) {
    try {
      tracks = await searchViaInvidious(query);
    } catch {
      // Tutti i metodi hanno fallito
    }
  }

  if (tracks.length === 0) {
    throw new Error(
      'Nessun risultato trovato.\n\n' +
      'Verifica la connessione internet.\n\n' +
      'Se il problema persiste, aggiungi una chiave YouTube gratuita nelle ⚙️ Impostazioni della tab Musica.'
    );
  }

  // Salva in cache
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, tracks);
  return tracks;
}

/** Svuota la cache di ricerca */
export function clearSearchCache(): void {
  cache.clear();
}

/**
 * Trova il videoId YouTube corrispondente a un brano (usato per i risultati di MusicBrainz)
 */
export async function getYoutubeVideoIdForMetadata(title: string, artist: string): Promise<string> {
  const query = `${artist} - ${title}`;
  const results = await searchYouTube(query);
  if (results.length > 0) {
    return results[0].id;
  }
  throw new Error('Nessun video trovato per questa traccia');
}
