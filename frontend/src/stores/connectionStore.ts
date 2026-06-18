/**
 * Connection UI state: transport config, /request discovery, connect status, layout prefs.
 * Server I/O and message routing live in useWatchIo — not here.
 */
import { create } from 'zustand';
import {
  createDefaultWatchIoService,
  fetchRequestServices,
  isWatchIoTransport,
  pickDiscoveredService,
} from '../api/smcHttp';
import { defaultWsUrl } from '../api/watchIoPaths';
import type { ConnectionTransport } from '../api/types';
import {
  defaultServerPath,
  defaultWatchIoNames,
  parseTransportEnv,
} from '../constants/transport';
import type {
  AppMode,
  ConnectionConfig,
  DiscoveredService,
  ViewMode,
} from '../api/types';
import { watchIoLog } from '../utils/watchIoDebug';

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
  controlPanelWidth: number;
  connectionModalOpen: boolean;
  watchIoLogDrawerOpen: boolean;
  statusDrawerOpen: boolean;
  setConfig: (partial: Partial<ConnectionConfig>) => void;
  setTransport: (transport: ConnectionTransport) => void;
  resetWatchIoDiscovery: () => void;
  runDiscovery: () => Promise<void>;
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
  setControlPanelWidth: (width: number) => void;
  setConnectionModalOpen: (open: boolean) => void;
  setWatchIoLogDrawerOpen: (open: boolean) => void;
  setStatusDrawerOpen: (open: boolean) => void;
}

export const DEFAULT_CONTROL_PANEL_WIDTH = 400;
export const MIN_CONTROL_PANEL_WIDTH = 280;
export const DEFAULT_TREE_PANEL_WIDTH = 240;
export const MIN_TREE_PANEL_WIDTH = 200;

export const predefinedHosts = ['localhost:8082', '127.0.0.1:8082'];

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
    serverPath: defaultServerPath(initialTransport),
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
  controlPanelWidth: DEFAULT_CONTROL_PANEL_WIDTH,
  connectionModalOpen: false,
  watchIoLogDrawerOpen: false,
  statusDrawerOpen: false,
  setConfig: (partial) =>
    set((s) => {
      const next = { ...s.config, ...partial };
      if (partial.hostAddress && !partial.wsUrl) {
        next.wsUrl = defaultWsUrl(next.hostAddress);
      }
      if (partial.transport && partial.transport !== s.config.transport && !partial.serverPath) {
        next.serverPath = defaultServerPath(partial.transport);
      }
      return { config: next };
    }),
  setTransport: (transport) => {
    const gatewayDefault =
      transport === 'watchIoHttp' || transport === 'watchIoWs' || transport === 'sharedMemory';
    const fallback = createDefaultWatchIoService();
    set({
      config: {
        ...get().config,
        transport,
        serverPath: defaultServerPath(transport),
        watchIoName: defaultWatchIoNames[transport],
      },
      requestStatus: gatewayDefault ? 'ok' : 'idle',
      requestError: undefined,
      discoveredServices: gatewayDefault ? [fallback] : [],
      selectedServiceName: gatewayDefault ? fallback.name : null,
    });
  },
  resetWatchIoDiscovery: () => {
    const fallback = createDefaultWatchIoService();
    set({
      discoveredServices: [fallback],
      selectedServiceName: fallback.name,
      config: { ...get().config, serverPath: fallback.uri },
      requestStatus: 'ok',
    });
  },
  runDiscovery: async () => {
    const { config } = get();
    set({ requestStatus: 'loading', requestError: undefined });
    try {
      const services = await fetchRequestServices(
        config.httpUrl,
        config.transport,
        config.wsUrl || defaultWsUrl(config.hostAddress),
      );
      set({ discoveredServices: services, requestStatus: 'ok' });
      watchIoLog('discover', `/request (${config.transport})`, {
        count: services.length,
        services,
      });
      const pick = pickDiscoveredService(services, config.transport);
      if (pick) get().selectService(pick.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      set({ requestStatus: 'error', requestError: msg });
      if (config.transport === 'watchIoHttp' || config.transport === 'watchIoWs') {
        get().resetWatchIoDiscovery();
      } else {
        set({ discoveredServices: [], selectedServiceName: null });
      }
    }
  },
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
  setControlPanelWidth: (controlPanelWidth) =>
    set({ controlPanelWidth: Math.max(MIN_CONTROL_PANEL_WIDTH, Math.round(controlPanelWidth)) }),
  setConnectionModalOpen: (connectionModalOpen) => set({ connectionModalOpen }),
  setWatchIoLogDrawerOpen: (watchIoLogDrawerOpen) => set({ watchIoLogDrawerOpen }),
  setStatusDrawerOpen: (statusDrawerOpen) => set({ statusDrawerOpen }),
}));
