import type { TreeNode } from '../api/types';

export function filterVariablesByBranch(
  variables: { name: string }[],
  branch: string | null,
  branchVarPrefix: string | null = null,
): { name: string }[] {
  if (!branch) return variables;
  if (branch.includes('/') && branchVarPrefix) {
    return variables.filter((v) => v.name.startsWith(branchVarPrefix));
  }
  const prefix = branch.endsWith('.') ? branch : `${branch}.`;
  return variables.filter((v) => v.name === branch || v.name.startsWith(prefix));
}

export function wrapWithWatchIoRoot(watchIoName: string, nodes: TreeNode[]): TreeNode[] {
  if (!watchIoName) return nodes;
  return [
    {
      key: watchIoName,
      title: watchIoName,
      fullPath: watchIoName,
      isLeaf: false,
      children: nodes,
    },
  ];
}

export function variableDisplayName(
  fullName: string,
  branch: string | null,
  branchVarPrefix: string | null = null,
): string {
  if (!branch) return fullName;
  if (branch.includes('/') && branchVarPrefix && fullName.startsWith(branchVarPrefix)) {
    return fullName.slice(branchVarPrefix.length);
  }
  const prefix = branch.endsWith('.') ? branch : `${branch}.`;
  if (fullName.startsWith(prefix)) return fullName.slice(prefix.length);
  return fullName;
}

export function buildSmcModuleTree(modules: string[]): TreeNode[] {
  return modules.map((name) => ({
    key: name,
    title: name,
    fullPath: name,
    isLeaf: false,
    children: [],
  }));
}

/** WatchIoWebServer vartree — build nested tree from dot-separated branch paths. */
export function buildDotBranchTree(branches: string[]): TreeNode[] {
  const byPath = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  const sorted = [...new Set(branches.filter(Boolean))].sort((a, b) => a.localeCompare(b));

  for (const path of sorted) {
    const parts = path.split('.');
    let prefix = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const fullPath = prefix ? `${prefix}.${part}` : part;
      if (!byPath.has(fullPath)) {
        const node: TreeNode = {
          key: fullPath,
          title: part,
          fullPath,
          isLeaf: false,
          children: [],
        };
        byPath.set(fullPath, node);
        if (prefix) {
          byPath.get(prefix)!.children!.push(node);
        } else {
          roots.push(node);
        }
      }
      prefix = fullPath;
    }
  }

  return sortTreeNodes(roots);
}

function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .map((n) => {
      const children = n.children?.length ? sortTreeNodes(n.children) : [];
      return {
        ...n,
        children,
        isLeaf: children.length === 0,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function findTreeNode(nodes: TreeNode[], fullPath: string): TreeNode | null {
  for (const node of nodes) {
    if (node.fullPath === fullPath) return node;
    if (node.children?.length) {
      const found = findTreeNode(node.children, fullPath);
      if (found) return found;
    }
  }
  return null;
}

export function branchHasLoadedChildren(nodes: TreeNode[], branch: string): boolean {
  const node = findTreeNode(nodes, branch);
  return !!(node?.children && node.children.length > 0);
}

export function mergeDotBranchIntoTree(
  tree: TreeNode[],
  parentPath: string,
  childNames: string[],
): TreeNode[] {
  const childNodes: TreeNode[] = childNames.map((rel) => {
    const fullPath = parentPath ? `${parentPath}.${rel}` : rel;
    return {
      key: fullPath,
      title: rel,
      fullPath,
      isLeaf: false,
      children: [],
    };
  });

  if (!parentPath) return childNodes;

  const attach = (nodes: TreeNode[]): TreeNode[] =>
    nodes.map((node) => {
      if (node.fullPath === parentPath) {
        const merged = new Map<string, TreeNode>();
        for (const c of node.children ?? []) merged.set(c.fullPath, c);
        for (const c of childNodes) {
          const prev = merged.get(c.fullPath);
          merged.set(
            c.fullPath,
            prev?.children?.length ? { ...prev, title: c.title, isLeaf: false } : c,
          );
        }
        return {
          ...node,
          isLeaf: false,
          children: Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title)),
        };
      }
      if (node.children?.length) {
        return { ...node, children: attach(node.children) };
      }
      return node;
    });

  return attach(tree);
}

/** SmcServer object paths use module/object (slashes). */
export function mergeSmcBranchIntoTree(
  tree: TreeNode[],
  parentPath: string,
  childPaths: string[],
): TreeNode[] {
  const childNodes: TreeNode[] = childPaths.map((fullPath) => ({
    key: fullPath,
    title: fullPath.slice(fullPath.lastIndexOf('/') + 1),
    fullPath,
    isLeaf: false,
    children: [],
  }));

  if (!parentPath) return childNodes;

  const attach = (nodes: TreeNode[]): TreeNode[] =>
    nodes.map((node) => {
      if (node.fullPath === parentPath) {
        const merged = new Map<string, TreeNode>();
        for (const c of node.children ?? []) merged.set(c.fullPath, c);
        for (const c of childNodes) merged.set(c.fullPath, c);
        return {
          ...node,
          isLeaf: false,
          children: Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title)),
        };
      }
      if (node.children?.length) {
        return { ...node, children: attach(node.children) };
      }
      return node;
    });

  return attach(tree);
}

export function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      result.push({ ...node, children: undefined, isLeaf: true });
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return result;
}
