import { useEffect, useRef } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { usePlotStore } from '../stores/plotStore';
import { useVariableStore } from '../stores/variableStore';

export function useReplay() {
  const { replayData, replayPlaying, replaySpeed, setReplayIndex } = useSessionStore();
  const { plotVariables, appendPoint, clearSeries } = usePlotStore();
  const { applyUpdate } = useVariableStore();
  const rafRef = useRef<number>(0);
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (!replayData || !replayPlaying) return;

    const tick = (now: number) => {
      if (!lastTickRef.current) lastTickRef.current = now;
      const elapsed = (now - lastTickRef.current) * replaySpeed;
      lastTickRef.current = now;

      const state = useSessionStore.getState();
      const data = state.replayData;
      if (!data) return;

      let idx = state.replayIndex;
      const frame = data.frames[idx];
      if (!frame) {
        useSessionStore.getState().setReplayPlaying(false);
        return;
      }

      const nextIdx = idx + 1;
      if (nextIdx < data.frames.length) {
        const dt = data.frames[nextIdx].t - frame.t;
        if (elapsed >= dt) {
          setReplayIndex(nextIdx);
          const next = data.frames[nextIdx];
          applyUpdate(
            Object.entries(next.values).map(([name, value]) => ({ name, value })),
          );
          for (const [name, value] of Object.entries(next.values)) {
            if (plotVariables.includes(name)) {
              appendPoint(name, next.t, value);
            }
          }
          lastTickRef.current = now;
        }
      } else {
        useSessionStore.getState().setReplayPlaying(false);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTickRef.current = 0;
    };
  }, [replayData, replayPlaying, replaySpeed, plotVariables, setReplayIndex, applyUpdate, appendPoint]);

  const seekTo = (index: number) => {
    const data = useSessionStore.getState().replayData;
    if (!data || index < 0 || index >= data.frames.length) return;
    setReplayIndex(index);
    const frame = data.frames[index];
    applyUpdate(Object.entries(frame.values).map(([name, value]) => ({ name, value })));
    clearSeries();
    const plotVars = usePlotStore.getState().plotVariables;
    for (let i = 0; i <= index; i++) {
      const f = data.frames[i];
      for (const [name, value] of Object.entries(f.values)) {
        if (plotVars.includes(name)) appendPoint(name, f.t, value);
      }
    }
  };

  return { seekTo, frameCount: replayData?.frames.length ?? 0 };
}
