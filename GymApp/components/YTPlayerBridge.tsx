/**
 * YTPlayerBridge.tsx
 *
 * Componente "ponte" invisibile — si monta UNA SOLA VOLTA nel root layout
 * e rimane attivo durante tutta la navigazione dell'app.
 *
 * COME FUNZIONA:
 * 1. Legge `_currentVideoId` e `isPlaying` dal MusicContext
 * 2. Passa questi valori come props a YoutubeIframe
 * 3. Registra il proprio ref nel context (_ytBridgeRef) per permettere
 *    seekTo / getCurrentTime / getDuration
 * 4. Chiama i callback del context (_onYTStateChange, _onYTReady, _onYTError)
 *    per aggiornare lo stato globale in risposta agli eventi del player
 *
 * ANDROID — ANTI-ERRORE 150/152:
 * YouTube blocca l'embedding su WebView che non presentano uno User-Agent
 * di browser mobile reale. Il UA qui sotto bypassa questa restrizione.
 *
 * Il WebView è tenuto DENTRO i bordi dello schermo (opacity=0, size=1x1)
 * perché Android tende a sospendere i WebView posizionati fuori schermo,
 * interrompendo sia la riproduzione che la comunicazione JS.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import YoutubeIframe, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useMusic } from '@/context/MusicContext';

// ─────────────────────────────────────────────────────────────────
// Tipo del ref esposto al context
// ─────────────────────────────────────────────────────────────────
export type YTPlayerBridgeRef = {
  /** Salta a un momento specifico nel video corrente (secondi assoluti) */
  seekTo: (seconds: number) => void;
  /** Restituisce il tempo corrente in secondi */
  getCurrentTime: () => Promise<number>;
  /** Restituisce la durata totale in secondi */
  getDuration: () => Promise<number>;
};

// ─────────────────────────────────────────────────────────────────
// User-Agent Chrome Mobile — evita errori 150/152 di YouTube
// ─────────────────────────────────────────────────────────────────
const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Mobile Safari/537.36';

// ─────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────
export default function YTPlayerBridge() {
  const {
    _currentVideoId,
    isPlaying,
    _ytBridgeRef,
    _onYTStateChange,
    _onYTReady,
    _onYTError,
  } = useMusic();

  const playerRef = useRef<YoutubeIframeRef>(null);

  // Registra i metodi nel ref del context così il MusicContext
  // può chiamarli (es. seekTo) senza montare il bridge come figlio diretto
  useEffect(() => {
    _ytBridgeRef.current = {
      seekTo: (seconds: number) => {
        playerRef.current?.seekTo(seconds, true);
      },
      getCurrentTime: async () => {
        return (await playerRef.current?.getCurrentTime()) ?? 0;
      },
      getDuration: async () => {
        return (await playerRef.current?.getDuration()) ?? 0;
      },
    };

    // Cleanup al dismount (rarissimo — è nel root layout)
    return () => {
      _ytBridgeRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo al mount — il ref non cambia

  // Non renderizzare nulla se non c'è ancora un video selezionato
  if (!_currentVideoId) return null;

  return (
    /**
     * View nascosta ma DENTRO lo schermo (top:0, left:0, opacity:0).
     * NON posizionata fuori dallo schermo (-9999) perché Android
     * può sospendere i WebView off-screen, bloccando audio e messaggi.
     * pointerEvents="none" evita che intercetti i touch dell'utente.
     */
    <View style={styles.hiddenContainer} pointerEvents="none">
      <YoutubeIframe
        ref={playerRef}
        height={1}
        width={1}
        /**
         * ── VIDEOCONTROL ──
         * videoId: cambia automaticamente quando il context aggiorna _currentVideoId
         * play: direttamente controllato da isPlaying — true=play, false=pause
         */
        videoId={_currentVideoId}
        play={isPlaying}
        /**
         * ── CALLBACKS ──
         * Sincronizzano lo stato del player con il MusicContext globale
         */
        onReady={_onYTReady}
        onChangeState={_onYTStateChange}
        onError={_onYTError}
        /**
         * ── WEBVIEW PROPS ──
         */
        webViewProps={{
          androidLayerType: Platform.OS === 'android' ? 'hardware' : undefined,
          userAgent: MOBILE_USER_AGENT,
          mediaPlaybackRequiresUserAction: false,
          allowsInlineMediaPlayback: true,
          showsHorizontalScrollIndicator: false,
          showsVerticalScrollIndicator: false,
          injectedJavaScript: `
            (function() {
              function skipAds() {
                var video = document.querySelector('video');
                var player = document.querySelector('.html5-video-player');
                var isAdShowing = player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));
                
                if (video && isAdShowing) {
                  video.muted = true;
                  video.playbackRate = 16;
                  if (video.duration && isFinite(video.duration)) {
                    video.currentTime = video.duration - 0.1;
                  }
                }

                var skipButtons = [
                  '.ytp-ad-skip-button',
                  '.ytp-ad-skip-button-modern',
                  '.ytp-ad-skip-button-slot',
                  '.ytp-ad-skip-button-text'
                ];
                for (var i = 0; i < skipButtons.length; i++) {
                  var button = document.querySelector(skipButtons[i]);
                  if (button) {
                    button.click();
                    break;
                  }
                }

                var adElements = [
                  '.ytp-ad-module',
                  '.ytp-ad-overlay-container',
                  '.video-ads',
                  '.ytp-ad-player-overlay',
                  '.ytp-ad-player-overlay-layout-cards',
                  '.ytp-ad-action-interstitial'
                ];
                adElements.forEach(function(selector) {
                  var elements = document.querySelectorAll(selector);
                  elements.forEach(function(el) {
                    if (el.style.display !== 'none') {
                      el.style.display = 'none';
                    }
                  });
                });
              }

              skipAds();
              setInterval(skipAds, 200);
            })();
            true;
          `,
        }}
        /**
         * ── PLAYER PARAMS ──
         */
        initialPlayerParams={{
          controls: false,
          preventFullScreen: true,
          modestbranding: true,
          rel: false,
          loop: false,
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Stili
// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    // DENTRO lo schermo ma invisibile — evita la sospensione Android
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});
