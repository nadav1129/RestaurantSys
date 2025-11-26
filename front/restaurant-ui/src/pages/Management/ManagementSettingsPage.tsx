import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api/api";

type Menu = { menuNum: number; name: string };

type ManagementSettingsDto = {
  activeMenuNum: number | null;
  globalDiscountPct: number; // decimal on the server; fine to treat as number here
};

export default function ManagementSettingsPage() {
  // data
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<number | null>(null);
  const [discountPct, setDiscountPct] = useState<number>(0);

  // ui state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = useMemo(() => !loading && !saving, [loading, saving]); // used to enable Save when not busy

  // initial load: menus + settings
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [menusResp, settingsResp] = await Promise.all([
          apiFetch("/api/menus"),      // -> [{ menuNum, name }]
          apiFetch("/api/settings"),   // -> { activeMenuNum, globalDiscountPct }
        ]);

        if (!cancelled) {
          const menusList = Array.isArray(menusResp) ? menusResp as Menu[] : [];
          setMenus(menusList);

          const s = settingsResp as ManagementSettingsDto | null;
          const active = s?.activeMenuNum ?? null;
          const pct = typeof s?.globalDiscountPct === "number" ? s!.globalDiscountPct : 0;

          setSelectedMenu(active ?? (menusList.length ? menusList[0].menuNum : null));
          setDiscountPct(pct);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        activeMenuNum: selectedMenu ?? null,
        globalDiscountPct: Number.isFinite(discountPct) ? discountPct : 0,
      };
      const updated = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // normalize returned values (trust server as source of truth)
      const u = updated as ManagementSettingsDto;
      setSelectedMenu(u.activeMenuNum ?? null);
      setDiscountPct(typeof u.globalDiscountPct === "number" ? u.globalDiscountPct : 0);
    } catch (e: any) {
      setError(e?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500">Settings</div>
          <div className="text-lg font-semibold text-gray-800">Menu</div>
        </div>

        <div className="p-4 grid gap-4 md:grid-cols-[1fr,1fr,auto]">
          {/* a) Active Menu dropdown */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Active menu</span>
            <select
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 disabled:opacity-50"
              value={selectedMenu ?? ""}
              disabled={loading || saving || menus.length === 0}
              onChange={(e) => setSelectedMenu(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="" disabled>
                {loading ? "Loading…" : "Select a menu…"}
              </option>
              {menus.map((m) => (
                <option key={m.menuNum} value={m.menuNum}>
                  #{m.menuNum} — {m.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">
              This menu will be used on the Order page by default.
            </span>
          </label>

          {/* b) Global Discount for selected menu */}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">
              Global discount (%)
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={Number.isFinite(discountPct) ? discountPct : 0}
              disabled={loading || saving}
              onChange={(e) => setDiscountPct(Number(e.target.value))}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 disabled:opacity-50"
              placeholder="e.g. 10"
            />
            <span className="text-xs text-gray-500">
              Applied across Order page pricing (you can refine per item later).
            </span>
          </label>

          {/* c) Actions */}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving || menus.length === 0}
              className="h-10 rounded-xl bg-gray-900 px-4 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>

            <button
              type="button"
              onClick={() => {
                window.alert(
                  "Hot fixes panel:\n\n• Exclude out-of-stock items\n• Add temporary event sections\n\n(Coming soon)"
                );
              }}
              className="h-10 rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 hover:bg-gray-100"
              disabled={saving}
            >
              Hot fixes
            </button>
          </div>
        </div>

        {(error || loading) && (
          <div className="px-4 pb-4">
            {loading && (
              <div className="text-xs text-gray-500">Loading menus and settings…</div>
            )}
            {error && (
              <div className="text-xs text-red-600">{error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
