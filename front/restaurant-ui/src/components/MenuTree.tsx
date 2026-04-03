import React from "react";
import { FolderTreeIcon } from "./icons";

export interface MenuNode {
  id: string;
  parentId: string | null;
  name: string;
  isLeaf: boolean;
  children?: MenuNode[];
  sortOrder?: number;
}

export default function MenuTree({
  nodes,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: MenuNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void; // <- allow null to select root
}) {
  /* we assume `nodes` is actually a list of root nodes, each with children[] recursively */
  React.useEffect(() => {
    try {
      // DEBUG: log what the tree receives
      // keep minimal to avoid noise
      // root IDs and names only
      // eslint-disable-next-line no-console
      console.debug("MenuTree props:", {
        rootCount: nodes.length,
        selectedNodeId,
        rootIds: nodes.map((n) => n.id),
        rootNames: nodes.map((n) => n.name),
      });
    } catch {}
  }, [nodes, selectedNodeId]);

   function renderNode(node: MenuNode, depth = 0) {
    const isSelected = node.id === selectedNodeId;
    const hasChildren = !!(node.children && node.children.length);

   return (
      <div key={node.id} className="mb-1">
        <button
          type="button" // <- safety
          className={[
            "flex w-full items-start rounded-2xl border px-3 py-3 text-left text-sm transition",
            isSelected
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "border-transparent text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--card)]",
          ].join(" ")}
          style={{ paddingLeft: `${depth * 14 + 14}px` }}
          onClick={() => onSelectNode(isSelected ? null : node.id)} // <- toggle to root
        >
          <div className="mr-3 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/55 text-current">
            <FolderTreeIcon className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium leading-none">{node.name}</span>
            <span className="mt-2 text-[11px] font-normal leading-none text-[var(--muted-foreground)]">
              {hasChildren ? "Category" : "Leaf (products live here)"}
            </span>
          </div>
        </button>

        {hasChildren && (
          <div className="mt-1">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return <div className="max-h-[70vh] overflow-y-auto">{nodes.map((n) => renderNode(n, 0))}</div>;
}
