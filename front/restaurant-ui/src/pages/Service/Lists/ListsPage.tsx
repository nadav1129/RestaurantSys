import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/Button";
import { apiFetch } from "../../../api/api";
import { EmptyState, PageHeader } from "../../../components/ui/layout";
import { PosActionStrip, PosPanel, PosStatusPill } from "../../../components/ui/pos";
import ListDetailPanel from "./ListDetailPage";

export const LIST_TYPES = ["Tables", "Names"] as const;
export type ListType = (typeof LIST_TYPES)[number];

type ListDto = {
  listId: string;
  title: string;
  listType: ListType;
};

type ListRow = {
  id: string;
  type: ListType;
  title: string;
};

type SelectMap = Record<string, boolean>;

export default function ListsPage() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [selected, setSelected] = useState<SelectMap>({});
  const [addOpen, setAddOpen] = useState(false);
  const [openList, setOpenList] = useState<ListDto | null>(null);
  const [addType, setAddType] = useState<ListType>("Tables");
  const [addTitle, setAddTitle] = useState("");

  const anySelected = useMemo(
    () => rows.some((row) => selected[row.id]),
    [rows, selected]
  );

  useEffect(() => {
    (async () => {
      try {
        const lists = (await apiFetch("/api/lists", {
          method: "GET",
        })) as ListDto[] | null;

        if (!lists) {
          setRows([]);
          return;
        }

        setRows(
          lists.map((list) => ({
            id: list.listId,
            type: list.listType,
            title: list.title,
          }))
        );
      } catch (err) {
        console.error("Failed to load lists", err);
      }
    })();
  }, []);

  const toggleSelect = (id: string) =>
    setSelected((current) => ({ ...current, [id]: !current[id] }));

  async function handleAdd() {
    const title = addTitle.trim();
    if (!title) return;

    try {
      const dto = (await apiFetch("/api/lists", {
        method: "POST",
        body: { title, listType: addType },
      })) as ListDto | null;

      if (!dto) return;

      setRows((prev) => [
        { id: dto.listId, type: dto.listType, title: dto.title },
        ...prev,
      ]);
      setAddTitle("");
      setAddType("Tables");
      setAddOpen(false);
    } catch (err) {
      console.error("Failed to add list", err);
    }
  }

  async function handleDeleteSelected() {
    const toDelete = rows.filter((row) => selected[row.id]);

    try {
      await Promise.all(
        toDelete.map((row) =>
          apiFetch(`/api/lists/${row.id}`, { method: "DELETE" })
        )
      );

      setRows((prev) => prev.filter((row) => !selected[row.id]));
      setSelected({});
    } catch (err) {
      console.error("Failed to delete selected lists", err);
    }
  }

  if (openList) {
    return (
      <div className="space-y-6">
        <ListDetailPanel list={openList} onClose={() => setOpenList(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management"
        title="Lists"
        description="Guest and table list management in the POS tablet layout."
      />

      <PosActionStrip>
        <Button onClick={() => setAddOpen((value) => !value)}>+ Add List</Button>
        <Button
          variant="secondary"
          onClick={handleDeleteSelected}
          disabled={!anySelected}
        >
          Delete Selected
        </Button>
      </PosActionStrip>

      {addOpen ? (
        <PosPanel
          title="Create a new list"
          description="List types stay fixed. Titles help staff distinguish between service queues."
          tone="soft"
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rs-select max-w-[220px]"
              value={addType}
              onChange={(e) => setAddType(e.target.value as ListType)}
            >
              {LIST_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <input
              className="rs-input w-full max-w-[360px]"
              placeholder='List name (e.g. "VIP Names" or "Tables - Inside")'
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
            />

            <Button onClick={handleAdd} disabled={!addTitle.trim()}>
              Add
            </Button>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
          </div>

          <div className="mt-3 text-xs text-[var(--muted-foreground)]">
            Types are fixed. Titles are fully yours, so you can create multiple
            queues for different service scenarios.
          </div>
        </PosPanel>
      ) : null}

      <div className="space-y-3">
        {rows.length === 0 ? (
          <EmptyState
            title="No lists yet"
            description='Click "+ Add List" to create the first table or guest queue.'
          />
        ) : (
          rows.map((row) => (
            <PosPanel
              key={row.id}
              className="overflow-hidden"
              contentClassName="p-0"
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 lg:px-6">
                <label className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!selected[row.id]}
                    onChange={() => toggleSelect(row.id)}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-[var(--foreground)]">
                      {row.title}
                    </div>
                    <div className="mt-2">
                      <PosStatusPill tone="accent">{row.type}</PosStatusPill>
                    </div>
                  </div>
                </label>

                <Button
                  variant="secondary"
                  onClick={() =>
                    setOpenList({
                      listId: row.id,
                      title: row.title,
                      listType: row.type,
                    })
                  }
                >
                  Open
                </Button>
              </div>
            </PosPanel>
          ))
        )}
      </div>
    </div>
  );
}
