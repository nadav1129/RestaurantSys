import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/Button";
import { apiFetch } from "../../../api/api";

type ListType = "Tables" | "Names";

type ListDto = {
  listId: string;
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
  startTime: string | null;
  endTime: string | null;
  minimum: number | null;
  arrived?: boolean | null;

  // Optional linking to station/table (new)
  stationId?: string | null;
  stationName?: string | null;
  tableId?: string | null;
  tableLabel?: string | null;
};

type RowSel = Record<string, boolean>;

// These are *frontend* types; adjust field names to match your backend DTOs if needed.
type StationDto = {
  stationId: string;
  stationName: string;
  stationType: string;
};

type TableEntry = {
  id: string;       // backend table_id
  tableNum: number; // visible table number
};


export default function ListDetailPanel({
  list,
  onClose,
}: {
  list: ListDto;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ListEntryDto[]>([]);
  const [selected, setSelected] = useState<RowSel>({});
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");

  // Add form
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  const isTables = list.listType === "Tables";
  const [numPeople, setNumPeople] = useState<number | "">("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [minimum, setMinimum] = useState<number | "">("");

  const anySelected = useMemo(
    () => rows.some((r) => selected[r.entryId]),
    [rows, selected]
  );

  // Connect-to-table modal state
  const [linkEntry, setLinkEntry] = useState<ListEntryDto | null>(null);
  const [linkStations, setLinkStations] = useState<StationDto[]>([]);
  const [linkTables, setLinkTables] = useState<TableEntry[]>([]);
  const [linkStationId, setLinkStationId] = useState<string>("");
  const [linkTableId, setLinkTableId] = useState<string>("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Load entries
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const entries = (await apiFetch(`/api/lists/${list.listId}/entries`, {
          method: "GET",
        })) as ListEntryDto[] | null;
        setRows(entries ?? []);
      } catch (e) {
        console.error("Load list entries failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [list.listId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.phone, r.note].some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }, [rows, search]);

  function resetAddForm() {
    setName("");
    setPhone("");
    setNote("");
    setNumPeople("");
    setStartTime("");
    setEndTime("");
    setMinimum("");
  }

  async function handleAdd() {
    try {
      const payload: any = { name, phone, note };
      if (isTables) {
        payload.numPeople = numPeople === "" ? null : Number(numPeople);
        payload.startTime = startTime || null;
        payload.endTime = endTime || null;
        payload.minimum = minimum === "" ? null : Number(minimum);
      }
      const dto = (await apiFetch(`/api/lists/${list.listId}/entries`, {
        method: "POST",
        body: JSON.stringify(payload),
      })) as ListEntryDto | null;

      if (dto) setRows((prev) => [dto, ...prev]);
      setAddOpen(false);
      resetAddForm();
    } catch (e) {
      console.error("Add entry failed", e);
    }
  }

  async function handleDeleteSelected() {
    const toDel = rows.filter((r) => selected[r.entryId]);
    try {
      await Promise.all(
        toDel.map((r) =>
          apiFetch(`/api/lists/${list.listId}/entries/${r.entryId}`, {
            method: "DELETE",
          })
        )
      );
      setRows((prev) => prev.filter((r) => !selected[r.entryId]));
      setSelected({});
    } catch (e) {
      console.error("Delete entries failed", e);
    }
  }

  async function handleToggleArrived(r: ListEntryDto) {
    try {
      const next = !r.arrived;
      const updated = (await apiFetch(
        `/api/lists/${list.listId}/entries/${r.entryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ arrived: next }),
        }
      )) as ListEntryDto | null;

      if (!updated) return;
      setRows((prev) => prev.map((x) => (x.entryId === r.entryId ? updated : x)));
    } catch (e) {
      console.error("Toggle arrived failed", e);
    }
  }

  // ---------- Connect to table logic ----------

  async function loadStations() {
    try {
      setLinkLoading(true);
      setLinkError(null);
      const stations = (await apiFetch("/api/stations", {
        method: "GET",
      })) as StationDto[] | null;
      setLinkStations(stations ?? []);
    } catch (e) {
      console.error("Load stations failed", e);
      setLinkError("Failed to load stations.");
    } finally {
      setLinkLoading(false);
    }
  }

  async function loadTablesForStation(stationId: string) {
  if (!stationId) {
    setLinkTables([]);
    return;
  }
  try {
    setLinkLoading(true);
    setLinkError(null);

    const data = (await apiFetch(`/api/stations/${stationId}/tables`, {
      method: "GET",
    })) as { tableId: string; tableNum: number }[] | null;

    const mapped: TableEntry[] =
      data?.map((t) => ({
        id: t.tableId,
        tableNum: t.tableNum,
      })) ?? [];

    setLinkTables(mapped);
  } catch (e) {
    console.error("Load tables failed", e);
    setLinkError("Failed to load tables for this station.");
  } finally {
    setLinkLoading(false);
  }
}


  function openConnectToTable(r: ListEntryDto) {
    setLinkEntry(r);
    setLinkStations([]);
    setLinkTables([]);
    setLinkStationId("");
    setLinkTableId("");
    setLinkError(null);
    void loadStations();
  }

  function closeConnectModal() {
    setLinkEntry(null);
    setLinkStations([]);
    setLinkTables([]);
    setLinkStationId("");
    setLinkTableId("");
    setLinkError(null);
    setLinkLoading(false);
  }

  async function handleStationChange(stationId: string) {
    setLinkStationId(stationId);
    setLinkTableId("");
    setLinkTables([]);
    if (!stationId) return;
    await loadTablesForStation(stationId);
  }

  async function handleConfirmLink() {
    if (!linkEntry || !linkStationId || !linkTableId) return;
    try {
      setLinkLoading(true);
      setLinkError(null);

      const updated = (await apiFetch(
        `/api/lists/${list.listId}/entries/${linkEntry.entryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            stationId: linkStationId,
            tableId: linkTableId,
          }),
        }
      )) as ListEntryDto | null;

      if (updated) {
        setRows((prev) => prev.map((r) => (r.entryId === updated.entryId ? updated : r)));
      }

      closeConnectModal();
    } catch (e) {
      console.error("Link to table failed", e);
      setLinkError("Failed to connect to table.");
      setLinkLoading(false);
    }
  }

  // ---------- Render ----------

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onClose}>
            ← Back
          </Button>
          <div className="text-lg font-semibold text-gray-800">
            {list.listType} · {list.title}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            className="w-64 rounded-xl border border-gray-300 px-3 py-2 text-sm"
            placeholder="Search by name/phone/note…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button onClick={() => setAddOpen(true)}>+ Add</Button>
          <Button
            variant="secondary"
            onClick={handleDeleteSelected}
            disabled={!anySelected}
          >
            Delete Sel
          </Button>
        </div>
      </div>

      {/* Add panel */}
      {addOpen && (
        <div className="mb-3 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-2 text-sm font-medium">Add entry</div>
          <div className="grid gap-2 md:grid-cols-3">
            <input
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm md:col-span-1"
              placeholder="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            {isTables && (
              <>
                <input
                  type="number"
                  min={0}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  placeholder="# People"
                  value={numPeople}
                  onChange={(e) =>
                    setNumPeople(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
                <input
                  type="time"
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <input
                  type="time"
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
                <input
                  type="number"
                  min={0}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Minimum"
                  value={minimum}
                  onChange={(e) =>
                    setMinimum(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </>
            )}
          </div>

          <div className="mt-2 flex gap-2">
            <Button onClick={handleAdd}>Add</Button>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Entries table */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Entries
        </div>

        {loading ? (
          <div className="p-4 text-sm text-gray-600">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={
                        filtered.length > 0 &&
                        filtered.every((r) => selected[r.entryId])
                      }
                      onChange={(e) => {
                        const on = e.target.checked;
                        const next: RowSel = { ...selected };
                        for (const r of filtered) next[r.entryId] = on;
                        setSelected(next);
                      }}
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">Arrived</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  {isTables && (
                    <>
                      <th className="px-3 py-2 font-medium"># People</th>
                      <th className="px-3 py-2 font-medium">Start</th>
                      <th className="px-3 py-2 font-medium">End</th>
                      <th className="px-3 py-2 font-medium">Min.</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-4 text-[11px] text-gray-500"
                      colSpan={isTables ? 10 : 6}
                    >
                      No entries match your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.entryId} className="border-t border-gray-100 text-[11px]">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!selected[r.entryId]}
                          onChange={(e) =>
                            setSelected((s) => ({
                              ...s,
                              [r.entryId]: e.target.checked,
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={!!r.arrived}
                            onChange={() => handleToggleArrived(r)}
                          />
                          <span>{r.arrived ? "Yes" : "No"}</span>
                        </label>
                      </td>
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2">{r.phone}</td>
                      <td className="px-3 py-2">
                        <div className="max-w-[220px] truncate" title={r.note}>
                          {r.note}
                        </div>
                        {/* Optional small status line if already linked */}
                        {(r.tableLabel || r.tableId) && (
                          <div className="mt-1 text-[10px] text-green-700">
                            Linked to {r.tableLabel ?? r.tableId}
                          </div>
                        )}
                      </td>

                      {isTables && (
                        <>
                          <td className="px-3 py-2">{r.numPeople ?? ""}</td>
                          <td className="px-3 py-2">{r.startTime ?? ""}</td>
                          <td className="px-3 py-2">{r.endTime ?? ""}</td>
                          <td className="px-3 py-2">{r.minimum ?? ""}</td>
                          <td className="px-3 py-2">
                            <Button
                              variant="secondary"
                              onClick={() => openConnectToTable(r)}
                            >
                              Connect to table
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Connect to table modal */}
      {linkEntry && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-lg">
            <div className="mb-2 text-sm font-semibold text-gray-800">
              Connect to table
            </div>
            <div className="mb-3 text-xs text-gray-600">
              {linkEntry.name} — {linkEntry.phone}
              {linkEntry.note && (
                <span className="block text-[11px] text-gray-500">
                  {linkEntry.note}
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium text-gray-700">
                  Station
                </div>
                <select
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  value={linkStationId}
                  onChange={(e) => void handleStationChange(e.target.value)}
                >
                  <option value="">Select station…</option>
                  {linkStations.map((s) => (
                    <option key={s.stationId} value={s.stationId}>
                      {s.stationName} ({s.stationType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-gray-700">
                  Table
                </div>
                <select
  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
  value={linkTableId}
  onChange={(e) => setLinkTableId(e.target.value)}
  disabled={!linkStationId || linkTables.length === 0}
>
  <option value="">
    {linkStationId ? "Select table…" : "Choose station first…"}
  </option>
  {linkTables.map((t) => (
    <option key={t.id} value={t.id}>
      {t.tableNum}
    </option>
  ))}
</select>
              </div>

              {linkError && (
                <div className="text-xs text-red-600">{linkError}</div>
              )}

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeConnectModal}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-800 hover:bg-gray-100"
                  disabled={linkLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLink}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-black disabled:opacity-60"
                  disabled={
                    linkLoading || !linkStationId || !linkTableId
                  }
                >
                  {linkLoading ? "Linking…" : "Link to table"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
