import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/api";
import Button from "./Button";
import { PlusIcon, XIcon } from "./icons";

export type IngredientDto = {
  ingredientId: string;
  name: string;
};

export default function IngredientManager({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<IngredientDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [newName, setNewName] = useState("");
  const [busyCreate, setBusyCreate] = useState(false);
  const [busyRemove, setBusyRemove] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch("/api/ingredients");
        setItems(Array.isArray(data) ? (data as IngredientDto[]) : []);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load ingredients");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => x.name.toLowerCase().includes(q));
  }, [items, filter]);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setBusyCreate(true);
    setError(null);
    try {
      const resp = await apiFetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { name },
      });

      setItems((prev) =>
        [...prev, resp as IngredientDto].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        )
      );
      setNewName("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to add ingredient");
    } finally {
      setBusyCreate(false);
    }
  }

  async function handleRemove(id: string) {
    setBusyRemove(id);
    setError(null);
    try {
      await apiFetch(`/api/ingredients/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((x) => x.ingredientId !== id));
    } catch (e: any) {
      setError(e?.message ?? "Failed to remove ingredient");
    } finally {
      setBusyRemove(null);
    }
  }

  if (!open) return null;

  return (
    <div className="rs-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6">
      <div className="rs-modal w-full max-w-3xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              Ingredients
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Add and remove base ingredients used by products.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <XIcon className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search ingredient..."
              className="rs-input"
            />
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Vodka"
                className="rs-input min-w-[220px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
              <Button
                onClick={handleAdd}
                disabled={!newName.trim() || busyCreate}
              >
                <PlusIcon className="h-4 w-4" />
                {busyCreate ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] p-4 text-sm text-[var(--destructive)]">
              {error}
            </div>
          ) : null}

          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 text-sm font-semibold text-[var(--foreground)]">
              <span>All ingredients</span>
              {loading ? (
                <span className="text-xs text-[var(--muted-foreground)]">
                  Loading...
                </span>
              ) : null}
            </div>

            <ul className="max-h-[55vh] overflow-auto p-3">
              {filtered.length === 0 && !loading ? (
                <li className="px-2 py-8 text-center text-sm text-[var(--muted-foreground)]">
                  No ingredients yet
                </li>
              ) : null}

              {filtered.map((ing) => (
                <li
                  key={ing.ingredientId}
                  className="group flex items-center justify-between rounded-2xl border border-transparent bg-[var(--card)] p-4 transition hover:border-[var(--border)]"
                >
                  <div className="truncate text-sm font-medium text-[var(--foreground)]">
                    {ing.name}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => handleRemove(ing.ingredientId)}
                    disabled={busyRemove === ing.ingredientId}
                  >
                    {busyRemove === ing.ingredientId ? "Removing..." : "Remove"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
