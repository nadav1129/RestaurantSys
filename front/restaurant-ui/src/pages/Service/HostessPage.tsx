// File: src/pages/HostessPage.tsx
import { useEffect, useMemo, useState } from "react";
import Button from "../../components/Button";
import { apiFetch } from "../../api/api";
import ListDetailPanel from "./Lists/ListDetailPage";

type ListType = "Tables" | "Names";
type ListDto = { listId: string; title: string; listType: ListType };
type Tab = "tables" | "names";

export default function HostessPage({ stationId }: { stationId?: string }) {
  const [tab, setTab] = useState<Tab>("tables");
  const [lists, setLists] = useState<ListDto[]>([]);
  const [loading, setLoading] = useState(false);

  const [openList, setOpenList] = useState<ListDto | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        if (!stationId) {
          if (alive) setLists([]);
          return;
        }
        // backend route that returns only lists attached to this station
        const data = (await apiFetch(`/api/stations/${stationId}/lists`)) as
          | ListDto[]
          | null;
        if (alive) setLists(data ?? []);
      } catch (err) {
        console.error("Failed to load lists", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [stationId]);

  const tablesLists = useMemo(
    () => lists.filter((l) => l.listType === "Tables"),
    [lists]
  );
  const namesLists = useMemo(
    () => lists.filter((l) => l.listType === "Names"),
    [lists]
  );

  function applyListMeta(updated: ListDto) {
    setLists((prev) =>
      prev.map((x) => (x.listId === updated.listId ? updated : x))
    );
    setOpenList(updated);
  }

  if (!stationId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        Choose a station to see its lists.
      </div>
    );
  }

  if (openList) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-4">
        <ListDetailPanel list={openList} onClose={() => setOpenList(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <Button
          variant={tab === "tables" ? "primary" : "secondary"}
          onClick={() => setTab("tables")}
        >
          Tables Lists
        </Button>
        <Button
          variant={tab === "names" ? "primary" : "secondary"}
          onClick={() => setTab("names")}
        >
          Names Lists
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : tab === "tables" ? (
          <ListsGrid
            lists={tablesLists}
            emptyText="No Tables lists yet."
            onOpen={setOpenList}
          />
        ) : (
          <ListsGrid
            lists={namesLists}
            emptyText="No Names lists yet."
            onOpen={setOpenList}
          />
        )}
      </div>
    </div>
  );
}

function ListsGrid({
  lists,
  emptyText,
  onOpen,
}: {
  lists: ListDto[];
  emptyText: string;
  onOpen: (l: ListDto) => void;
}) {
  if (lists.length === 0) {
    return <div className="text-sm text-gray-600">{emptyText}</div>;
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {lists.map((l) => (
        <li key={l.listId} className="rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-800">
                {l.title}
              </div>
              <div className="truncate text-xs text-gray-500">{l.listType}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onOpen(l)}>
                Open
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
