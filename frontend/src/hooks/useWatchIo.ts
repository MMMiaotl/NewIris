import { useCallback, useEffect, useRef } from 'react';
import type { WatchIoMessage } from '../api/types';
import type { WatchIoClient } from '../api/watchIoClient';
import { createWatchIoClient } from '../api/watchIoClientFactory';
import { useConnectionStore } from '../stores/connectionStore';
import { useVariableStore } from '../stores/variableStore';
import { usePlotStore } from '../stores/plotStore';
import { useSessionStore } from '../stores/sessionStore';
import {
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

export function useWatchIo() {
  const clientRef = useRef<WatchIoClient | null>(null);
  const sessionRef = useRef(0);
  const { config, appMode, status, setStatus } = useConnectionStore();
  const {
    setTreeNodes,
    mergeVarLeaves,
    mergeVarList,
    applyUpdate,
    selectedBranch,
    setBranchVarPrefix,
  } = useVariableStore();
  const { plotVariables, appendPoint } = usePlotStore();
  const { recording, appendRecordingFrame } = useSessionStore();

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
          mergeVarLeaves(entries, branch);
          if (useDotTree && branch) {
            const prefix = branch.endsWith('.') ? branch : `${branch}.`;
            const vars = useVariableStore.getState().variables.filter(
              (v) => v.name === branch || v.name.startsWith(prefix),
            );
            clientRef.current?.setMonitorList(
              vars.map((v) => ({ name: v.name, type: v.type, mode: 'set' as const })),
            );
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
          const now = Date.now();
          const values: Record<string, string> = {};
          for (const e of updateEntries) {
            if (e.value !== undefined) {
              values[e.name] = e.value;
              if (plotVariables.includes(e.name)) {
                appendPoint(e.name, now, e.value);
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
      plotVariables,
      appendPoint,
      recording,
      appendRecordingFrame,
      setBranchVarPrefix,
    ],
  );

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setStatus('disconnected');
  }, [setStatus]);

  const connect = useCallback(async () => {
    if (appMode === 'offline') return;

    const session = ++sessionRef.current;
    clientRef.current?.disconnect();
    useVariableStore.getState().clear();
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

  return {
    connect,
    disconnect,
    refreshBranch,
    registerVariable,
    unregisterVariable,
    setVariableValue,
    client: clientRef,
  };
}
