import { useEffect, useMemo, useState } from "react";
import Button from "../../components/Button";
import { apiFetch } from "../../api/api";
import ListDetailPanel from "./Lists/ListDetailPage";

type ListType = "Tables" | "Names";
type ListDto = { listId: string; title: string; listType: ListType };
type Tab = "tables" | "names";

type ManagementSettingsDto = {
  activeMenuNum: number | null;
  globalDiscountPct: number;
  currentGuestCount: number;
};

export default function HostessPage({ stationId }: { stationId?: string }) {
  const [tab, setTab] = useState<Tab>("tables");
  const [lists, setLists] = useState<ListDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [openList, setOpenList] = useState<ListDto | null>(null);

  const [settings, setSettings] = useState<ManagementSettingsDto | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setSettingsLoading(true);
        setSettingsError(null);

        const data = (await apiFetch("/api/settings")) as ManagementSettingsDto | null;
        if (alive) {
          setSettings(
            data ?? {
              activeMenuNum: null,
              globalDiscountPct: 0,
              currentGuestCount: 0,
            }
          );
        }
      } catch (err) {
        console.error("Failed to load guest count", err);
        if (alive) setSettingsError("Failed to load guest count.");
      } finally {
        if (alive) setSettingsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        if (!stationId) {
          if (alive) setLists([]);
          return;
        }

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

  async function updateGuestCount(nextCount: number) {
    if (!settings || settingsSaving) return;

    const safeCount = Math.max(0, nextCount);
    const previous = settings;

    setSettings({
      ...settings,
      currentGuestCount: safeCount,
    });
    setSettingsSaving(true);
    setSettingsError(null);

    try {
      const updated = (await apiFetch("/api/settings", {
        method: "PUT",
        body: {
          activeMenuNum: previous.activeMenuNum,
          globalDiscountPct: previous.globalDiscountPct,
          currentGuestCount: safeCount,
        },
      })) as ManagementSettingsDto;

      setSettings(updated);
    } catch (err) {
      console.error("Failed to save guest count", err);
      setSettings(previous);
      setSettingsError("Failed to save guest count.");
    } finally {
      setSettingsSaving(false);
    }
  }

  const guestCount = settings?.currentGuestCount ?? 0;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            In House
          </div>
          <div className="mt-1 text-3xl font-semibold text-gray-900">
            {settingsLoading ? "--" : guestCount}
          </div>
          {settingsError ? (
            <div className="mt-2 text-xs text-red-600">{settingsError}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => void updateGuestCount(guestCount - 1)}
            disabled={settingsLoading || settingsSaving || guestCount <= 0}
          >
            -1
          </Button>
          <Button
            onClick={() => void updateGuestCount(guestCount + 1)}
            disabled={settingsLoading || settingsSaving}
          >
            +1
          </Button>
          <Button
            variant="ghost"
            onClick={() => void updateGuestCount(0)}
            disabled={settingsLoading || settingsSaving || guestCount === 0}
          >
            Reset
          </Button>
        </div>
      </div>

      {!stationId ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          Choose a station to see its lists.
        </div>
      ) : openList ? (
        <ListDetailPanel list={openList} onClose={() => setOpenList(null)} />
      ) : (
        <>
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
              <div className="text-sm text-gray-600">Loading...</div>
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
        </>
      )}
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
