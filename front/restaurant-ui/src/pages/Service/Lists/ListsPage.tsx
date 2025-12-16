import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/Button";
import { apiFetch } from "../../../api/api";
import ListDetailPanel from ".//ListDetailPage";

/* Fixed set of LIST TYPES */
export const LIST_TYPES = ["Tables", "Names"] as const;
export type ListType = (typeof LIST_TYPES)[number];

/* ===== Backend DTOs ===== */
type ListDto = {
  listId: string;
  title: string;
  listType: ListType; // "Tables" | "Names"
};

type CreateListRequest = {
  title: string;
  listType: ListType;
};

type ListEntryDto = {
  entryId: string;
  listId: string;

  name: string;
  phone: string;
  note: string;

  numPeople: number | null;
  startTime: string | null; // "HH:MM" or null
  endTime: string | null; // "HH:MM" or null
  minutes: number | null;
};

/* ===== Local UI types ===== */
type ListRow = {
  id: string;
  type: ListType /* "Tables" | "Names" */;
  title: string /* user-chosen list name */;
};

type OpenMap = Record<string, boolean>;
type SelectMap = Record<string, boolean>;

/* Entries shape for UI */
type BaseEntry = {
  id: string;
  name: string;
  phone: string;
  note: string;
};

type TableEntry = BaseEntry & {
  numPeople: number | null;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  minutes: number | null;
};

