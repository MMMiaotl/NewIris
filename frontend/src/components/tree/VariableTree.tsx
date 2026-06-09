import { Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useMemo } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { isWatchIoTransport } from '../../api/smcHttp';
import { useVariableStore } from '../../stores/variableStore';
import type { TreeNode } from '../../api/types';
import { flattenTree, wrapWithWatchIoRoot, branchHasLoadedChildren } from '../../utils/buildVariableTree';

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
}

export function VariableTree({ onExpandBranch }: VariableTreeProps) {
  const { flatTree, searchQuery, config } = useConnectionStore();
  const { treeNodes, selectedBranch, setSelectedBranch, setSelectedVariable } = useVariableStore();
  const watchIoName = config.watchIoName;
  const useDotTreeRoot =
    isWatchIoTransport(config.transport) && !flatTree;

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

  return (
    <div className="panel tree-structure-panel" aria-label="Tree structure">
      <Tree
        treeData={toAntTree(displayNodes)}
        selectedKeys={selectedBranch ? [selectedBranch] : []}
        onSelect={(keys) => {
          const key = (keys[0] as string) ?? null;
          if (!key || key === watchIoName) return;
          setSelectedVariable(null);
          setSelectedBranch(key);
        }}
        onExpand={(_keys, { node }) => {
          if (!onExpandBranch) return;
          const key = String(node.key);
          if (!useDotTreeRoot && key === watchIoName) {
            onExpandBranch('');
            return;
          }
          if (useDotTreeRoot && branchHasLoadedChildren(treeNodes, key)) return;
          onExpandBranch(key);
        }}
        defaultExpandedKeys={useDotTreeRoot ? [] : [watchIoName]}
        defaultExpandAll={!!searchQuery}
        showLine
        blockNode
      />
    </div>
  );
}
