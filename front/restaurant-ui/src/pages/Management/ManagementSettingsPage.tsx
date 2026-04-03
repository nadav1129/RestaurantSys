import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api/api";
import Button from "../../components/Button";
import { MenuIcon, SettingsIcon } from "../../components/icons";
import { SectionCard, StatCard } from "../../components/ui/layout";

type Menu = { menuNum: number; name: string };

type ManagementSettingsDto = {
  activeMenuNum: number | null;
  globalDiscountPct: number;
};

export default function ManagementSettingsPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<number | null>(null);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => !loading && !saving, [loading, saving]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [menusResp, settingsResp] = await Promise.all([
          apiFetch("/api/menus"),
          apiFetch("/api/settings"),
        ]);

        if (!cancelled) {
          const menusListRaw = Array.isArray(menusResp) ? (menusResp as Menu[]) : [];
          const menusList = menusListRaw.filter((m) => m.menuNum > 0);
          setMenus(menusList);

          const s = settingsResp as ManagementSettingsDto | null;
          const active = s?.activeMenuNum ?? null;
          const pct =
            typeof s?.globalDiscountPct === "number" ? s.globalDiscountPct : 0;

          setSelectedMenu(
            active != null && active > 0
              ? active
              : menusList.length
                ? menusList[0].menuNum
                : null
          );
          setDiscountPct(pct);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
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
        body,
      });

      const u = updated as ManagementSettingsDto;
      setSelectedMenu(u.activeMenuNum ?? null);
      setDiscountPct(
        typeof u.globalDiscountPct === "number" ? u.globalDiscountPct : 0
      );
    } catch (e: any) {
      setError(e?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Operational Defaults"
        description="Keep the business settings in one calmer place while appearance stays in the global Settings page."
      >
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  Active menu
                </span>
                <select
                  className="rs-select"
                  value={selectedMenu ?? ""}
                  disabled={loading || saving || menus.length === 0}
                  onChange={(e) =>
                    setSelectedMenu(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="" disabled>
                    {loading ? "Loading..." : "Select a menu..."}
                  </option>
                  {menus.map((m) => (
                    <option key={m.menuNum} value={m.menuNum}>
                      #{m.menuNum} — {m.name}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-[var(--muted-foreground)]">
                  This menu remains the default source for the Order page.
                </span>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-[var(--foreground)]">
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
                  className="rs-input"
                  placeholder="e.g. 10"
                />
                <span className="text-sm text-[var(--muted-foreground)]">
                  Used as the current global pricing adjustment in the frontend.
                </span>
              </label>
            </div>

            <div className="rs-action-strip">
              <Button
                onClick={handleSave}
                disabled={loading || saving || menus.length === 0 || !dirty}
              >
                {saving ? "Saving..." : "Save Settings"}
              </Button>
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  window.alert(
                    "Hot fixes panel:\n\n• Exclude out-of-stock items\n• Add temporary event sections\n\n(Coming soon)"
                  );
                }}
              >
                Hot Fixes
              </Button>
            </div>

            {loading ? (
              <div className="text-sm text-[var(--muted-foreground)]">
                Loading menus and settings...
              </div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
                {error}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3">
            <StatCard
              label="Selected Menu"
              value={
                selectedMenu != null
                  ? `#${selectedMenu}`
                  : "No default selected"
              }
              hint="This is the menu the order flow will use by default."
            />
            <StatCard
              label="Global Discount"
              value={`${discountPct || 0}%`}
              hint="Displayed as a frontend business setting without changing backend contracts."
            />
            <div className="rs-surface-muted flex items-start gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                <SettingsIcon className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  Appearance moved to Settings
                </div>
                <div className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                  Dark/light theme control now lives in the global Settings page so operational settings stay focused on business defaults.
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Current Management Setup"
        description="Quick scan cards for the most important configuration points."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Menus"
            value={menus.length}
            hint="Available menus loaded from the existing API."
          />
          <StatCard
            label="Order Source"
            value={selectedMenu != null ? "Configured" : "Pending"}
            hint="No routes or endpoint calls were changed to support this view."
          />
          <div className="rs-surface-muted flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
              <MenuIcon className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">
                Menu-first workflow
              </div>
              <div className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                Keeping this section tight makes it easier to scan before making changes during a live service window.
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
