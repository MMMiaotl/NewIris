import { App, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { isWatchIoTransport } from '../../api/smcHttp';
import { MAX_SELECTED_PARAMETERS, useVariableStore } from '../../stores/variableStore';
import { usePlotStore } from '../../stores/plotStore';
import type { TreeNode } from '../../api/types';
import {
  branchHasLoadedChildren,
  branchHasLoadedVariables,
  flattenTree,
  wrapWithWatchIoRoot,
} from '../../utils/buildVariableTree';
import { VariableTreeNodeTitle } from './VariableTreeNodeTitle';
import {
  collectBranchKeys,
  toVariableTreeData,
  type VariableTreeDataNode,
} from './variableTreeData';

/** Must match .tree-structure-panel row height for virtual scroll. */
const TREE_ITEM_HEIGHT = 20;

interface VariableTreeProps {
  onExpandBranch?: (branch: string) => void;
  onLoadVariables?: (branch: string) => void;
}

export function VariableTree({ onExpandBranch, onLoadVariables }: VariableTreeProps) {
  const { message } = App.useApp();
  const flatTree = useConnectionStore((s) => s.flatTree);
  const searchQuery = useConnectionStore((s) => s.searchQuery);
  const transport = useConnectionStore((s) => s.config.transport);
  const watchIoName = useConnectionStore((s) => s.config.watchIoName);

  const treeNodes = useVariableStore((s) => s.treeNodes);
  const selectedBranch = useVariableStore((s) => s.selectedBranch);
  const selectedVariables = useVariableStore((s) => s.selectedVariables);
  const setSelectedBranch = useVariableStore((s) => s.setSelectedBranch);
  const toggleSelectedVariable = useVariableStore((s) => s.toggleSelectedVariable);
  const clearSelectedVariables = useVariableStore((s) => s.clearSelectedVariables);

  const addPlotVariable = usePlotStore((s) => s.addPlotVariable);

  const useDotTreeRoot = isWatchIoTransport(transport) && !flatTree;

  const selectedSet = useMemo(() => new Set(selectedVariables), [selectedVariables]);

  const displayNodes = useMemo(() => {
    let nodes = flatTree
      ? flattenTree(treeNodes)
      : useDotTreeRoot
        ? treeNodes
        : wrapWithWatchIoRoot(watchIoName, treeNodes);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const filter = (list: TreeNode[]): TreeNode[] =>
        list
          .map((n) => ({
            ...n,
            children: n.children ? filter(n.children) : undefined,
          }))
          .filter(
            (n) =>
              n.fullPath.toLowerCase().includes(q) ||
              (n.children && n.children.length > 0),
          );
      nodes = flatTree
        ? nodes.filter((n) => n.fullPath.toLowerCase().includes(q))
        : filter(nodes);
    }
    return nodes;
  }, [treeNodes, flatTree, searchQuery, watchIoName, useDotTreeRoot]);

  const treeData = useMemo(() => toVariableTreeData(displayNodes), [displayNodes]);

  const nodeKindMap = useMemo(() => {
    const map = new Map<string, TreeNode['nodeKind']>();
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        map.set(node.key, node.nodeKind);
        if (node.children?.length) walk(node.children);
      }
    };
    walk(displayNodes);
    return map;
  }, [displayNodes]);

  const [expandedKeys, setExpandedKeys] = useState<string[]>(() =>
    useDotTreeRoot ? [] : [watchIoName],
  );

  useEffect(() => {
    if (searchQuery) {
      setExpandedKeys(collectBranchKeys(displayNodes));
    }
  }, [searchQuery, displayNodes]);

  useEffect(() => {
    if (searchQuery) return;
    setExpandedKeys(useDotTreeRoot ? [] : [watchIoName]);
  }, [searchQuery, watchIoName, useDotTreeRoot]);

  const treeBodyRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(300);

  useEffect(() => {
    const el = treeBodyRef.current;
    if (!el) return;
    const update = () => setTreeHeight(Math.max(120, el.clientHeight));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const selectVariable = useCallback(
    (fullName: string) => {
      if (!toggleSelectedVariable(fullName)) {
        message.warning(`At most ${MAX_SELECTED_PARAMETERS} parameters can be selected`);
      }
    },
    [toggleSelectedVariable, message],
  );

  const titleRender = useCallback(
    (node: DataNode) => {
      const data = node as VariableTreeDataNode;
      const nodeKey = String(data.key);
      return (
        <VariableTreeNodeTitle
          nodeKey={nodeKey}
          title={String(data.title ?? '')}
          nodeKind={data.nodeKind ?? nodeKindMap.get(nodeKey)}
          selected={selectedSet.has(nodeKey)}
          onSelectVariable={selectVariable}
          onAddPlot={addPlotVariable}
        />
      );
    },
    [nodeKindMap, selectedSet, selectVariable, addPlotVariable],
  );

  const selectedKeys = useMemo(
    () =>
      selectedVariables.length > 0
        ? selectedVariables
        : selectedBranch
          ? [selectedBranch]
          : [],
    [selectedVariables, selectedBranch],
  );

  const isBranchKey = useCallback(
    (key: string) => nodeKindMap.get(key) !== 'variable',
    [nodeKindMap],
  );

  const headerLabel = searchQuery ? 'Tree structure (filtered)' : 'Tree structure';

  return (
    <div className="panel tree-structure-panel" aria-label="Tree structure">
      <div className="panel-header">{headerLabel}</div>
      <div ref={treeBodyRef} className="tree-body">
        <Tree
          height={treeHeight}
          itemHeight={TREE_ITEM_HEIGHT}
          virtual
          treeData={treeData}
          expandedKeys={expandedKeys}
          selectedKeys={selectedKeys}
          titleRender={titleRender}
          onExpand={(keys, { node, expanded }) => {
            setExpandedKeys(keys as string[]);
            if (!expanded) return;
            const key = String(node.key);
            if (!useDotTreeRoot && key === watchIoName) {
              onExpandBranch?.('');
              return;
            }
            if (isBranchKey(key)) {
              if (!branchHasLoadedChildren(treeNodes, key)) {
                onExpandBranch?.(key);
              }
              if (!branchHasLoadedVariables(treeNodes, key)) {
                onLoadVariables?.(key);
              }
            }
          }}
          onSelect={(keys) => {
            const key = (keys[0] as string) ?? null;
            if (!key || key === watchIoName) return;
            const kind = nodeKindMap.get(key);
            if (kind === 'variable') {
              selectVariable(key);
              return;
            }
            clearSelectedVariables();
            setSelectedBranch(key);
          }}
          showLine
          blockNode
        />
      </div>
    </div>
  );
}
