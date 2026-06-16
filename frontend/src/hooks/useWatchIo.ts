/**
 * Live WatchIO connection orchestrator.
 * Creates the transport client, routes incoming messages to stores, and syncs monitor lists.
 * Mount once in AppShell — expose connect/disconnect/setVariable callbacks to child components.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { ConnectionTransport, WatchIoEntry, WatchIoMessage } from '../api/types';
import type { MonitorVariable, WatchIoClient } from '../api/watchIoClient';
import { isWatchIoTransport } from '../api/smcHttp';
import { createWatchIoClient } from '../api/watchIoClientFactory';
import { useConnectionStore } from '../stores/connectionStore';
import { useVariableStore } from '../stores/variableStore';
import { usePlotStore, sampleLivePlotVariables } from '../stores/plotStore';
import { useSessionStore } from '../stores/sessionStore';
import {
  branchPathForVariableName,
  buildDotBranchTree,
  buildSmcModuleTree,
  mergeDotBranchIntoTree,
  mergeSmcBranchIntoTree,
} from '../utils/buildVariableTree';
import {
  extractBranchNames,
  normalizeEntries,
  parseVarleavesMeta,
  parseVartreeParent,
} from '../utils/parseWatchIoMessage';
import { watchIoLog } from '../utils/watchIoDebug';
import {
  collectPinnedVariableNames,
  missingPinnedVariableNames,
  pinnedNamesMissingOnBranch,
} from '../utils/pinnedVariables';
import { useWatchIoMessageLogStore } from '../stores/watchIoMessageLogStore';

export function useWatchIo() {
  const clientRef = useRef<WatchIoClient | null>(null);
  const sessionRef = useRef(0);
  const refetchedBranchesRef = useRef(new Set<string>());
  const pendingBranchFetchesRef = useRef(new Set<string>());
  const registeredPlotVarsRef = useRef(new Set<string>());
  const userDisconnectedWatchIoWsRef = useRef(false);
  const suppressAutoConnectRef = useRef(false);
  const prevTransportRef = useRef<ConnectionTransport | null>(null);
  const { config, appMode, status, setStatus, searchQuery, flatTree } = useConnectionStore();
  const selectedVariables = useVariableStore((s) => s.selectedVariables);
  const {
    setTreeNodes,
    mergeVarLeaves,
    mergeVarList,
    setSearchVarlistIndex,
    applyUpdate,
    selectedBranch,
    setBranchVarPrefix,
  } = useVariableStore();
  const plotVariables = usePlotStore((s) => s.plotVariables);
  const { recording, appendRecordingFrame } = useSessionStore();

  const buildWatchIoMonitorList = useCallback((): MonitorVariable[] => {
    const { variables, selectedVariables } = useVariableStore.getState();
    const plotVars = usePlotStore.getState().plotVariables;
    const names = new Set([...selectedVariables, ...plotVars]);
    return [...names].map((name) => {
      const variable = variables.find((v) => v.name === name);
      return {
        name,
        dataType: variable?.dataType,
        mode: plotVars.includes(name) ? 'value' : 'set',
      };
    });
  }, []);

  const syncWatchIoMonitorList = useCallback(() => {
    const client = clientRef.current;
    if (!client || !isWatchIoTransport(config.transport)) return;
    const list = buildWatchIoMonitorList();
    if (list.length) client.setMonitorList(list);
  }, [buildWatchIoMonitorList, config.transport]);

  /** Reload metadata/values for workspace-restored parameters and plot variables. */
  const refreshPinnedVariables = useCallback(() => {
    const client = clientRef.current;
    if (!client) return false;

    const transport = useConnectionStore.getState().config.transport;
    const pinnedNames = collectPinnedVariableNames();
    if (!pinnedNames.length) return true;

    const needsServerLoad = missingPinnedVariableNames();
    let fetchedBranch = false;

    if (isWatchIoTransport(transport)) {
      syncWatchIoMonitorList();
    } else if (transport === 'smcServer') {
      for (const name of pinnedNames) {
        client.addVariable(name);
      }
    }

    for (const name of needsServerLoad) {
      const branch = branchPathForVariableName(name, transport);
      if (!branch) continue;
      if (pendingBranchFetchesRef.current.has(branch)) continue;
      if (
        refetchedBranchesRef.current.has(branch) &&
        !pinnedNamesMissingOnBranch(branch, transport, pinnedNames)
      ) {
        continue;
      }
      pendingBranchFetchesRef.current.add(branch);
      fetchedBranch = true;
      watchIoLog('leaves', `reload branch for pinned variable ${name}`, { branch });
      client.fetchVarLeaves(branch);
    }

    if (isWatchIoTransport(transport) && (needsServerLoad.length > 0 || fetchedBranch)) {
      client.requestUpdate();
    }

    return needsServerLoad.length === 0;
  }, [syncWatchIoMonitorList]);

  const refreshPinnedVariablesRef = useRef(refreshPinnedVariables);
  refreshPinnedVariablesRef.current = refreshPinnedVariables;

  /** Full varlist from server; filtered client-side (backend matchfilter is case-sensitive). */
  const varlistSearchCacheRef = useRef<WatchIoEntry[] | null>(null);

  const handleMessage = useCallback(
    (msg: WatchIoMessage) => {
      // Route server payloads by message type into tree, table, plot, and recording stores.
      const entries = normalizeEntries(msg.entries);
      const transport = useConnectionStore.getState().config.transport;
      const useDotTree = transport === 'watchIoHttp' || transport === 'watchIoWs';

      if (msg.type === 'vartree' || msg.type === 'varleaves' || msg.type === 'varlist') {
        useConnectionStore.getState().setStatus('connected');
      }

      switch (msg.type) {
        case 'vartree': {
          const branches = extractBranchNames(msg);
          if (!branches.length) {
            watchIoLog('tree', 'vartree response had zero branches');
            break;
          }
          const parent = parseVartreeParent(msg);
          if (parent) {
            const merged = useDotTree
              ? mergeDotBranchIntoTree(
                  useVariableStore.getState().treeNodes,
                  parent,
                  branches,
                )
              : mergeSmcBranchIntoTree(
                  useVariableStore.getState().treeNodes,
                  parent,
                  branches,
                );
            watchIoLog('tree', `merge ${branches.length} children under "${parent}"`, branches.slice(0, 10));
            setTreeNodes(merged);
          } else {
            const existing = useVariableStore.getState().treeNodes;
            if (useDotTree && existing.length > 0) {
              watchIoLog('tree', 'skip root vartree replace — tree already loaded');
              queueMicrotask(() => refreshPinnedVariablesRef.current());
              break;
            }
            const tree = useDotTree ? buildDotBranchTree(branches) : buildSmcModuleTree(branches);
            watchIoLog('tree', `built tree from ${branches.length} branches`, {
              topLevel: tree.map((n) => n.fullPath),
              sample: branches.slice(0, 10),
            });
            setTreeNodes(tree);
          }
          if (useDotTree) {
            queueMicrotask(() => refreshPinnedVariablesRef.current());
          }
          break;
        }
        case 'varleaves': {
          const meta = parseVarleavesMeta(msg);
          if (meta.varprefix) setBranchVarPrefix(meta.varprefix);
          const branch = meta.branch ?? useVariableStore.getState().selectedBranch;
          if (!entries.length) {
            watchIoLog('leaves', 'varleaves response had zero variables', { branch });
          } else {
            watchIoLog('leaves', `received ${entries.length} variables for branch`, {
              branch,
              varprefix: meta.varprefix,
              sample: entries.slice(0, 5).map((e) => e.name),
            });
          }
          mergeVarLeaves(entries, branch, meta.varprefix);
          const plotVars = usePlotStore.getState().plotVariables;
          if (plotVars.length && entries.length) {
            const sampleMs = Date.now();
            const isSmcBranch = Boolean(branch?.includes('/'));
            const varPrefix = meta.varprefix ?? useVariableStore.getState().branchVarPrefix ?? '';
            for (const entry of entries) {
              if (entry.value === undefined) continue;
              let fullName = entry.name;
              if (isSmcBranch) {
                fullName =
                  entry.name.includes('.') || !varPrefix ? entry.name : `${varPrefix}${entry.name}`;
              } else if (branch && branch !== '.' && !entry.name.includes('.')) {
                fullName = `${branch}.${entry.name}`;
              }
              if (plotVars.includes(fullName)) {
                usePlotStore.getState().resyncPlotSeries(fullName, entry.value, sampleMs);
              }
            }
          }
          if (branch && !entries.length) {
            useVariableStore.getState().attachBranchVariables(branch);
          }
          if (branch) {
            pendingBranchFetchesRef.current.delete(branch);
            if (entries.length > 0) {
              refetchedBranchesRef.current.add(branch);
              const pinnedNames = collectPinnedVariableNames();
              if (pinnedNamesMissingOnBranch(branch, transport, pinnedNames)) {
                refetchedBranchesRef.current.delete(branch);
              }
            } else {
              refetchedBranchesRef.current.delete(branch);
            }
          }
          if (missingPinnedVariableNames().length) {
            queueMicrotask(() => refreshPinnedVariablesRef.current());
          }
          break;
        }
        case 'varlist': {
          const list = normalizeEntries(msg.entries);
          const q = useConnectionStore.getState().searchQuery.trim();
          const flat = useConnectionStore.getState().flatTree;
          if (!q && !flat) break;
          varlistSearchCacheRef.current = list;
          setSearchVarlistIndex(list.map((e) => e.name));
          break;
        }
        case 'update': {
          let updateEntries = normalizeEntries(msg.entries);
          if (!updateEntries.length && msg.name && msg.value !== undefined) {
            updateEntries = [{ name: msg.name, value: msg.value }];
          }
          const plotVars = usePlotStore.getState().plotVariables;
          const plotResyncNames = new Set<string>();
          for (const e of updateEntries) {
            if (!plotVars.includes(e.name) || e.value === undefined) continue;
            const prev = useVariableStore.getState().variables.find((v) => v.name === e.name);
            const points = usePlotStore.getState().seriesData[e.name] ?? [];
            if (prev?.sessionCacheOnly || points.length === 0) {
              plotResyncNames.add(e.name);
            }
          }
          applyUpdate(updateEntries);
          for (const name of plotResyncNames) {
            const val = updateEntries.find((e) => e.name === name)?.value;
            if (val !== undefined) {
              usePlotStore.getState().resyncPlotSeries(name, val);
            }
          }
          const values: Record<string, string> = {};
          for (const e of updateEntries) {
            if (e.value !== undefined) values[e.name] = e.value;
          }
          if (plotVars.length) {
            sampleLivePlotVariables();
          }
          if (recording && Object.keys(values).length) appendRecordingFrame(values);
          break;
        }
        case 'status':
          break;
        default:
          watchIoLog('msg', `unhandled type: ${msg.type}`);
          break;
      }
    },
    [
      setTreeNodes,
      mergeVarLeaves,
      mergeVarList,
      setSearchVarlistIndex,
      applyUpdate,
      recording,
      appendRecordingFrame,
      setBranchVarPrefix,
      syncWatchIoMonitorList,
    ],
  );

  const disconnect = useCallback((userInitiated = false) => {
    refetchedBranchesRef.current.clear();
    pendingBranchFetchesRef.current.clear();
    registeredPlotVarsRef.current.clear();
    clientRef.current?.disconnect();
    clientRef.current = null;
    useWatchIoMessageLogStore.getState().clear();
    if (userInitiated && useConnectionStore.getState().config.transport === 'watchIoWs') {
      userDisconnectedWatchIoWsRef.current = true;
    }
    setStatus('disconnected');
  }, [setStatus]);

  const connect = useCallback(async (): Promise<boolean> => {
    if (appMode === 'offline') return false;

    userDisconnectedWatchIoWsRef.current = false;
    suppressAutoConnectRef.current = true;
    const session = ++sessionRef.current;
    refetchedBranchesRef.current.clear();
    pendingBranchFetchesRef.current.clear();
    registeredPlotVarsRef.current.clear();
    clientRef.current?.disconnect();
    clientRef.current = null;
    useVariableStore.getState().clearConnectionCache(collectPinnedVariableNames());
    useWatchIoMessageLogStore.getState().clear();
    setBranchVarPrefix(null);

    const liveConfig = useConnectionStore.getState().config;
    watchIoLog('connect', `${liveConfig.transport} client`, liveConfig);
    const client = createWatchIoClient(liveConfig);
    client.onStatus((nextStatus, detail) => {
      if (session === sessionRef.current) setStatus(nextStatus, detail);
    });
    client.onMessage(handleMessage);
    clientRef.current = client;

    try {
      await client.connect();
      if (session !== sessionRef.current) return false;
      const branch = useVariableStore.getState().selectedBranch;
      if (branch) client.fetchVarLeaves(branch);
      for (const name of useVariableStore.getState().registeredNames) {
        client.addVariable(name, 'set');
      }
      refreshPinnedVariables();
      if (isWatchIoTransport(liveConfig.transport)) {
        syncWatchIoMonitorList();
        client.requestUpdate();
      }
      return useConnectionStore.getState().status === 'connected';
    } catch {
      if (session === sessionRef.current) setStatus('error', 'Connection failed');
      return false;
    } finally {
      suppressAutoConnectRef.current = false;
    }
  }, [appMode, handleMessage, setStatus, setBranchVarPrefix, refreshPinnedVariables, syncWatchIoMonitorList]);

  const applyWatchIoName = useCallback(
    async (watchIoName: string): Promise<boolean> => {
      const state = useConnectionStore.getState();
      const prevName = state.config.watchIoName;
      if (watchIoName === prevName) return true;

      state.setConfig({ watchIoName });

      if (state.appMode !== 'live' || !isWatchIoTransport(state.config.transport)) {
        return true;
      }
      if (state.status !== 'connected' && state.status !== 'connecting') {
        return true;
      }

      userDisconnectedWatchIoWsRef.current = false;
      return connect();
    },
    [connect],
  );

  useEffect(() => {
    const switchedToWatchIoWs =
      prevTransportRef.current !== 'watchIoWs' && config.transport === 'watchIoWs';
    prevTransportRef.current = config.transport;

    if (config.transport !== 'watchIoWs' || appMode !== 'live') return;
    if (switchedToWatchIoWs) userDisconnectedWatchIoWsRef.current = false;
    if (suppressAutoConnectRef.current) return;
    if (userDisconnectedWatchIoWsRef.current) return;
    if (status === 'connecting' || status === 'connected') return;
    if (status !== 'disconnected') return;

    void connect();
  }, [config.transport, appMode, status, connect]);

  const refreshBranch = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    if (selectedBranch) client.fetchVarLeaves(selectedBranch);
    else client.fetchVarTree();
  }, [selectedBranch]);

  const registerVariable = useCallback((name: string) => {
    clientRef.current?.addVariable(name, 'set');
    useVariableStore.getState().setRegistered(name, true);
  }, []);

  const unregisterVariable = useCallback((name: string) => {
    clientRef.current?.removeVariable(name);
    useVariableStore.getState().setRegistered(name, false);
  }, []);

  const setVariableValue = useCallback((name: string, value: string) => {
    useVariableStore.getState().updateLocalValue(name, value);
    clientRef.current?.setVariable(name, value);
  }, []);

  const refreshVariable = useCallback(
    (name: string) => {
      const client = clientRef.current;
      if (!client) return;
      const branch = branchPathForVariableName(name, config.transport);
      if (branch) client.fetchVarLeaves(branch);
      if (isWatchIoTransport(config.transport)) {
        syncWatchIoMonitorList();
      } else {
        client.addVariable(name);
      }
      client.requestUpdate();
      if (usePlotStore.getState().plotVariables.includes(name)) {
        queueMicrotask(() => usePlotStore.getState().resyncPlotSeries(name));
      }
    },
    [config.transport, syncWatchIoMonitorList],
  );

  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      suppressAutoConnectRef.current = false;
      disconnect();
    };
  }, [disconnect]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || appMode !== 'live' || status !== 'connected') return;
    if (selectedBranch) client.fetchVarLeaves(selectedBranch);
  }, [selectedBranch, appMode, status]);

  useEffect(() => {
    if (appMode !== 'live' || status !== 'connected') return;
    if (!missingPinnedVariableNames().length) return;

    refreshPinnedVariables();
    let attempts = 0;
    const id = window.setInterval(() => {
      attempts += 1;
      const done = refreshPinnedVariables();
      if (done || attempts >= 40) {
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [config.transport, appMode, status, selectedVariables, plotVariables, refreshPinnedVariables]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || appMode !== 'live' || status !== 'connected') return;

    const registered = registeredPlotVarsRef.current;
    const currentPlotVars = usePlotStore.getState().plotVariables;

    for (const name of [...registered]) {
      if (!currentPlotVars.includes(name)) {
        registered.delete(name);
      }
    }

    const newVars = currentPlotVars.filter((name) => !registered.has(name));
    if (!newVars.length) return;

    for (const name of newVars) {
      registered.add(name);
      const branch = branchPathForVariableName(name, config.transport);
      if (branch) client.fetchVarLeaves(branch);
    }
    if (isWatchIoTransport(config.transport)) {
      syncWatchIoMonitorList();
    } else {
      for (const name of newVars) {
        client.addVariable(name);
      }
    }
    client.requestUpdate();
  }, [plotVariables, appMode, status, config.transport, syncWatchIoMonitorList]);

  useEffect(() => {
    if (appMode !== 'live' || status !== 'connected') return;
    const q = searchQuery.trim();
    const needsVarlist = isWatchIoTransport(config.transport) && (q || flatTree);
    if (!needsVarlist) {
      varlistSearchCacheRef.current = null;
      setSearchVarlistIndex(null);
      return;
    }

    if (varlistSearchCacheRef.current) return;

    const id = window.setTimeout(() => {
      clientRef.current?.fetchVarList();
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchQuery, flatTree, appMode, status, config.transport, setSearchVarlistIndex]);

  useEffect(() => {
    if (appMode !== 'live' || status !== 'connected') return;
    if (!plotVariables.length) return;

    sampleLivePlotVariables();
    const interval = Math.max(100, config.sampleInterval);
    const id = setInterval(() => sampleLivePlotVariables(), interval);
    return () => clearInterval(id);
  }, [plotVariables, appMode, status, config.sampleInterval]);

  useEffect(() => {
    if (appMode !== 'live' || status !== 'connected') return;
    syncWatchIoMonitorList();
    if (isWatchIoTransport(config.transport)) {
      clientRef.current?.requestUpdate();
    }
  }, [selectedVariables, plotVariables, appMode, status, syncWatchIoMonitorList, config.transport]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || appMode !== 'live' || status !== 'connected') return;
    if (!isWatchIoTransport(config.transport)) return;
    if (!selectedVariables.length && !plotVariables.length) return;

    client.requestUpdate();
    const interval = Math.max(100, config.sampleInterval);
    const id = setInterval(() => client.requestUpdate(), interval);
    return () => clearInterval(id);
  }, [
    selectedVariables,
    plotVariables,
    appMode,
    status,
    config.sampleInterval,
    config.transport,
  ]);

  return {
    connect,
    disconnect,
    applyWatchIoName,
    refreshBranch,
    registerVariable,
    unregisterVariable,
    setVariableValue,
    refreshVariable,
    client: clientRef,
  };
}
