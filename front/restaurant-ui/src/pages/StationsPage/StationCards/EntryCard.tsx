import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../api/api";
import Button from "../../../components/Button";

/* For Hostes & selector stations. Tabs live here. */
const TABS = ["Lists", "Functionality"] as const;

type ListType = "Tables" | "Names";

type ListDto = {
  listId: string;
  title: string;
  listType: ListType;
};

export default function EntryCard({
  stationId,
  stationName,
  stationType,
}: {
  stationId: string;                       /* ← add this */
  stationName: string;
  stationType: "Hostes" | "selector";
}) {
  const [active, setActive] = useState<number>(0);

  /* Lists data */
  const [allLists, setAllLists] = useState<ListDto[]>([]);
  const [attached, setAttached] = useState<ListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [modBusy, setModBusy] = useState<Record<string, boolean>>({}); // per-list busy state

  const attachedIds = useMemo(
    () => new Set(attached.map((l) => l.listId)),
    [attached]
  );

  /* Load all lists + attached lists */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [all, mine] = await Promise.all([
          apiFetch("/api/lists", { method: "GET" }) as Promise<ListDto[] | null>,
          apiFetch(`/api/stations/${stationId}/lists`, {
            method: "GET",
          }) as Promise<ListDto[] | null>,
        ]);
        setAllLists(all ?? []);
        setAttached(mine ?? []);
      } catch (err) {
        console.error("Failed to load lists for station", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [stationId]);

  async function handleAttach(list: ListDto) {
    try {
      setModBusy((m) => ({ ...m, [list.listId]: true }));
      await apiFetch(`/api/stations/${stationId}/lists`, {
        method: "POST",
        body: { listId: list.listId },
      });
      setAttached((prev) =>
        prev.some((x) => x.listId === list.listId) ? prev : [list, ...prev]
      );
    } catch (err) {
      console.error("Attach list failed", err);
    } finally {
      setModBusy((m) => ({ ...m, [list.listId]: false }));
    }
  }

  async function handleDetach(list: ListDto) {
    try {
      setModBusy((m) => ({ ...m, [list.listId]: true }));
      await apiFetch(`/api/stations/${stationId}/lists/${list.listId}`, {
        method: "DELETE",
      });
      setAttached((prev) => prev.filter((x) => x.listId !== list.listId));
    } catch (err) {
      console.error("Detach list failed", err);
    } finally {
      setModBusy((m) => ({ ...m, [list.listId]: false }));
    }
  }

  function renderListsTab() {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {/* Column: All Lists */}
        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
            <div>
              <div className="text-xs font-medium text-gray-500">All</div>
              <div className="text-sm font-semibold text-gray-800">
                Lists Library
              </div>
            </div>
            {loading && (
              <div className="text-xs text-gray-500">Loading…</div>
            )}
          </div>

          {allLists.length === 0 ? (
            <div className="px-4 py-6 text-xs text-gray-500">
              No lists yet. Create them in the Lists page.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {allLists.map((l) => {
                const isAttached = attachedIds.has(l.listId);
                const busy = !!modBusy[l.listId];

                return (
                  <li key={l.listId} className="flex items-center gap-3 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-800">
                        {l.title}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {l.listType}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isAttached ? (
                        <button
                          disabled
                          className="rounded-lg border border-gray-300 bg-gray-50 px-2 py-1 text-[11px] text-gray-500"
                        >
                          Attached
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAttach(l)}
                          disabled={busy}
                          className="rounded-lg border border-blue-300 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                        >
                          {busy ? "Attaching…" : "Attach"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Column: Attached to this station */}
        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
            <div>
              <div className="text-xs font-medium text-gray-500">This station</div>
              <div className="text-sm font-semibold text-gray-800">
                Attached Lists
              </div>
            </div>
          </div>

          {attached.length === 0 ? (
            <div className="px-4 py-6 text-xs text-gray-500">
              No lists attached yet.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {attached.map((l) => {
                const busy = !!modBusy[l.listId];
                return (
                  <li key={l.listId} className="flex items-center gap-3 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-800">
                        {l.title}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {l.listType}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDetach(l)}
                      disabled={busy}
                      className="rounded-lg border border-red-300 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      {busy ? "Removing…" : "Remove"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  function renderTabBody() {
    const tab = TABS[active];
    if (tab === "Lists") return renderListsTab();
    return (
      <div className="text-xs text-gray-500">
        Placeholder for Entry editor ({stationType}). We’ll implement this tab next.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">
        {stationType} · {stationName}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setActive(i)}
            className={[
              "rounded-xl px-3 py-1.5 text-sm border",
              i === active
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
        <div className="mb-1 font-medium">{TABS[active]}</div>
        {renderTabBody()}
      </div>
    </div>
  );
}
