import { useCallback, useEffect, useRef } from 'react';
import type { WatchIoMessage } from '../api/types';
import type { MonitorVariable, WatchIoClient } from '../api/watchIoClient';
import { isWatchIoTransport } from '../api/smcHttp';
import { createWatchIoClient } from '../api/watchIoClientFactory';
import { useConnectionStore } from '../stores/connectionStore';
import { useVariableStore } from '../stores/variableStore';
import { usePlotStore } from '../stores/plotStore';
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
import { useWatchIoMessageLogStore } from '../stores/watchIoMessageLogStore';

export function useWatchIo() {
  const clientRef = useRef<WatchIoClient | null>(null);
  const sessionRef = useRef(0);
  const refetchedBranchesRef = useRef(new Set<string>());
  const registeredPlotVarsRef = useRef(new Set<string>());
  const { config, appMode, status, setStatus } = useConnectionStore();
  const selectedVariables = useVariableStore((s) => s.selectedVariables);
  const {
    setTreeNodes,
    mergeVarLeaves,
    mergeVarList,
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

  const handleMessage = useCallback(
    (msg: WatchIoMessage) => {
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
                usePlotStore.getState().appendPoint(fullName, entry.value);
              }
            }
          }
          if (branch && !entries.length) {
            useVariableStore.getState().attachBranchVariables(branch);
          }
          if (useDotTree && branch) {
            syncWatchIoMonitorList();
          }
          break;
        }
        case 'varlist':
          mergeVarList(entries);
          break;
        case 'update': {
          let updateEntries = normalizeEntries(msg.entries);
          if (!updateEntries.length && msg.name && msg.value !== undefined) {
            updateEntries = [{ name: msg.name, value: msg.value }];
          }
          applyUpdate(updateEntries);
          const values: Record<string, string> = {};
          const plotVars = usePlotStore.getState().plotVariables;
          for (const e of updateEntries) {
            if (e.value !== undefined) {
              values[e.name] = e.value;
              if (plotVars.includes(e.name)) {
                usePlotStore.getState().appendPoint(e.name, e.value);
              }
            }
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
      applyUpdate,
      recording,
      appendRecordingFrame,
      setBranchVarPrefix,
      syncWatchIoMonitorList,
    ],
  );

  const disconnect = useCallback(() => {
    refetchedBranchesRef.current.clear();
    registeredPlotVarsRef.current.clear();
    clientRef.current?.disconnect();
    clientRef.current = null;
    useWatchIoMessageLogStore.getState().clear();
    setStatus('disconnected');
  }, [setStatus]);

  const connect = useCallback(async () => {
    if (appMode === 'offline') return;

    const session = ++sessionRef.current;
    refetchedBranchesRef.current.clear();
    registeredPlotVarsRef.current.clear();
    clientRef.current?.disconnect();
    useVariableStore.getState().clear();
    useWatchIoMessageLogStore.getState().clear();
    setBranchVarPrefix(null);

    watchIoLog('connect', `${config.transport} client`, config);
    const client = createWatchIoClient(config);
    client.onStatus((status, detail) => {
      if (session === sessionRef.current) setStatus(status, detail);
    });
    client.onMessage(handleMessage);
    clientRef.current = client;

    try {
      await client.connect();
      if (session !== sessionRef.current) return;
      const branch = useVariableStore.getState().selectedBranch;
      if (branch) client.fetchVarLeaves(branch);
      for (const name of useVariableStore.getState().registeredNames) {
        client.addVariable(name, 'set');
      }
    } catch {
      if (session === sessionRef.current) setStatus('error', 'Connection failed');
    }
  }, [config, appMode, handleMessage, setStatus, setBranchVarPrefix]);

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
      client.addVariable(name, 'set');
      client.requestUpdate();
    },
    [config.transport],
  );

  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      disconnect();
    };
  }, [disconnect]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || appMode !== 'live' || status !== 'connected') return;
    if (selectedBranch) client.fetchVarLeaves(selectedBranch);
  }, [selectedBranch, appMode, status]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || appMode !== 'live' || status !== 'connected') return;

    const { selectedVariables, variables } = useVariableStore.getState();
    if (!selectedVariables.length) return;

    const loaded = new Set(variables.map((v) => v.name));
    for (const name of selectedVariables) {
      if (loaded.has(name)) continue;
      const branch = branchPathForVariableName(name, config.transport);
      if (!branch || refetchedBranchesRef.current.has(branch)) continue;
      refetchedBranchesRef.current.add(branch);
      watchIoLog('leaves', `reload branch for selected variable ${name}`, { branch });
      client.fetchVarLeaves(branch);
    }
  }, [config.transport, appMode, status, selectedVariables]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || appMode !== 'live' || status !== 'connected') return;

    const registered = registeredPlotVarsRef.current;
    const currentPlotVars = usePlotStore.getState().plotVariables;

    for (const name of [...registered]) {
      if (!currentPlotVars.includes(name)) {
        registered.delete(name);
        if (isWatchIoTransport(config.transport)) {
          client.removeVariable(name);
        }
      }
    }

    const newVars = currentPlotVars.filter((name) => !registered.has(name));
    if (!newVars.length) return;

    for (const name of newVars) {
      registered.add(name);
      const branch = branchPathForVariableName(name, config.transport);
      if (branch) client.fetchVarLeaves(branch);
      client.addVariable(name, 'value');
    }
    client.requestUpdate();
  }, [plotVariables, appMode, status, config.transport]);

  useEffect(() => {
    if (appMode !== 'live' || status !== 'connected') return;
    syncWatchIoMonitorList();
  }, [selectedVariables, plotVariables, appMode, status, syncWatchIoMonitorList]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || appMode !== 'live' || status !== 'connected') return;
    if (!plotVariables.length || !isWatchIoTransport(config.transport)) return;

    const interval = Math.max(100, config.sampleInterval);
    client.requestUpdate();
    const id = setInterval(() => client.requestUpdate(), interval);
    return () => clearInterval(id);
  }, [plotVariables, appMode, status, config.sampleInterval, config.transport]);

  return {
    connect,
    disconnect,
    refreshBranch,
    registerVariable,
    unregisterVariable,
    setVariableValue,
    refreshVariable,
    client: clientRef,
  };
}