/* Per-list expanded card */
function ListCard({ row }: { row: ListRow }) {
  const isTables = row.type === "Tables";

  const [nameEntries, setNameEntries] = useState<BaseEntry[]>([]);
  const [tableEntries, setTableEntries] = useState<TableEntry[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleDumpList() {
    try {
      await apiFetch(`/api/lists/${row.id}/dump`, { method: "POST" });
      if (isTables) setTableEntries([]);
      else setNameEntries([]);
    } catch (err) {
      console.error("Dump list failed", err);
    }
  }

  async function handleRefreshList() {
    try {
      setLoading(true);
      const rows = (await apiFetch(`/api/lists/${row.id}/entries`, {
        method: "GET",
      })) as ListEntryDto[] | null;

      if (!rows) {
        setNameEntries([]);
        setTableEntries([]);
        return;
      }

      if (isTables) {
        const mapped: TableEntry[] = rows.map((e: ListEntryDto) => ({
          id: e.entryId,
          name: e.name,
          phone: e.phone,
          note: e.note,
          numPeople: e.numPeople,
          startTime: e.startTime ?? "",
          endTime: e.endTime ?? "",
          minutes: e.minutes,
        }));
        setTableEntries(mapped);
      } else {
        const mapped: BaseEntry[] = rows.map((e: ListEntryDto) => ({
          id: e.entryId,
          name: e.name,
          phone: e.phone,
          note: e.note,
        }));
        setNameEntries(mapped);
      }
    } catch (err) {
      console.error("Refresh list failed", err);
    } finally {
      setLoading(false);
    }
  }

  const hasEntries = isTables
    ? tableEntries.length > 0
    : nameEntries.length > 0;

  return (
    <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-700">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-gray-800">
            {row.type} list · {row.title}
          </div>
          <div className="text-xs text-gray-500">
            {isTables
              ? "Each row has: name, phone, note, #people, start time, end time, min."
              : "Each row has: name, phone, note."}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleDumpList}>
            Dump list
          </Button>
          <Button
            variant="secondary"
            onClick={handleRefreshList}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh list"}
          </Button>
        </div>
      </div>

      {/* Columns + entries */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Note</th>
              {isTables && (
                <>
                  <th className="px-3 py-2 font-medium"># People</th>
                  <th className="px-3 py-2 font-medium">Start</th>
                  <th className="px-3 py-2 font-medium">End</th>
                  <th className="px-3 py-2 font-medium">Min.</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {!hasEntries ? (
              <tr>
                <td
                  className="px-3 py-3 text-[11px] text-gray-500"
                  colSpan={isTables ? 7 : 3}
                >
                  No rows yet. Use “Refresh list” to load from backend.
                </td>
              </tr>
            ) : isTables ? (
              tableEntries.map((e: TableEntry) => (
                <tr key={e.id} className="border-t border-gray-100 text-[11px]">
                  <td className="px-3 py-2">{e.name}</td>
                  <td className="px-3 py-2">{e.phone}</td>
                  <td className="px-3 py-2">{e.note}</td>
                  <td className="px-3 py-2">{e.numPeople ?? ""}</td>
                  <td className="px-3 py-2">{e.startTime}</td>
                  <td className="px-3 py-2">{e.endTime}</td>
                  <td className="px-3 py-2">{e.minutes ?? ""}</td>
                </tr>
              ))
            ) : (
              nameEntries.map((e: BaseEntry) => (
                <tr key={e.id} className="border-t border-gray-100 text-[11px]">
                  <td className="px-3 py-2">{e.name}</td>
                  <td className="px-3 py-2">{e.phone}</td>
                  <td className="px-3 py-2">{e.note}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Use “Refresh list” to fetch current entries from the server.
      </div>
    </div>
  );
}

export default function ListsPage() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [open, setOpen] = useState<OpenMap>({});
  const [selected, setSelected] = useState<SelectMap>({});
  const [addOpen, setAddOpen] = useState(false);
  const [openList, setOpenList] = useState<ListDto | null>(null);

  /* Add form state */
  const [addType, setAddType] = useState<ListType>("Tables");
  const [addTitle, setAddTitle] = useState("");

  const anySelected = useMemo(
    () => rows.some((r) => selected[r.id]),
    [rows, selected]
  );

  const toggleOpen = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const toggleSelect = (id: string) =>
    setSelected((s) => ({ ...s, [id]: !s[id] }));

  /* Initial load: fetch all lists */
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
        const mapped: ListRow[] = lists.map((l: ListDto) => ({
          id: l.listId,
          type: l.listType,
          title: l.title,
        }));
        setRows(mapped);
      } catch (err) {
        console.error("Failed to load lists", err);
      }
    })();
  }, []);

  /* Add a new list */
  async function handleAdd() {
    const title = addTitle.trim();
    if (!title) return;

    try {
      const dto = (await apiFetch("/api/lists", {
        method: "POST",
        body: { title, listType: addType },
      })) as ListDto | null;

      if (!dto) return;

      const newRow: ListRow = {
        id: dto.listId,
        type: dto.listType,
        title: dto.title,
      };

      setRows((prev) => [newRow, ...prev]); // newest first
      setAddTitle("");
      setAddType("Tables");
      setAddOpen(false);
    } catch (err) {
      console.error("Failed to add list", err);
    }
  }

  /* Delete selected lists */
  async function handleDeleteSelected() {
    const toDelete = rows.filter((r) => selected[r.id]);

    try {
      await Promise.all(
        toDelete.map((r) =>
          apiFetch(`/api/lists/${r.id}`, { method: "DELETE" })
        )
      );

      const keep = rows.filter((r) => !selected[r.id]);
      setRows(keep);
      setSelected({});
      setOpen((o) => {
        const copy: OpenMap = {};
        for (const r of keep) copy[r.id] = !!o[r.id];
        return copy;
      });
    } catch (err) {
      console.error("Failed to delete selected lists", err);
    }
  }

  if (openList) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-4">
        <ListDetailPanel list={openList} onClose={() => setOpenList(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-4">
      {/* Header */}
      <div className="mb-4">
        <div className="text-xs font-medium text-gray-500">Management</div>
        <div className="text-lg font-semibold text-gray-800">Lists</div>
      </div>

      {/* Top actions */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => setAddOpen((v) => !v)}>+ Add List</Button>
        <Button
          variant="secondary"
          onClick={handleDeleteSelected}
          disabled={!anySelected}
        >
          Delete Selected
        </Button>
      </div>

      {/* Add panel */}
      {addOpen && (
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-2 text-sm font-medium">Create a new list</div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              value={addType}
              onChange={(e) => setAddType(e.target.value as ListType)}
            >
              {LIST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <input
              className="w-56 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              placeholder='List name (e.g., "VIP Names", "Tables - Inside")'
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

          <div className="mt-2 text-xs text-gray-500">
            Types are fixed (Tables / Names); titles are yours so you can create
            multiple lists of each type.
          </div>
        </div>
      )}

      {/* List of lists */}
      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
            No lists yet. Click <span className="font-medium">+ Add List</span>{" "}
            to start.
          </div>
        ) : (
          rows.map((row) => {
            return (
              <div
                key={row.id}
                className="rounded-2xl border border-gray-200 bg-white"
              >
                {/* Row header */}
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <label className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!selected[row.id]}
                      onChange={() => toggleSelect(row.id)}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {row.title}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {row.type}
                      </div>
                    </div>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setOpenList({
                          listId: row.id,
                          title: row.title,
                          listType: row.type,
                        })
                      }
                      className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
