import type { Track } from '@/context/MusicContext';

/**
 * Cerca registrazioni (brani) tramite la MusicBrainz API.
 * 
 * MusicBrainz richiede che tutte le chiamate specifichino un User-Agent unico
 * per evitare blocchi o rate-limiting di massa.
 */
export async function searchMusicBrainz(query: string): Promise<Track[]> {
  if (!query.trim()) return [];
  const sanitizedQuery = encodeURIComponent(query.trim());
  const url = `https://musicbrainz.org/ws/2/recording/?query=${sanitizedQuery}&fmt=json&limit=20`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'SwarmyGymApp/1.0.0 (https://github.com/72Gregorio72/Swarmy; gregorio@swarmy.app)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`MusicBrainz HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const recordings = data.recordings ?? [];

    return recordings.map((rec: any): Track => {
      const title = rec.title ?? 'Senza titolo';
      // Uniamo i nomi degli artisti accreditati
      const artist = rec['artist-credit']?.map((ac: any) => ac.name).join(', ') ?? 'Artista sconosciuto';
      // Durata in secondi (MusicBrainz fornisce length in millisecondi)
      const duration = rec.length ? Math.floor(rec.length / 1000) : 0;

      // Recuperiamo un'immagine di copertina se c'è un rilascio (release) associato
      let thumbnail = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop';
      if (rec.releases && rec.releases.length > 0) {
        const releaseMbid = rec.releases[0].id;
        if (releaseMbid) {
          thumbnail = `https://coverartarchive.org/release/${releaseMbid}/front-250`;
        }
      }

      return {
        id: rec.id, // Sarà un UUID (es. "83d24260-0f46-482f-8451-d0061e89cf30")
        title,
        artist,
        thumbnail,
        duration,
      };
    });
  } catch (error: any) {
    console.error('[MusicBrainzService] Search error:', error);
    throw new Error(`Impossibile cercare su MusicBrainz: ${error.message ?? error}`);
  }
}
