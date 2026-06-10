import { create } from 'zustand';
import { createDefaultWatchIoService, isWatchIoTransport } from '../api/smcHttp';
import { defaultWsUrl } from '../api/watchIoPaths';
import { parseTransportEnv } from '../constants/transport';
import type {
  AppMode,
  ConnectionConfig,
  DiscoveredService,
  ViewMode,
} from '../api/types';

interface ConnectionState {
  config: ConnectionConfig;
  discoveredServices: DiscoveredService[];
  selectedServiceName: string | null;
  requestStatus: 'idle' | 'loading' | 'ok' | 'error';
  requestError?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  statusDetail?: string;
  appMode: AppMode;
  viewMode: ViewMode;
  flatTree: boolean;
  searchQuery: string;
  plotDrawerOpen: boolean;
  settingsDrawerOpen: boolean;
  watchIoLogDrawerOpen: boolean;
  setConfig: (partial: Partial<ConnectionConfig>) => void;
  setDiscoveredServices: (services: DiscoveredService[]) => void;
  selectService: (name: string) => void;
  setRequestStatus: (
    requestStatus: ConnectionState['requestStatus'],
    requestError?: string,
  ) => void;
  setStatus: (status: ConnectionState['status'], detail?: string) => void;
  setAppMode: (mode: AppMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setFlatTree: (flat: boolean) => void;
  setSearchQuery: (q: string) => void;
  setPlotDrawerOpen: (open: boolean) => void;
  setSettingsDrawerOpen: (open: boolean) => void;
  setWatchIoLogDrawerOpen: (open: boolean) => void;
}

const defaultHosts = ['localhost:8082', '127.0.0.1:8082'];

const initialTransport = parseTransportEnv(import.meta.env.VITE_TRANSPORT);

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  config: {
    transport: initialTransport,
    httpUrl: import.meta.env.VITE_HTTP_URL ?? '',
    wsUrl:
      import.meta.env.VITE_WS_URL ??
      defaultWsUrl(import.meta.env.VITE_HOST_ADDRESS ?? 'localhost:8082'),
    hostAddress: import.meta.env.VITE_HOST_ADDRESS ?? 'localhost:8082',
    watchIoName: import.meta.env.VITE_WATCHIO_NAME ?? 'SmcControl1',
    serverPath: initialTransport === 'smcServer' ? '/SmcServer1' : '/watchio',
    sampleInterval: 500,
  },
  discoveredServices: [],
  selectedServiceName: null,
  requestStatus: 'idle',
  status: 'disconnected',
  appMode: 'live',
  viewMode: 'splitter',
  flatTree: false,
  searchQuery: '',
  plotDrawerOpen: false,
  settingsDrawerOpen: false,
  watchIoLogDrawerOpen: false,
  setConfig: (partial) =>
    set((s) => {
      const next = { ...s.config, ...partial };
      if (partial.hostAddress && !partial.wsUrl) {
        next.wsUrl = defaultWsUrl(next.hostAddress);
      }
      if (partial.transport === 'smcServer' && partial.transport !== s.config.transport) {
        if (!partial.serverPath) next.serverPath = '/SmcServer1';
      }
      if (partial.transport && isWatchIoTransport(partial.transport)) {
        if (!partial.serverPath) next.serverPath = '/watchio';
      }
      return { config: next };
    }),
  setDiscoveredServices: (discoveredServices) => set({ discoveredServices }),
  selectService: (name) => {
    let service = get().discoveredServices.find((s) => s.name === name);
    if (!service && isWatchIoTransport(get().config.transport) && name === 'WatchIoWebServer') {
      service = createDefaultWatchIoService();
    }
    if (!service) return;

    const uri = service.uri.startsWith('/') ? service.uri : `/${service.uri}`;
    set({
      selectedServiceName: name,
      config: { ...get().config, serverPath: uri },
    });
  },
  setRequestStatus: (requestStatus, requestError) => set({ requestStatus, requestError }),
  setStatus: (status, statusDetail) => set({ status, statusDetail }),
  setAppMode: (appMode) => set({ appMode }),
  setViewMode: (viewMode) => set({ viewMode }),
  setFlatTree: (flatTree) => set({ flatTree }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setPlotDrawerOpen: (plotDrawerOpen) => set({ plotDrawerOpen }),
  setSettingsDrawerOpen: (settingsDrawerOpen) => set({ settingsDrawerOpen }),
  setWatchIoLogDrawerOpen: (watchIoLogDrawerOpen) => set({ watchIoLogDrawerOpen }),
}));

export const predefinedHosts = defaultHosts;
