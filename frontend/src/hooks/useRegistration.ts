/**
 * useRegistration — drives the registration sampling loop.
 *
 * When registration is active, reads current variable values from variableStore
 * at each tick (using the same sampleInterval as the live monitor, or a custom
 * override), and appends a line to registrationStore.
 *
 * Consumed by AppShell; not rendered directly.
 */
import { useEffect, useRef } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { useVariableStore } from '../stores/variableStore';
import { useRegistrationStore } from '../stores/registrationStore';

export function useRegistration(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick function — runs at each sample interval
  const tick = () => {
    const regStore = useRegistrationStore.getState();
    if (!regStore.active || regStore.paused) return;

    const varStore = useVariableStore.getState();
    const varMap = new Map(varStore.variables.map((v) => [v.name, v.value]));

    const snapshot: Record<string, string> = {};
    for (const name of regStore.variables) {
      snapshot[name] = varMap.get(name) ?? '';
    }
    regStore.appendLine(snapshot);
  };

  useEffect(() => {
    const unsub = useRegistrationStore.subscribe((state, prev) => {
      const started = state.active && !prev.active;
      const stopped = !state.active && prev.active;

      if (started) {
        const { settings } = state;
        const globalInterval = useConnectionStore.getState().config.sampleInterval;
        const interval =
          settings.sampleIntervalMs > 0 ? settings.sampleIntervalMs : globalInterval;

        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(tick, Math.max(50, interval));
      }

      if (stopped) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    });

    return () => {
      unsub();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);
}
