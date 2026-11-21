import { Button, Field, IconButton, Sheet, Txt } from '@/components/ui/kit';
import { UI, themed } from '@/constants/theme';
import type { SessionLog, SessionVideo } from '@/lib/stats';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Alert, Image, Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// share links only: the Google Photos library API no longer lets other apps read the user's library
const GPHOTOS = /^https:\/\/(photos\.app\.goo\.gl|photos\.google\.com|goo\.gl\/photos)\//i;
export const isGooglePhotosLink = (t: string) => GPHOTOS.test(t.trim());

/** Videos attached to a logged session: picked from the gallery or linked from Google Photos. */
export function SessionVideos({ session, onChange }: { session: SessionLog; onChange: (videos: SessionVideo[]) => void }) {
  const videos = session.videos ?? [];
  const [picking, setPicking] = useState(false);
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);

  const add = (vs: SessionVideo[]) => onChange([...videos, ...vs.filter(v => !videos.some(x => x.uri === v.uri))]);
  const remove = (v: SessionVideo) =>
    Alert.alert('Rimuovi video', "Il video resta in galleria / Google Foto, viene solo scollegato dall'allenamento.", [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Rimuovi', style: 'destructive', onPress: () => onChange(videos.filter(x => x.uri !== v.uri)) },
    ]);

  const open = async (v: SessionVideo) => {
    if (!v.assetId) return Linking.openURL(v.uri).catch(() => Alert.alert('Impossibile aprire il link'));
    try {
      const info = await MediaLibrary.getAssetInfoAsync(v.assetId); // iOS ph:// is not playable, localUri is
      if (!info) throw new Error('missing');
      setPlaying(info.localUri ?? info.uri);
    } catch {
      Alert.alert('Video non trovato', 'Forse è stato eliminato o spostato dalla galleria.');
    }
  };

  const saveLink = () => {
    if (!isGooglePhotosLink(link)) return Alert.alert('Link non valido', 'Incolla un link di condivisione di Google Foto (photos.app.goo.gl/…).');
    add([{ uri: link.trim() }]);
    setLink('');
    setLinking(false);
  };

  return (
    <View style={{ gap: 8 }}>
      {videos.map(v => (
        <Pressable key={v.uri} onPress={() => open(v)} accessibilityRole="button" accessibilityLabel="Guarda video" style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
          {v.assetId ? (
            <Image source={{ uri: v.uri }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.center]}><Ionicons name="logo-google" size={20} color={UI.text} /></View>
          )}
          <Txt numberOfLines={1} style={{ flex: 1 }}>{v.assetId ? 'Video dalla galleria' : 'Video su Google Foto'}</Txt>
          <Ionicons name="play-circle-outline" size={22} color={UI.subtle} />
          <IconButton icon="close" label="Scollega video" onPress={() => remove(v)} />
        </Pressable>
      ))}
      <View style={styles.actions}>
        <Button title="Galleria" icon="images-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => setPicking(true)} />
        <Button title="Google Foto" icon="link-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => setLinking(true)} />
      </View>

      <GalleryPicker visible={picking} day={new Date(session.date)} onClose={() => setPicking(false)} onPick={add} />

      <Sheet visible={linking} onClose={() => setLinking(false)} title="Link Google Foto">
        <Txt v="muted">In Google Foto apri il video → Condividi → Crea link, poi incollalo qui.</Txt>
        <Field value={link} onChangeText={setLink} placeholder="https://photos.app.goo.gl/…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Button title="Collega" icon="link-outline" onPress={saveLink} disabled={!link.trim()} />
      </Sheet>

      <PlayerModal uri={playing} onClose={() => setPlaying(null)} />
    </View>
  );
}

/** Multi-select grid of gallery videos, that day's first. */
function GalleryPicker({ visible, day, onClose, onPick }: { visible: boolean; day: Date; onClose: () => void; onPick: (v: SessionVideo[]) => void }) {
  const [all, setAll] = useState(false);
  const [assets, setAssets] = useState<MediaLibrary.Asset[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [sel, setSel] = useState<Record<string, MediaLibrary.Asset>>({});

  useEffect(() => {
    if (!visible) return;
    let live = true;
    (async () => {
      const { granted } = await MediaLibrary.requestPermissionsAsync(false, ['video']);
      if (!live) return;
      setDenied(!granted);
      if (!granted) return;
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
      const page = await MediaLibrary.getAssetsAsync({
        mediaType: 'video',
        sortBy: [['creationTime', false]],
        first: 120, // shortcut: no paging, older videos need "Tutti" + scrolling past 120 -> add paging if it matters
        ...(all ? {} : { createdAfter: start, createdBefore: end }),
      });
      if (live) setAssets(page.assets);
    })().catch(e => {
      console.error('Errore nel caricamento dei video:', e);
      if (live) setAssets([]);
    });
    return () => { live = false; };
  }, [visible, all, day.getTime()]);

  const close = () => {
    setSel({});
    setAll(false);
    setAssets(null);
    onClose();
  };
  const confirm = () => {
    onPick(Object.values(sel).map(a => ({ uri: a.uri, assetId: a.id })));
    close();
  };
  const n = Object.keys(sel).length;

  return (
    <Sheet visible={visible} onClose={close} title="Video dalla galleria">
      <View style={styles.actions}>
        <Button title="Questo giorno" small variant={all ? 'ghost' : 'secondary'} style={{ flex: 1 }} onPress={() => setAll(false)} />
        <Button title="Tutti" small variant={all ? 'secondary' : 'ghost'} style={{ flex: 1 }} onPress={() => setAll(true)} />
      </View>
      {denied ? (
        <Txt v="muted">Serve l'accesso ai video della galleria. Puoi concederlo dalle impostazioni del telefono.</Txt>
      ) : assets && !assets.length ? (
        <Txt v="muted">{all ? 'Nessun video in galleria.' : 'Nessun video registrato in questo giorno. Prova "Tutti".'}</Txt>
      ) : (
        <View style={styles.grid}>
          {(assets ?? []).map(a => {
            const on = !!sel[a.id];
            return (
              <Pressable
                key={a.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`Video ${Math.round(a.duration)} secondi`}
                onPress={() => setSel(p => { const c = { ...p }; on ? delete c[a.id] : (c[a.id] = a); return c; })}
                style={styles.cell}
              >
                <Image source={{ uri: a.uri }} style={StyleSheet.absoluteFill} />
                <Txt style={styles.dur}>{`${Math.floor(a.duration / 60)}:${String(Math.round(a.duration % 60)).padStart(2, '0')}`}</Txt>
                {on ? <View style={[StyleSheet.absoluteFill, styles.selected]}><Ionicons name="checkmark-circle" size={28} color="#fff" /></View> : null}
              </Pressable>
            );
          })}
        </View>
      )}
      <Button title={n ? `Aggiungi ${n} video` : 'Seleziona i video'} icon="add" disabled={!n} onPress={confirm} />
    </Sheet>
  );
}

function PlayerModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(null, p => { p.loop = true; });
  useEffect(() => {
    if (uri) {
      player.replace(uri);
      player.play();
    } else player.pause();
  }, [uri]);
  return (
    <Modal visible={!!uri} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Chiudi video" style={[styles.closeBtn, { top: insets.top + (Platform.OS === 'android' ? 12 : 4) }]}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: UI.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: '32%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: UI.surface },
  dur: { position: 'absolute', right: 4, bottom: 2, color: '#fff', fontSize: 12, fontWeight: '600', textShadowColor: '#000', textShadowRadius: 3 },
  selected: { backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
}));
