import { useEffect, useMemo, useState } from "react";
import Button from "../../components/Button";
import ServerCard from "./StationCards/ServerCard";
import EntryCard from "./StationCards/EntryCard";
import CheckerCard from "./StationCards/CheckerCard";
import { apiFetch } from "../../api/api";
import { STATION_TYPES, type StationType, type Station } from "../../types/index";
import { EmptyState, PageHeader } from "../../components/ui/layout";
import { PosActionStrip, PosPanel, PosStatusPill } from "../../components/ui/pos";


type StationRow = {
  /* we use the backend stationId as our id */
  id: string;
  type: StationType; /* e.g., "Bar" */
  name: string;      /* e.g., "Bar #1 / Front" */
};


type OpenMap = Record<string, boolean>;
type SelectMap = Record<string, boolean>;

/* Choose which card to render per station TYPE */
/* Choose which card to render per station TYPE */
function StationCardRouter({ row }: { row: StationRow }) {
  const t = row.type;
  if (t === "Bar" || t === "Floor") {
    return (
      <ServerCard
        stationId={row.id}
        stationName={row.name}
        stationType={row.type as "Bar" | "Floor"}
      />
    );
  }
  if (t === "Hostes" || t === "selector") {
    return (
      <EntryCard
        stationId={row.id}
        stationName={row.name}
        stationType={row.type as "Hostes" | "selector"}
      />
    );
  }

  if (t === "Checker") {
    return <CheckerCard stationId={row.id} stationName={row.name} />;
  }

  // Placeholder for types not yet implemented
  return (
    <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
      <div className="mb-1 font-medium">
        {row.type} - {row.name}
      </div>
      <div className="text-xs text-gray-500">
        Editor not implemented yet for this station type.
      </div>
    </div>
  );
}


export default function StationsPage() {
  const [rows, setRows] = useState<StationRow[]>([]);
  const [open, setOpen] = useState<OpenMap>({});
  const [selected, setSelected] = useState<SelectMap>({});
  const [addOpen, setAddOpen] = useState(false);

  /* Add form state */
  const [addType, setAddType] = useState<StationType>("Bar");
  const [addName, setAddName] = useState("");

  const anySelected = useMemo(
    () => rows.some((r) => selected[r.id]),
    [rows, selected]
  );

  /* Load existing stations on mount */
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch("/api/stations");
        if (!Array.isArray(data)) return;

        const mapped: StationRow[] = data.map((dto: Station) => ({
          id: dto.stationId,
          type: dto.stationType as StationType,
          name: dto.stationName,
        }));

        setRows(mapped);
      } catch (err) {
        console.error("Failed to load stations", err);
      }
    })();
  }, []);

  const toggleOpen = (id: string) =>
    setOpen((o) => ({ ...o, [id]: !o[id] }));

  const toggleSelect = (id: string) =>
    setSelected((s) => ({ ...s, [id]: !s[id] }));

  async function handleAdd() {
    const name = addName.trim();
    if (!name) return;

    try {
      const dto = (await apiFetch("/api/stations", {
        method: "POST",
        body: {
          stationName: name,
          stationType: addType,
        },
      })) as Station | null;

      if (!dto) return;

      const newRow: StationRow = {
        id: dto.stationId,
        type: dto.stationType as StationType,
        name: dto.stationName,
      };

      setRows((prev) => [...prev, newRow]);
      setAddName("");
      setAddType("Bar");
      setAddOpen(false);
    } catch (err) {
      console.error("Failed to add station", err);
    }
  }

  async function handleDeleteSelected() {
    const toDelete = rows.filter((r) => selected[r.id]);
    if (toDelete.length === 0) return;

    try {
      // delete one by one; if any fails, we still try the rest
      for (const r of toDelete) {
        try {
          await apiFetch(`/api/stations/${r.id}`, {
            method: "DELETE",
          });
        } catch (err) {
          console.error("Failed to delete station", r.id, err);
        }
      }

      const keep = rows.filter((r) => !selected[r.id]);
      setRows(keep);
      setSelected({});
      setOpen((o) => {
        const copy: OpenMap = {};
        for (const r of keep) copy[r.id] = !!o[r.id];
        return copy;
      });
    } catch (err) {
      console.error("Delete selected stations failed", err);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management"
        title="Stations"
        description="Configure station workspaces without changing the existing station logic."
      />

      <PosActionStrip>
        <Button onClick={() => setAddOpen((v) => !v)}>+ Add Station</Button>
        <Button
          variant="secondary"
          onClick={handleDeleteSelected}
          disabled={!anySelected}
        >
          Delete Selected
        </Button>
      </PosActionStrip>

      {addOpen && (
        <PosPanel
          title="Create a new station"
          description="Station types stay fixed; you control the station names and layout structure."
          tone="soft"
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rs-select max-w-[220px]"
              value={addType}
              onChange={(e) => setAddType(e.target.value as StationType)}
            >
              {STATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <input
              className="rs-input w-full max-w-[320px]"
              placeholder="Station name (e.g. Bar #1 / Front)"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
            />

            <Button onClick={handleAdd} disabled={!addName.trim()}>
              Add
            </Button>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
          </div>

          <div className="mt-2 text-xs text-gray-500">
            Types are fixed; names are yours so you can create multiple "Bar",
            "Floor", etc.
          </div>
        </PosPanel>
      )}

      <div className="space-y-3">
        {rows.length === 0 ? (
          <EmptyState
            title="No stations yet"
            description='Click "+ Add Station" to create your first station workspace.'
          />
        ) : (
          rows.map((row) => {
            const isOpen = !!open[row.id];
            return (
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
                      <div className="truncate text-base font-semibold">
                        {row.name}
                      </div>
                      <div className="mt-2">
                        <PosStatusPill tone="accent">{row.type}</PosStatusPill>
                      </div>
                    </div>
                  </label>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => toggleOpen(row.id)}
                    >
                      {isOpen ? "Collapse" : "Expand"}
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[var(--border)] px-5 py-5 lg:px-6">
                    <StationCardRouter row={row} />
                  </div>
                )}
              </PosPanel>
            );
          })
        )}
      </div>
    </div>
  );
}

