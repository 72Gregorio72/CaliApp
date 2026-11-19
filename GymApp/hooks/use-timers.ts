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
  return { seconds, millis, running, start, pause, reset, setSeconds };
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
  return { seconds, millis, running, start, pause, reset };
}
