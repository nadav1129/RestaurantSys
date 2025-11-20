import React, { useEffect, useState } from "react";
import { apiFetch } from "../../../api/api"; // adjust path if needed

/* For Bar & Floor stations. Tabs live here, not in the page. */
const TABS = ["Map", "Inventory", "Printers"] as const;

type TableEntry = {
  id: string;       // backend table_id
  tableNum: number; // visible table number
};

export default function ServerCard({
  stationId,
  stationName,
  stationType,
}: {
  stationId: string;
  stationName: string;
  stationType: "Bar" | "Floor";
}) {
  const [active, setActive] = useState<number>(0);

  /* Map tab state */
  const [tables, setTables] = useState<TableEntry[]>([]);
  const [newTableNum, setNewTableNum] = useState<string>("");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Load tables for this station from backend */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const data = (await apiFetch(
          `/api/stations/${stationId}/tables`,
          { method: "GET" }
        )) as { tableId: string; tableNum: number }[] | null;

        if (!cancelled) {
          const mapped =
            data?.map((t) => ({
              id: t.tableId,
              tableNum: t.tableNum,
            })) ?? [];
          setTables(mapped);
          setSelectedTableId(null);
        }
      } catch (e) {
        console.error("Failed to load tables", e);
        if (!cancelled) setError("Failed to load tables.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stationId]);

  async function handleAddTable() {
    const parsed = parseInt(newTableNum, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      alert("Please enter a valid positive table number.");
      return;
    }

    /* Prevent duplicate table numbers locally (per station) */
    if (tables.some((t) => t.tableNum === parsed)) {
      alert("A table with that number already exists for this station.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const dto = (await apiFetch(
        `/api/stations/${stationId}/tables`,
        {
          method: "POST",
          body: JSON.stringify({ tableNum: parsed }),
        }
      )) as { tableId: string; tableNum: number } | null;

      if (!dto) {
        alert("Failed to create table.");
        return;
      }

      setTables((prev) => [
        ...prev,
        { id: dto.tableId, tableNum: dto.tableNum },
      ]);
      setNewTableNum("");
    } catch (e) {
      console.error("Failed to add table", e);
      setError("Failed to add table.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveSelected() {
    if (!selectedTableId) {
      alert("Please select a table to remove.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await apiFetch(
        `/api/stations/${stationId}/tables/${selectedTableId}`,
        { method: "DELETE" }
      );

      setTables((prev) => prev.filter((t) => t.id !== selectedTableId));
      setSelectedTableId(null);
    } catch (e) {
      console.error("Failed to remove table", e);
      setError("Failed to remove table.");
    } finally {
      setLoading(false);
    }
  }

  function handleEditTableNum(id: string) {
    const table = tables.find((t) => t.id === id);
    if (!table) return;

    const input = window.prompt("New table number:", String(table.tableNum));
    if (input == null) return; // cancelled

    const parsed = parseInt(input, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      alert("Please enter a valid positive table number.");
      return;
    }

    /* Prevent duplicate table numbers (client-side) */
    if (tables.some((t) => t.id !== id && t.tableNum === parsed)) {
      alert("A table with that number already exists.");
      return;
    }

    // NOTE: right now this is only local. If you want to persist this,
    // we can add PATCH /api/tables/{tableId} later.
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, tableNum: parsed } : t))
    );
  }

  function handleLocationClick(id: string) {
    const table = tables.find((t) => t.id === id);
    if (!table) return;

    /* Stub for later – we will hook this to the visual map/location picker */
    console.log("Location button clicked for table:", table.tableNum, {
      stationId,
      stationName,
      stationType,
      tableId: id,
    });
    alert(
      `Location for table ${table.tableNum} (id: ${id}) will be configured later.`
    );
  }

  function renderMapTab() {
    return (
      <div className="space-y-4 text-sm text-gray-700">
        {/* Controls: Add / Remove */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 mb-1">
              Table number
            </label>
            <input
              type="number"
              min={1}
              value={newTableNum}
              onChange={(e) => setNewTableNum(e.target.value)}
              className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/40"
              placeholder="e.g. 12"
            />
          </div>
          <button
            type="button"
            onClick={handleAddTable}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black"
            disabled={loading}
          >
            + Add table
          </button>
          <button
            type="button"
            onClick={handleRemoveSelected}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            disabled={loading}
          >
            Remove selected
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-600">
            {error}
          </div>
        )}

        {/* List of tables */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {loading ? "Tables (loading…)" : "Tables"}
          </div>

          {tables.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-500">
              No tables yet. Add a table using the field above.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {tables
                .slice()
                .sort((a, b) => a.tableNum - b.tableNum)
                .map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                  >
                    <input
                      type="radio"
                      name={`table-select-${stationId}`}
                      checked={selectedTableId === t.id}
                      onChange={() => setSelectedTableId(t.id)}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">
                        Table {t.tableNum}
                      </div>
                      <div className="text-xs text-gray-500">
                        Table id: {t.id}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditTableNum(t.id)}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLocationClick(t.id)}
                        className="rounded-lg border border-blue-300 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Location
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  function renderTabContent() {
    const tab = TABS[active];
    if (tab === "Map") {
      return renderMapTab();
    }

    // Placeholders for other tabs for now
    return (
      <div className="text-xs text-gray-500">
        Placeholder for {tab} editor ({stationType}). We’ll implement this tab
        later.
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
        <div className="mb-2 font-medium">{TABS[active]}</div>
        {renderTabContent()}
      </div>
    </div>
  );
}
