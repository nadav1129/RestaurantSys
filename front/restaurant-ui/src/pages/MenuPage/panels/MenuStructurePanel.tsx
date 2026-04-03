import MenuTree, { type MenuNode } from "../../../components/MenuTree";
import Button from "../../../components/Button";
import {
  FolderTreeIcon,
  PlusIcon,
  SettingsIcon,
} from "../../../components/icons";
import { EmptyState, SectionCard } from "../../../components/ui/layout";

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
  selectedNodeName: string | null;
  onCreateNode: () => void;
  onRenameNode: () => void;
  onDeleteNode: () => void;
}) {
  return (
    <SectionCard
      title="Menu Structure"
      description={
        selectedNodeName
          ? `New sections will be created inside ${selectedNodeName}.`
          : "Select a node to target edits, or stay at root to create top-level sections."
      }
      actions={
        <>
          <Button onClick={onCreateNode} disabled={!selectedMenu}>
            <PlusIcon className="h-4 w-4" />
            Add Node
          </Button>
          <Button
            variant="secondary"
            onClick={onRenameNode}
            disabled={!selectedMenu || !selectedNodeId}
          >
            <SettingsIcon className="h-4 w-4" />
            Rename
          </Button>
          <Button
            variant="danger"
            onClick={onDeleteNode}
            disabled={!selectedMenu || !selectedNodeId}
          >
            Remove
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rs-pill">
          <FolderTreeIcon className="h-4 w-4" />
          {selectedNodeName ? `Targeting ${selectedNodeName}` : "Targeting menu root"}
        </div>

        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)] p-4">
          {nodes.length === 0 ? (
            <EmptyState
              title="No sections yet"
              description="Create a first section to begin structuring the current menu."
            />
          ) : (
            <MenuTree
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            />
          )}
        </div>
      </div>
    </SectionCard>
  );
}
