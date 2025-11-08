import MenuTree, { type MenuNode } from "../../../components/MenuTree";

type NodeInternal = {
  id: string;
  parentId: string | null;
  name: string;
  isLeaf: boolean;
  children: NodeInternal[];
  sortOrder?: number;
};

type NodeDto = {
  id: string;
  parentId: string | null;
  name: string;
  isLeaf: boolean;
  sortOrder?: number;
};


/* ---------- Tree helpers ---------- */
export function buildTreeFromFlat(dtos: NodeDto[]): MenuNode[] {
  const byId = new Map<string, NodeInternal>();
  for (const d of dtos) {
    const parent =
      typeof d.parentId === "string" ? d.parentId.trim() || null : null;
    byId.set(d.id, {
      id: d.id,
      parentId: parent,
      name: d.name,
      isLeaf: d.isLeaf,
      children: [],
      sortOrder: d.sortOrder,
    });
  }
  const roots: NodeInternal[] = [];
  for (const n of byId.values()) {
    if (n.parentId === null) roots.push(n);
    else {
      const p = byId.get(n.parentId);
      if (p) p.children.push(n);
      else roots.push(n);
    }
  }
  const sortRec = (arr: NodeInternal[]) => {
    arr.sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
    );
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  const toPub = (arr: NodeInternal[]): MenuNode[] =>
    arr.map((n) => ({
      id: n.id,
      parentId: n.parentId,
      name: n.name,
      isLeaf: n.children.length === 0,
      children: toPub(n.children),
    }));
  return toPub(roots);
}

export function findNode(nodes: MenuNode[], id: string | null): MenuNode | null {
  if (!id) return null;
  for (const n of nodes) {
    if (n.id === id) return n;
    const f = n.children && findNode(n.children, id);
    if (f) return f;
  }
  return null;
}

export function containsNodeId(arr: MenuNode[], id: string | null): boolean {
  if (!id) return false;
  const stack: MenuNode[] = [...arr];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === id) return true;
    if (n.children && n.children.length) stack.push(...n.children);
  }
  return false;
}