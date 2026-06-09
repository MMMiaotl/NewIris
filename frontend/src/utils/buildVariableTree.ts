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
      nodeKind: 'branch',
      children: nodes,
    },
  ];
}

export function parentBranchFromVariableName(fullName: string): string | null {
  const dot = fullName.lastIndexOf('.');
  if (dot <= 0) return null;
  return fullName.slice(0, dot);
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
    nodeKind: 'branch' as const,
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
          nodeKind: 'branch',
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
      const kind = n.nodeKind ?? 'branch';
      const branchSettled = kind === 'branch' && !!n.variablesLoaded && children.length === 0;
      const isLeaf = kind === 'variable' ? true : branchSettled ? true : false;
      return {
        ...n,
        nodeKind: kind,
        children,
        isLeaf,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

function branchPathContains(nodePath: string, branch: string): boolean {
  if (nodePath === branch) return true;
  const slash = branch.includes('/');
  const sep = slash ? '/' : '.';
  return branch.startsWith(`${nodePath}${sep}`);
}

/** Attach variable leaf nodes under a branch; keeps existing sub-branch children. */
export function attachVariablesToBranch(
  tree: TreeNode[],
  branch: string,
  variables: { name: string }[],
  branchVarPrefix: string | null,
): TreeNode[] {
  const attach = (nodes: TreeNode[]): TreeNode[] => {
    let changed = false;
    const next = nodes.map((node) => {
      if (node.nodeKind === 'variable') return node;
      if (node.fullPath === branch) {
        changed = true;
        const branchChildren = (node.children ?? []).filter((c) => c.nodeKind !== 'variable');
        const varChildren: TreeNode[] = variables.map((v) => ({
          key: v.name,
          title: variableDisplayName(v.name, branch, branchVarPrefix),
          fullPath: v.name,
          isLeaf: true,
          nodeKind: 'variable',
        }));
        const children = [...branchChildren, ...varChildren].sort((a, b) => {
          if (a.nodeKind !== b.nodeKind) return a.nodeKind === 'branch' ? -1 : 1;
          return a.title.localeCompare(b.title);
        });
        return {
          ...node,
          nodeKind: 'branch' as const,
          variablesLoaded: true,
          isLeaf: children.length === 0,
          children,
        };
      }
      if (node.children?.length && branchPathContains(node.fullPath, branch)) {
        const children = attach(node.children);
        if (children !== node.children) {
          changed = true;
          return { ...node, children };
        }
      }
      return node;
    });
    return changed ? next : nodes;
  };

  return attach(tree);
}

export function branchHasLoadedVariables(nodes: TreeNode[], branch: string): boolean {
  const node = findTreeNode(nodes, branch);
  return node?.variablesLoaded === true;
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
      nodeKind: 'branch' as const,
      children: [],
    };
  });

  if (!parentPath) return childNodes;

  const attach = (nodes: TreeNode[]): TreeNode[] => {
    let changed = false;
    const next = nodes.map((node) => {
      if (node.fullPath === parentPath) {
        changed = true;
        const merged = new Map<string, TreeNode>();
        for (const c of node.children ?? []) {
          if (c.nodeKind !== 'variable') merged.set(c.fullPath, c);
        }
        for (const c of childNodes) {
          const prev = merged.get(c.fullPath);
          merged.set(
            c.fullPath,
            prev?.children?.length ? { ...prev, title: c.title, isLeaf: false } : c,
          );
        }
        return {
          ...node,
          nodeKind: 'branch' as const,
          isLeaf: false,
          children: Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title)),
        };
      }
      if (node.children?.length && branchPathContains(node.fullPath, parentPath)) {
        const children = attach(node.children);
        if (children !== node.children) {
          changed = true;
          return { ...node, children };
        }
      }
      return node;
    });
    return changed ? next : nodes;
  };

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
    nodeKind: 'branch' as const,
    children: [],
  }));

  if (!parentPath) return childNodes;

  const attach = (nodes: TreeNode[]): TreeNode[] => {
    let changed = false;
    const next = nodes.map((node) => {
      if (node.fullPath === parentPath) {
        changed = true;
        const merged = new Map<string, TreeNode>();
        for (const c of node.children ?? []) {
          if (c.nodeKind !== 'variable') merged.set(c.fullPath, c);
        }
        for (const c of childNodes) merged.set(c.fullPath, c);
        return {
          ...node,
          nodeKind: 'branch' as const,
          isLeaf: false,
          children: Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title)),
        };
      }
      if (node.children?.length && branchPathContains(node.fullPath, parentPath)) {
        const children = attach(node.children);
        if (children !== node.children) {
          changed = true;
          return { ...node, children };
        }
      }
      return node;
    });
    return changed ? next : nodes;
  };

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
