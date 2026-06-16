/**
 * Live WatchIO connection orchestrator.
 * Creates the transport client, routes incoming messages to stores, and syncs monitor via add/delete diff.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectionTransport, WatchIoEntry, WatchIoMessage } from '../api/types';
import type { WatchIoClient } from '../api/watchIoClient';
import { isWatchIoTransport, isStompWatchIoTransport } from '../api/smcHttp';
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
import {
  clearPinnedBranchPending,
  createPinnedLivePipelineState,
  runPinnedLivePipeline,
  type PinnedLivePipelineState,
} from '../utils/watchIoLiveMonitor';
import { useWatchIoMessageLogStore } from '../stores/watchIoMessageLogStore';

function currentTransport(): ConnectionTransport {
  return useConnectionStore.getState().config.transport;
}

export function useWatchIo() {
  const clientRef = useRef<WatchIoClient | null>(null);
  const sessionRef = useRef(0);
  const refetchedBranchesRef = useRef(new Set<string>());
  const pendingBranchFetchesRef = useRef(new Set<string>());
  const pinnedPipelineRef = useRef<PinnedLivePipelineState>(createPinnedLivePipelineState());
  const [monitorEpoch, setMonitorEpoch] = useState(0);
  const smcPinnedPollRegisteredRef = useRef(false);
  const userDisconnectedWatchIoWsRef = useRef(false);
  const suppressAutoConnectRef = useRef(false);
  const prevTransportRef = useRef<ConnectionTransport | null>(null);
  const { config, appMode, status, setStatus, searchQuery, flatTree } = useConnectionStore();
  const selectedVariables = useVariableStore((s) => s.selectedVariables);
  const {
    setTreeNodes,
    mergeVarLeaves,
    setSearchVarlistIndex,
    applyUpdate,
    applyServerVariableEntries,
    selectedBranch,
    setBranchVarPrefix,
  } = useVariableStore();
  const plotVariables = usePlotStore((s) => s.plotVariables);
  const { recording, appendRecordingFrame } = useSessionStore();

  const runLivePipeline = useCallback(() => {
    if (!isWatchIoTransport(currentTransport())) return;
    const client = clientRef.current;
    const result = runPinnedLivePipeline(
      client,
      pinnedPipelineRef.current,
      currentTransport(),
    );
    if (result === 'synced') {
      setMonitorEpoch((n) => n + 1);
      if (client) {
        client.requestUpdate();
        window.setTimeout(() => client.requestUpdate(), 80);
        window.setTimeout(() => client.requestUpdate(), 200);
      }
    }
  }, []);

  const runLivePipelineRef = useRef(runLivePipeline);
  runLivePipelineRef.current = runLivePipeline;

  /** SmcServer: branch varleaves for pinned metadata. WatchIO uses the same branch path via pipeline. */
  const refreshSmcPinnedVariables = useCallback(() => {
    const client = clientRef.current;
    if (!client) return false;

    if (currentTransport() !== 'smcServer') return true;

    const pinnedNames = collectPinnedVariableNames();
    if (!pinnedNames.length) return true;

    if (!smcPinnedPollRegisteredRef.current) {
      smcPinnedPollRegisteredRef.current = true;
      for (const name of pinnedNames) {
        client.addVariable(name);
      }
    }

    const needsServerLoad = missingPinnedVariableNames();
    for (const name of needsServerLoad) {
      const branch = branchPathForVariableName(name, 'smcServer');
      if (!branch) continue;
      if (pendingBranchFetchesRef.current.has(branch)) continue;
      if (
        refetchedBranchesRef.current.has(branch) &&
        !pinnedNamesMissingOnBranch(branch, 'smcServer', pinnedNames)
      ) {
        continue;
      }
      pendingBranchFetchesRef.current.add(branch);
      watchIoLog('leaves', `reload branch for pinned variable ${name}`, { branch });
      client.fetchVarLeaves(branch);
    }

    return needsServerLoad.length === 0;
  }, []);

  const varlistSearchCacheRef = useRef<WatchIoEntry[] | null>(null);

  const handleMessage = useCallback(
    (msg: WatchIoMessage) => {
      const entries = normalizeEntries(msg.entries);
      const t = currentTransport();
      const useDotTree = isWatchIoTransport(t);

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
              break;
            }
            const tree = useDotTree ? buildDotBranchTree(branches) : buildSmcModuleTree(branches);
            watchIoLog('tree', `built tree from ${branches.length} branches`, {
              topLevel: tree.map((n) => n.fullPath),
              sample: branches.slice(0, 10),
            });
            setTreeNodes(tree);
          }
          break;
        }
        case 'varinfo': {
          if (entries.length) {
            applyServerVariableEntries(entries);
          }
          queueMicrotask(() => runLivePipelineRef.current());
          break;
        }
        case 'varleaves': {
          const meta = parseVarleavesMeta(msg);
          if (meta.varprefix) setBranchVarPrefix(meta.varprefix);
          const branch = meta.branch ?? useVariableStore.getState().selectedBranch;
          clearPinnedBranchPending(pinnedPipelineRef.current, branch ?? null);
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
              if (pinnedNamesMissingOnBranch(branch, t, pinnedNames)) {
                refetchedBranchesRef.current.delete(branch);
              }
            } else {
              refetchedBranchesRef.current.delete(branch);
            }
          }
          queueMicrotask(() => runLivePipelineRef.current());
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
      setSearchVarlistIndex,
      applyUpdate,
      applyServerVariableEntries,
      recording,
      appendRecordingFrame,
      setBranchVarPrefix,
    ],
  );

  const disconnect = useCallback((userInitiated = false) => {
    refetchedBranchesRef.current.clear();
    pendingBranchFetchesRef.current.clear();
    pinnedPipelineRef.current = createPinnedLivePipelineState();
    smcPinnedPollRegisteredRef.current = false;
    clientRef.current?.disconnect();
    clientRef.current = null;
    useWatchIoMessageLogStore.getState().clear();
    if (userInitiated && isStompWatchIoTransport(currentTransport())) {
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
    pinnedPipelineRef.current = createPinnedLivePipelineState();
    smcPinnedPollRegisteredRef.current = false;
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
      if (branch && missingPinnedVariableNames().length === 0) {
        client.fetchVarLeaves(branch);
      }
      if (!isWatchIoTransport(liveConfig.transport)) {
        for (const name of useVariableStore.getState().registeredNames) {
          client.addVariable(name, 'set');
        }
        refreshSmcPinnedVariables();
      } else {
        runLivePipeline();
      }
      return useConnectionStore.getState().status === 'connected';
    } catch (err) {
      if (session === sessionRef.current) {
        const detail = err instanceof Error ? err.message : 'Connection failed';
        setStatus('disconnected', detail);
      }
      return false;
    } finally {
      suppressAutoConnectRef.current = false;
    }
  }, [appMode, handleMessage, setStatus, setBranchVarPrefix, refreshSmcPinnedVariables, runLivePipeline]);

  const applyWatchIoName = useCallback(
    async (watchIoName: string): Promise<boolean | 'saved'> => {
      const state = useConnectionStore.getState();
      const prevName = state.config.watchIoName;
      const isLive = state.status === 'connected' || state.status === 'connecting';

      if (watchIoName === prevName && isLive) return true;

      const wasLiveWatchIo =
        state.appMode === 'live' && isWatchIoTransport(state.config.transport);

      if (watchIoName !== prevName) {
        state.setConfig({ watchIoName });
      }

      if (!wasLiveWatchIo) {
        return 'saved' as const;
      }

      userDisconnectedWatchIoWsRef.current = false;
      return connect();
    },
    [connect],
  );

  useEffect(() => {
    const switchedToStompWatchIo =
      !isStompWatchIoTransport(prevTransportRef.current ?? 'smcServer') &&
      isStompWatchIoTransport(config.transport);
    prevTransportRef.current = config.transport;

    if (!isStompWatchIoTransport(config.transport) || appMode !== 'live') return;
    if (switchedToStompWatchIo) userDisconnectedWatchIoWsRef.current = false;
    if (suppressAutoConnectRef.current) return;
    if (userDisconnectedWatchIoWsRef.current) return;
    if (status === 'connecting' || status === 'connected') return;
    if (status !== 'disconnected') return;

    void connect();
  }, [config.transport, appMode, status, connect]);

  const refreshBranch = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    const t = currentTransport();
    if (isWatchIoTransport(t) && missingPinnedVariableNames().length > 0) return;
    if (selectedBranch) client.fetchVarLeaves(selectedBranch);
    else client.fetchVarTree();
  }, [selectedBranch]);

  const registerVariable = useCallback(
    (name: string) => {
      useVariableStore.getState().setRegistered(name, true);
      if (isWatchIoTransport(currentTransport())) {
        runLivePipeline();
      } else {
        clientRef.current?.addVariable(name, 'set');
      }
    },
    [runLivePipeline],
  );

  const unregisterVariable = useCallback((name: string) => {
    useVariableStore.getState().setRegistered(name, false);
    pinnedPipelineRef.current.serverMonitored.delete(name);
    clientRef.current?.removeVariable(name);
  }, []);

  const setVariableValue = useCallback((name: string, value: string) => {
    useVariableStore.getState().updateLocalValue(name, value);
    clientRef.current?.setVariable(name, value);
  }, []);

  const refreshVariable = useCallback(
    (name: string) => {
      const client = clientRef.current;
      if (!client) return;
      const t = currentTransport();
      if (isWatchIoTransport(t)) {
        const branch = branchPathForVariableName(name, t);
        if (branch) {
          pinnedPipelineRef.current.pendingBranches.delete(branch);
          client.fetchVarLeaves(branch, true, true);
        }
        queueMicrotask(() => runLivePipelineRef.current());
      } else {
        const branch = branchPathForVariableName(name, t);
        if (branch) client.fetchVarLeaves(branch);
        client.addVariable(name);
        client.requestUpdate();
      }
      if (usePlotStore.getState().plotVariables.includes(name)) {
        queueMicrotask(() => usePlotStore.getState().resyncPlotSeries(name));
      }
    },
    [],
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
    if (missingPinnedVariableNames().length > 0) return;
    if (selectedBranch) client.fetchVarLeaves(selectedBranch);
  }, [selectedBranch, appMode, status, selectedVariables, plotVariables]);

  /** Pinned live pipeline: branch varleaves metadata → incremental monitor add (WatchIO) or branch reload (Smc). */
  useEffect(() => {
    if (appMode !== 'live' || status !== 'connected') return;

    if (isWatchIoTransport(config.transport)) {
      runLivePipeline();
      const id = window.setInterval(() => {
        if (missingPinnedVariableNames().length) {
          pinnedPipelineRef.current.pendingBranches.clear();
        }
        runLivePipeline();
      }, 250);
      return () => window.clearInterval(id);
    }

    refreshSmcPinnedVariables();
    const id = window.setInterval(() => {
      if (refreshSmcPinnedVariables()) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [
    config.transport,
    appMode,
    status,
    selectedVariables,
    plotVariables,
    runLivePipeline,
    refreshSmcPinnedVariables,
  ]);

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
    if (usePlotStore.getState().plotSampleMode) return;

    sampleLivePlotVariables();
    const interval = Math.max(100, config.sampleInterval);
    const id = setInterval(() => sampleLivePlotVariables(), interval);
    return () => clearInterval(id);
  }, [plotVariables, appMode, status, config.sampleInterval]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || appMode !== 'live' || status !== 'connected') return;
    if (!isWatchIoTransport(config.transport)) return;
    if (!selectedVariables.length && !plotVariables.length) return;
    if (pinnedPipelineRef.current.serverMonitored.size === 0) return;

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
    monitorEpoch,
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
