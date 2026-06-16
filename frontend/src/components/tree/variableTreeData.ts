import type { DataNode } from 'antd/es/tree';
import type { TreeNode, TreeNodeKind } from '../../api/types';

export interface VariableTreeDataNode extends DataNode {
  nodeKind?: TreeNodeKind;
}

export function toVariableTreeData(nodes: TreeNode[]): VariableTreeDataNode[] {
  return nodes.map((n) => ({
    key: n.key,
    title: n.title,
    isLeaf: n.isLeaf,
    nodeKind: n.nodeKind,
    children: n.children?.length ? toVariableTreeData(n.children) : undefined,
  }));
}

/** Expand keys for the roots of a filtered tree — first level only, not full depth. */
export function collectTopLevelBranchKeys(nodes: TreeNode[]): string[] {
  return nodes.filter((node) => (node.children?.length ?? 0) > 0).map((node) => node.key);
}

export function collectBranchKeys(nodes: TreeNode[]): string[] {
  const keys: string[] = [];
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      if (node.children?.length) {
        keys.push(node.key);
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return keys;
}
