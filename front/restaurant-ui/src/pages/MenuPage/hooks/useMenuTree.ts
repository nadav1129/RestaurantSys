// src/pages/MenuPage/hooks/useMenuTree.ts
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../api/api";
import type { MenuNode } from "../../../components/MenuTree";
import { buildTreeFromFlat, findNode, containsNodeId } from "../utills/treeHelpers";

export type NodeDto = {
  id: string;
  parentId: string | null;
  name: string;
  isLeaf: boolean;
  sortOrder?: number;
};

export default function useMenuTree(selectedMenu: number | null) {
  const [nodes, setNodes] = useState<MenuNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => findNode(nodes, selectedNodeId),
    [nodes, selectedNodeId]
  );

  // Load / reload nodes whenever selectedMenu changes
  useEffect(() => {
    if (!selectedMenu) {
      setNodes([]);
      setSelectedNodeId(null);
      return;
    }
    void reloadNodesForSelectedMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMenu]);

  async function reloadNodesForSelectedMenu() {
    if (!selectedMenu) {
      setNodes([]);
      setSelectedNodeId(null);
      return;
    }
    try {
      const data = await apiFetch(`/api/menu-nodes?menu=${selectedMenu}`);
      const arr = Array.isArray(data) ? (data as any[]) : [];
      const isNested = arr.length && (arr[0].children || arr[0].Children);

      let nextNodes: MenuNode[] = [];
      if (isNested) {
        const mapNode = (s: any): MenuNode => ({
          id: String(s.id ?? s.Id ?? ""),
          parentId:
            s.parentId == null && s.ParentId == null
              ? null
              : String(s.parentId ?? s.ParentId),
          name: String(s.name ?? s.Name ?? ""),
          isLeaf: Boolean(s.isLeaf ?? s.IsLeaf ?? false),
          children: (s.children ?? s.Children ?? []).map(mapNode),
        });
        nextNodes = arr.map(mapNode);
      } else {
        nextNodes = buildTreeFromFlat(arr as NodeDto[]);
      }

      setNodes(nextNodes);

      // If the current selection no longer exists, clear it
      if (!containsNodeId(nextNodes, selectedNodeId)) {
        setSelectedNodeId(null);
      }
    } catch {
      setNodes([]);
      setSelectedNodeId(null);
    }
  }

  async function createNode() {
    if (!selectedMenu) return;

    const name = window.prompt("New category/leaf name?");
    if (!name?.trim()) return;

    const candidateParent = selectedNodeId ?? null;
    const parentId = containsNodeId(nodes, candidateParent) ? candidateParent : null;

    try {
      await apiFetch("/api/menu-nodes", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          isLeaf: false,
          parentId: parentId,                           // null => attach under this menu's root
          MenuNum: parentId ? undefined : selectedMenu, // required for root insert
        }),
      });

      await reloadNodesForSelectedMenu();
    } catch (e) {
      console.error("Create node failed", e);
    }
  }

  async function renameNode() {
    if (!selectedMenu || !selectedNodeId) return;
    const current = selectedNode?.name ?? "";
    const next = window.prompt("New name?", current)?.trim();
    if (!next) return;

    try {
      await apiFetch(`/api/menu-nodes/${selectedNodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      await reloadNodesForSelectedMenu();
    } catch (e) {
      console.error("Rename node failed", e);
    }
  }

  async function deleteNode() {
    if (!selectedMenu || !selectedNodeId) return;
    if (!window.confirm("Delete this category/leaf? This cannot be undone.")) return;

    try {
      await apiFetch(`/api/menu-nodes/${selectedNodeId}`, { method: "DELETE" });
      setSelectedNodeId(null);
      await reloadNodesForSelectedMenu();
    } catch (e) {
      console.error("Delete node failed", e);
      alert("Delete failed");
    }
  }

  return {
    nodes,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    reloadNodesForSelectedMenu,
    createNode,
    renameNode,
    deleteNode,
  };
}
