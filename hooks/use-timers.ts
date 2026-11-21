import React from 'react';

export function useCountdown(initialSeconds: number, onComplete?: () => void) {
  const [remainingMs, setRemainingMs] = React.useState(initialSeconds * 1000);
  const [running, setRunning] = React.useState(false);
  const lastTsRef = React.useRef<number | null>(null);
  // Ref per evitare stale closure nel callback
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  React.useEffect(() => {
    if (!running) return;
    if (remainingMs <= 0) {
      // Timer finito: auto-stop e callback
      setRunning(false);
      onCompleteRef.current?.();
      return;
    }
    const id = setInterval(() => {
      const now = Date.now();
      const last = lastTsRef.current ?? now;
      const delta = now - last;
      lastTsRef.current = now;
      setRemainingMs(ms => (ms > 0 ? Math.max(0, ms - delta) : 0));
    }, 16);
    return () => clearInterval(id);
  }, [running, remainingMs]);
  const start = React.useCallback(() => {
    lastTsRef.current = Date.now();
    setRunning(true);
  }, []);
  const pause = React.useCallback(() => setRunning(false), []);
  const reset = React.useCallback((s: number) => {
    setRunning(false);
    lastTsRef.current = null;
    setRemainingMs(s * 1000);
  }, []);
  const seconds = Math.floor(remainingMs / 1000);
  const millis = Math.floor(remainingMs % 1000);
  const setSeconds = React.useCallback((s: number) => {
    setRemainingMs(s * 1000);
  }, []);
  /** Back to a saved state (resumed session); ms already accounts for the time away. */
  const restore = React.useCallback((ms: number, run: boolean) => {
    lastTsRef.current = Date.now();
    setRemainingMs(Math.max(0, ms));
    setRunning(run && ms > 0); // ran out while away: stopped at 0, no alarm (the notification already rang)
  }, []);
  return { seconds, millis, running, remainingMs, start, pause, reset, setSeconds, restore };
}

export function useStopwatch() {
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const lastTsRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const now = Date.now();
      const last = lastTsRef.current ?? now;
      const delta = now - last;
      lastTsRef.current = now;
      setElapsedMs(ms => ms + delta);
    }, 16);
    return () => clearInterval(id);
  }, [running]);
  const start = React.useCallback(() => {
    lastTsRef.current = Date.now();
    setRunning(true);
  }, []);
  const pause = React.useCallback(() => setRunning(false), []);
  const reset = React.useCallback(() => {
    setRunning(false);
    lastTsRef.current = null;
    setElapsedMs(0);
  }, []);
  const seconds = Math.floor(elapsedMs / 1000);
  const millis = Math.floor(elapsedMs % 1000);
  const restore = React.useCallback((ms: number, run: boolean) => {
    lastTsRef.current = Date.now();
    setElapsedMs(ms);
    setRunning(run);
  }, []);
  return { seconds, millis, running, elapsedMs, start, pause, reset, restore };
}
