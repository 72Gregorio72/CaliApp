import { Button } from '@/components/ui/kit';
import { UI, themed } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Full-screen camera to record a set and save it to the gallery. */
export function VideoRecorder({ visible, title, onClose }: { visible: boolean; title: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [isRecording, setIsRecording] = React.useState(false);
  const [videoUri, setVideoUri] = React.useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = React.useState<'front' | 'back'>('back');
  const [wide, setWide] = React.useState(false);
  // iOS: lens names are localized ("Back Ultra Wide Camera", "Fotocamera ultra grandangolare…"), all contain "ultra"
  const [ultraLens, setUltraLens] = React.useState<string | undefined>();
  // Android has no lens API: zoom < 0 binds the widest-FOV back camera at its min ratio (see patches/expo-camera*.patch)
  const canWide = cameraFacing === 'back' && (Platform.OS === 'android' || !!ultraLens);
  const [recordSeconds, setRecordSeconds] = React.useState(0);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const cameraRef = React.useRef<any>(null);

  const player = useVideoPlayer('', playerInstance => {
    playerInstance.loop = true;
  });

  React.useEffect(() => {
    if (videoUri) {
      player.replace(videoUri);
      player.play();
    } else {
      player.pause();
    }
  }, [videoUri]);

  React.useEffect(() => {
    let interval: any;
    if (isRecording) {
      setRecordSeconds(0);
      interval = setInterval(() => {
        setRecordSeconds(s => s + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatRecordTime = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startVideoRecording = async () => {
    if (!cameraRef.current || isRecording) return;
    setIsRecording(true);
    try {
      const video = await cameraRef.current.recordAsync();
      if (video) {
        setVideoUri(video.uri);
      }
    } catch (e) {
      console.error('Errore nella registrazione video:', e);
      setIsRecording(false);
    }
  };

  const stopVideoRecording = async () => {
    if (!cameraRef.current || !isRecording) return;
    cameraRef.current.stopRecording();
    setIsRecording(false);
  };

  const saveVideoToGallery = async () => {
    if (!videoUri) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(videoUri);
        alert('Video salvato in galleria!');
        setVideoUri(null);
      } else {
        alert('GymApp necessita dei permessi della galleria per salvare il video.');
      }
    } catch (err) {
      console.error('Errore nel salvare il video:', err);
      alert('Impossibile salvare il video.');
    }
  };

  const closeVideoModal = () => {
    if (isRecording) {
      cameraRef.current?.stopRecording();
    }
    setIsRecording(false);
    setVideoUri(null);
    setWide(false);
    player.pause();
    onClose();
  };

  return (
  <Modal
    visible={visible}
    transparent={false}
    animationType="slide"
    onRequestClose={closeVideoModal}
  >
    <View style={styles.cameraModalContainer}>
      {!cameraPermission?.granted || !microphonePermission?.granted ? (
        <View style={styles.permissionContainer}>
          <Ionicons name="videocam-outline" size={40} color={UI.muted} />
          <Text style={styles.permissionTitle}>Fotocamera e microfono</Text>
          <Text style={styles.permissionSubtitle}>
            Servono per registrare le serie e rivedere la tua tecnica.
          </Text>
          <Button
            title="Consenti accesso"
            style={{ alignSelf: 'stretch', marginTop: 8 }}
            onPress={async () => {
              await requestCameraPermission();
              await requestMicrophonePermission();
            }}
          />
          <Button title="Indietro" variant="secondary" style={{ alignSelf: 'stretch' }} onPress={closeVideoModal} />
        </View>
      ) : videoUri === null ? (
        <>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            mode="video"
            facing={cameraFacing}
            selectedLens={Platform.OS === 'ios' && wide ? ultraLens : undefined}
            zoom={Platform.OS === 'android' && wide ? -1 : 0}
            onAvailableLensesChanged={e => setUltraLens(e.lenses.find(l => /ultra/i.test(l.deviceType))?.deviceType)}
          />
          <View style={[styles.cameraBar, { paddingTop: insets.top + 8 }]}>
            <Pressable style={styles.cameraIconBtn} onPress={closeVideoModal} accessibilityLabel="Chiudi" hitSlop={8}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
            {isRecording ? (
              <View style={styles.recordTimerBadge}>
                <View style={styles.recordTimerDot} />
                <Text style={styles.recordTimerText}>{formatRecordTime(recordSeconds)}</Text>
              </View>
            ) : (
              <Text style={styles.cameraTitle} numberOfLines={1}>{title}</Text>
            )}
            <Pressable
              style={[styles.cameraIconBtn, isRecording && { opacity: 0.3 }]}
              onPress={() => {
                setWide(false);
                setCameraFacing(f => (f === 'back' ? 'front' : 'back'));
              }}
              disabled={isRecording}
              accessibilityLabel="Cambia fotocamera"
              hitSlop={8}
            >
              <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
            </Pressable>
          </View>

          <View style={[styles.cameraBottom, { paddingBottom: insets.bottom + 24 }]}>
            {canWide ? (
              <View style={[styles.lensRow, isRecording && { opacity: 0.3 }]}>
                {([true, false] as const).map(isWide => {
                  const on = wide === isWide;
                  return (
                    <Pressable
                      key={String(isWide)}
                      disabled={isRecording}
                      onPress={() => setWide(isWide)}
                      accessibilityLabel={isWide ? 'Grandangolo' : 'Obiettivo standard'}
                      accessibilityState={{ selected: on }}
                      style={[styles.lensBtn, on && styles.lensBtnOn]}
                    >
                      <Text style={[styles.lensText, on && { color: '#000' }]}>{isWide ? '0.5×' : '1×'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <Pressable
              style={styles.recordBtnOuter}
              onPress={isRecording ? stopVideoRecording : startVideoRecording}
              accessibilityLabel={isRecording ? 'Ferma registrazione' : 'Registra'}
            >
              <View style={[styles.recordBtnInner, isRecording ? styles.recordBtnInnerRecording : null]} />
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            fullscreenOptions={{ enable: false }}
            allowsPictureInPicture={false}
            contentFit="contain"
            nativeControls
          />
          <View style={[styles.cameraBar, { paddingTop: insets.top + 8 }]}>
            <Pressable style={styles.cameraIconBtn} onPress={closeVideoModal} accessibilityLabel="Chiudi" hitSlop={8}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
            <Text style={styles.cameraTitle}>Anteprima</Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={[styles.previewBar, { paddingBottom: insets.bottom + 16 }]}>
            <Button title="Riprova" icon="refresh" variant="secondary" style={{ flex: 1 }} onPress={() => setVideoUri(null)} />
            <Button title="Salva" icon="download-outline" style={{ flex: 1 }} onPress={saveVideoToGallery} />
          </View>
        </>
      )}
    </View>
  </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  cameraModalContainer: { flex: 1, backgroundColor: '#000' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12, backgroundColor: UI.bg },
  permissionTitle: { color: UI.text, fontSize: 20, fontWeight: '600', textAlign: 'center' },
  permissionSubtitle: { color: UI.muted, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  cameraBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.45)' },
  cameraTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', marginHorizontal: 12 },
  cameraIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  recordTimerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: UI.danger, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  recordTimerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  recordTimerText: { color: '#fff', fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  cameraBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 20, paddingTop: 16, backgroundColor: 'rgba(0,0,0,0.45)' },
  lensRow: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' },
  lensBtn: { minWidth: 48, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  lensBtnOn: { backgroundColor: '#fff' },
  lensText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  recordBtnOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  recordBtnInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: UI.danger },
  recordBtnInnerRecording: { width: 28, height: 28, borderRadius: 4 },
  previewBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16, backgroundColor: UI.bg },
}));
