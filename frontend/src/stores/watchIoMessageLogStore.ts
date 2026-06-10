import { create } from 'zustand';
import type { WatchIoMessage } from '../api/types';

export interface WatchIoLoggedMessage {
  id: number;
  at: number;
  direction: 'recv' | 'send';
  msg: WatchIoMessage;
}

const MAX_MESSAGES = 120;

function shouldRetainMessage(msg: WatchIoMessage): boolean {
  // Skip high-frequency poll ticks; everything else (varleaves, vartree, status, …) is kept.
  return msg.type !== 'update';
}

interface WatchIoMessageLogState {
  messages: WatchIoLoggedMessage[];
  nextId: number;
  append: (direction: 'recv' | 'send', msg: WatchIoMessage) => void;
  clear: () => void;
}

export const useWatchIoMessageLogStore = create<WatchIoMessageLogState>((set, get) => ({
  messages: [],
  nextId: 1,
  append: (direction, msg) => {
    if (!shouldRetainMessage(msg)) return;
    const entry: WatchIoLoggedMessage = {
      id: get().nextId,
      at: Date.now(),
      direction,
      msg: structuredClone(msg),
    };
    set((s) => ({
      nextId: s.nextId + 1,
      messages: [...s.messages, entry].slice(-MAX_MESSAGES),
    }));
  },
  clear: () => set({ messages: [], nextId: 1 }),
}));
