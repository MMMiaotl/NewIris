import { App, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useCallback, useMemo } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { isWatchIoTransport } from '../../api/smcHttp';
import { MAX_SELECTED_PARAMETERS, useVariableStore } from '../../stores/variableStore';
import { usePlotStore } from '../../stores/plotStore';
import type { TreeNode } from '../../api/types';
import {
  branchHasLoadedChildren,
  branchHasLoadedVariables,
  findTreeNode,
  flattenTree,
  wrapWithWatchIoRoot,
} from '../../utils/buildVariableTree';

function toAntTree(nodes: TreeNode[]): DataNode[] {
  return nodes.map((n) => ({
    key: n.key,
    title: n.title,
    isLeaf: n.isLeaf,
    children: n.children?.length ? toAntTree(n.children) : undefined,
  }));
}

interface VariableTreeProps {
  onExpandBranch?: (branch: string) => void;
  onLoadVariables?: (branch: string) => void;
}

export function VariableTree({ onExpandBranch, onLoadVariables }: VariableTreeProps) {
  const { message } = App.useApp();
  const { flatTree, searchQuery, config } = useConnectionStore();
  const {
    treeNodes,
    selectedBranch,
    selectedVariables,
    setSelectedBranch,
    toggleSelectedVariable,
    clearSelectedVariables,
  } = useVariableStore();
  const { addPlotVariable } = usePlotStore();
  const watchIoName = config.watchIoName;
  const useDotTreeRoot =
    isWatchIoTransport(config.transport) && !flatTree;

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

  const resolveNode = useCallback(
    (key: string): TreeNode | null => findTreeNode(treeNodes, key),
    [treeNodes],
  );

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
      const meta = resolveNode(String(node.key));
      if (meta?.nodeKind !== 'variable') return <span>{node.title as string}</span>;

      const fullName = String(node.key);
      const selected = selectedSet.has(fullName);

      return (
        <span
          className="tree-var-node"
          onDoubleClick={(e) => {
            e.stopPropagation();
            addPlotVariable(fullName);
          }}
        >
          <button
            type="button"
            className={`tree-var-indicator${selected ? ' is-selected' : ''}`}
            aria-label={selected ? 'Selected parameter' : 'Select parameter'}
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation();
              selectVariable(fullName);
            }}
          />
          <span className="tree-var-label">{node.title as string}</span>
        </span>
      );
    },
    [resolveNode, selectedSet, selectVariable, addPlotVariable],
  );

  const selectedKeys =
    selectedVariables.length > 0
      ? selectedVariables
      : selectedBranch
        ? [selectedBranch]
        : [];

  const isBranchKey = (key: string) => resolveNode(key)?.nodeKind !== 'variable';

  return (
    <div className="panel tree-structure-panel" aria-label="Tree structure">
      <Tree
        treeData={toAntTree(displayNodes)}
        selectedKeys={selectedKeys}
        titleRender={titleRender}
        onSelect={(keys) => {
          const key = (keys[0] as string) ?? null;
          if (!key || key === watchIoName) return;
          const meta = resolveNode(key);
          if (meta?.nodeKind === 'variable') {
            selectVariable(key);
            return;
          }
          clearSelectedVariables();
          setSelectedBranch(key);
        }}
        onExpand={(_keys, { node }) => {
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
        defaultExpandedKeys={useDotTreeRoot ? [] : [watchIoName]}
        defaultExpandAll={!!searchQuery}
        showLine
        blockNode
      />
    </div>
  );
}
