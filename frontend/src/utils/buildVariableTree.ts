import type { ConnectionTransport, TreeNode } from '../api/types';

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

/** Group variables under their immediate parent branch (deepest branch in the path). */
export function groupVariablesByParentBranch(
  variables: { name: string }[],
): Map<string, { name: string }[]> {
  const byParent = new Map<string, { name: string }[]>();
  for (const variable of variables) {
    const parent = parentBranchFromVariableName(variable.name);
    if (!parent) continue;
    const list = byParent.get(parent) ?? [];
    list.push(variable);
    byParent.set(parent, list);
  }
  return byParent;
}

export function variableNameMatchesSearch(fullName: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fullName.toLowerCase().includes(q);
}

export function variableNodeMatchesSearch(node: TreeNode, query: string): boolean {
  if (node.nodeKind !== 'variable') return false;
  return variableNameMatchesSearch(node.fullPath, query);
}

/** All loaded + selected variables whose full name matches the query. */
export function collectMatchingVariableNames(
  variables: { name: string }[],
  selectedNames: string[],
  query: string,
): string[] {
  const q = query.trim();
  if (!q) return [];
  const out = new Set<string>();
  for (const v of variables) {
    if (variableNameMatchesSearch(v.name, q)) out.add(v.name);
  }
  for (const name of selectedNames) {
    if (variableNameMatchesSearch(name, q)) out.add(name);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

function collectAncestorBranchesForVariables(names: string[]): string[] {
  const set = new Set<string>();
  for (const name of names) {
    const parts = name.split('.');
    for (let i = 1; i < parts.length; i++) {
      set.add(parts.slice(0, i).join('.'));
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function mergeTreeNodesByPath(base: TreeNode[], incoming: TreeNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const node of base) map.set(node.fullPath, { ...node, children: node.children ? [...node.children] : [] });
  for (const node of incoming) {
    const prev = map.get(node.fullPath);
    if (!prev) {
      map.set(node.fullPath, { ...node, children: node.children ? [...node.children] : [] });
      continue;
    }
    const mergedChildren = mergeTreeNodesByPath(prev.children ?? [], node.children ?? []);
    map.set(node.fullPath, {
      ...prev,
      ...node,
      nodeKind: prev.nodeKind ?? node.nodeKind,
      children: mergedChildren.length ? mergedChildren : prev.children,
    });
  }
  return sortTreeNodes(Array.from(map.values()));
}

/** Ensure ancestor branches + matching variable leaves exist (dot-path tree). */
export function mergeSearchVariablesIntoDotTree(
  tree: TreeNode[],
  matchingNames: string[],
  branchVarPrefix: string | null,
): TreeNode[] {
  if (!matchingNames.length) return tree;

  const branchPaths = collectAncestorBranchesForVariables(matchingNames);
  let merged = branchPaths.length ? mergeTreeNodesByPath(tree, buildDotBranchTree(branchPaths)) : tree;

  const byParent = groupVariablesByParentBranch(matchingNames.map((name) => ({ name })));
  for (const [parentBranch, vars] of byParent) {
    merged = attachVariablesToBranch(merged, parentBranch, vars, branchVarPrefix);
  }
  return merged;
}

export function buildFlatVariableSearchNodes(matchingNames: string[]): TreeNode[] {
  return matchingNames.map((name) => ({
    key: name,
    title: name,
    fullPath: name,
    isLeaf: true,
    nodeKind: 'variable' as const,
  }));
}

function sortTreeChildren(a: TreeNode, b: TreeNode): number {
  if (a.nodeKind !== b.nodeKind) return a.nodeKind === 'branch' ? -1 : 1;
  return a.title.localeCompare(b.title);
}

/** Keep ancestor branches only when a matching variable (deepest leaf) exists below. */
export function filterTreeByVariableSearch(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  const walk = (list: TreeNode[]): TreeNode[] => {
    const result: TreeNode[] = [];
    for (const node of list) {
      if (node.nodeKind === 'variable') {
        if (variableNodeMatchesSearch(node, q)) result.push({ ...node, children: undefined });
        continue;
      }

      const branchChildren = (node.children ?? []).filter((c) => c.nodeKind !== 'variable');
      const variableChildren = (node.children ?? []).filter((c) => c.nodeKind === 'variable');
      const filteredBranches = walk(branchChildren);
      const matchingVariables = variableChildren.filter((v) => variableNodeMatchesSearch(v, q));

      if (filteredBranches.length || matchingVariables.length) {
        result.push({
          ...node,
          children: [...filteredBranches, ...matchingVariables].sort(sortTreeChildren),
        });
      }
    }
    return result;
  };

  return walk(nodes);
}

export function filterFlatTreeByVariableSearch(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.filter((n) => n.nodeKind === 'variable' && variableNodeMatchesSearch(n, q));
}

/** C.Control.Roll.Accuracy -> Control/Control.Roll.Accuracy (SmcServer object path). */
export function watchIoBranchToSmcBranch(watchIoBranch: string): string {
  const withoutRoot = watchIoBranch.startsWith('C.') ? watchIoBranch.slice(2) : watchIoBranch;
  const dot = withoutRoot.indexOf('.');
  if (dot < 0) return withoutRoot;
  const module = withoutRoot.slice(0, dot);
  const rest = withoutRoot.slice(dot + 1);
  return `${module}/${module}.${rest}`;
}

export function branchPathForVariableName(
  fullName: string,
  transport: ConnectionTransport,
): string | null {
  const dotBranch = parentBranchFromVariableName(fullName);
  if (!dotBranch) return null;
  if (transport === 'smcServer') return watchIoBranchToSmcBranch(dotBranch);
  return dotBranch;
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

function nodeAtOrBelowBranch(nodePath: string, branch: string): boolean {
  if (nodePath === branch) return true;
  const sep = branch.includes('/') ? '/' : '.';
  return nodePath.startsWith(`${branch}${sep}`);
}

/** Remove variable leaves under branch (before re-attaching at deepest parent branches). */
export function stripVariableLeavesInBranchScope(
  tree: TreeNode[],
  branch: string,
): TreeNode[] {
  const strip = (nodes: TreeNode[]): TreeNode[] => {
    let changed = false;
    const next = nodes.map((node) => {
      if (node.nodeKind === 'variable') return node;
      let children = node.children;
      if (children?.length) {
        if (nodeAtOrBelowBranch(node.fullPath, branch)) {
          const filtered = children.filter((c) => c.nodeKind !== 'variable');
          if (filtered.length !== children.length) changed = true;
          children = filtered;
        }
        const nextChildren = strip(children);
        if (nextChildren !== children) {
          changed = true;
          children = nextChildren;
        }
      }
      return children !== node.children ? { ...node, children } : node;
    });
    return changed ? next : nodes;
  };
  return strip(tree);
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
        const children = [...branchChildren, ...varChildren].sort(sortTreeChildren);
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
