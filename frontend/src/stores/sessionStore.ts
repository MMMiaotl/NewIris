import { create } from 'zustand';
import type { RecordingFile } from '../api/types';

interface SessionState {
  recording: boolean;
  recordingFrames: { t: number; values: Record<string, string> }[];
  recordingStart: number;
  replayData: RecordingFile | null;
  replayIndex: number;
  replayPlaying: boolean;
  replaySpeed: number;
  recentSessions: string[];
  startRecording: () => void;
  stopRecording: () => { t: number; values: Record<string, string> }[];
  appendRecordingFrame: (values: Record<string, string>) => void;
  loadReplay: (data: RecordingFile) => void;
  setReplayIndex: (index: number) => void;
  setReplayPlaying: (playing: boolean) => void;
  setReplaySpeed: (speed: number) => void;
  clearReplay: () => void;
  addRecentSession: (name: string) => void;
}

const RECENT_KEY = 'newiris-recent-sessions';

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export const useSessionStore = create<SessionState>((set, get) => ({
  recording: false,
  recordingFrames: [],
  recordingStart: 0,
  replayData: null,
  replayIndex: 0,
  replayPlaying: false,
  replaySpeed: 1,
  recentSessions: loadRecent(),
  startRecording: () =>
    set({ recording: true, recordingFrames: [], recordingStart: Date.now() }),
  stopRecording: () => {
    const frames = get().recordingFrames;
    set({ recording: false });
    return frames;
  },
  appendRecordingFrame: (values) => {
    if (!get().recording) return;
    const t = Date.now() - get().recordingStart;
    set({ recordingFrames: [...get().recordingFrames, { t, values }] });
  },
  loadReplay: (replayData) =>
    set({ replayData, replayIndex: 0, replayPlaying: false, recording: false }),
  setReplayIndex: (replayIndex) => set({ replayIndex }),
  setReplayPlaying: (replayPlaying) => set({ replayPlaying }),
  setReplaySpeed: (replaySpeed) => set({ replaySpeed }),
  clearReplay: () => set({ replayData: null, replayIndex: 0, replayPlaying: false }),
  addRecentSession: (name) => {
    const recent = [name, ...get().recentSessions.filter((n) => n !== name)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    set({ recentSessions: recent });
  },
}));
