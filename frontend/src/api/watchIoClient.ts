import type { WatchIoMessage } from './types';

export type MessageHandler = (msg: WatchIoMessage) => void;
export type StatusHandler = (
  status: 'connecting' | 'connected' | 'disconnected' | 'error',
  detail?: string,
) => void;

export interface WatchIoClient {
  connect(): Promise<void>;
  disconnect(): void;
  onMessage(handler: MessageHandler): () => void;
  onStatus(handler: StatusHandler): () => void;
  fetchVarTree(branch?: string): void;
  fetchVarLeaves(branch: string, withMeta?: boolean): void;
  fetchVarList(filter?: string): void;
  addVariable(name: string, mode?: 'value' | 'set'): void;
  removeVariable(name: string): void;
  setVariable(name: string, value: string): void;
  requestUpdate(): void;
}
