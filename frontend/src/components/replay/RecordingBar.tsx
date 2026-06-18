/** Persistent header strip while a session recording is active. */
import { useEffect, useState } from 'react';
import { useSessionStore } from '../../stores/sessionStore';

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function RecordingBar() {
  const recording = useSessionStore((s) => s.recording);
  const recordingStart = useSessionStore((s) => s.recordingStart);
  const frameCount = useSessionStore((s) => s.recordingFrames.length);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!recording) {
      setElapsedMs(0);
      return;
    }
    const tick = () => setElapsedMs(Date.now() - recordingStart);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [recording, recordingStart]);

  if (!recording) return null;

  return (
    <div className="recording-bar" role="status" aria-live="polite">
      <span className="recording-bar-dot" aria-hidden />
      <span className="recording-bar-label">Recording</span>
      <span className="recording-bar-meta">{formatElapsed(elapsedMs)}</span>
      <span className="recording-bar-meta">{frameCount} frames</span>
    </div>
  );
}
