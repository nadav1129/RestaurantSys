import React from "react";
import MenuTree, { type MenuNode } from "../../../components/MenuTree";

export default function MenuStructurePanel({
  nodes,
  selectedNodeId,
  setSelectedNodeId,
  selectedMenu,
  selectedNodeName,
  onCreateNode,
  onRenameNode,
  onDeleteNode,
}: {
  nodes: MenuNode[];
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedMenu: number | null;
  selectedNodeName: string | null; // pass selectedNode?.name || null
  onCreateNode: () => void;
  onRenameNode: () => void;
  onDeleteNode: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-gray-500">Menu Structure</div>
          <div className="text-lg font-semibold text-gray-800">Build your tree</div>
          <div className="mt-1 text-xs text-gray-500">
            Target:{" "}
            {selectedNodeName ? (
              <>
                inside <span className="font-medium">“{selectedNodeName}”</span>
              </>
            ) : (
              "root"
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCreateNode}
            disabled={!selectedMenu}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            + Add Node
          </button>

          <button
            onClick={onRenameNode}
            disabled={!selectedMenu || !selectedNodeId}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="Rename selected node"
          >
            Edit Name
          </button>

          <button
            onClick={onDeleteNode}
            disabled={!selectedMenu || !selectedNodeId}
            className="rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="Delete selected node"
          >
            Remove Node
          </button>
        </div>
      </div>

      <div className="min-h-[260px]">
        {nodes.length === 0 ? (
          <div className="text-sm text-gray-400">(no categories yet)</div>
        ) : (
          <MenuTree
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
          />
        )}
      </div>
    </div>
  );
}
