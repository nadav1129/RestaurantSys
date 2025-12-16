import React, { useEffect, useMemo, useState } from "react";

import { apiFetch } from "../api/api";
/*
  IngredientManager.tsx
  A light-weight full-screen panel you can open from MenuPage to manage ingredients.
  - Shows list of ingredients
  - Add by name
  - Remove selected
  - Back button to close

  Expected backend endpoints:
    GET    /api/ingredients                -> IngredientDto[]
    POST   /api/ingredients                -> { ingredientId, name }
    DELETE /api/ingredients/{ingredientId} -> 204

  Integration (MenuPage.tsx) example:
    const [openIng, setOpenIng] = useState(false);
    <Button onClick={() => setOpenIng(true)}>Ingredients</Button>
    <IngredientManager open={openIng} onClose={() => setOpenIng(false)} />
*/

/* ---------- Types ---------- */
export type IngredientDto = {
  ingredientId: string;
  name: string;
};

/* (Using shared apiFetch from src/api/api.ts) */

/* ---------- Component ---------- */
export default function IngredientManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<IngredientDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [newName, setNewName] = useState("");
  const [busyCreate, setBusyCreate] = useState(false);
  const [busyRemove, setBusyRemove] = useState<string | null>(null);

  /* Fetch on open */
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
        [...prev, resp as IngredientDto].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold">Ingredients</h2>
            <p className="text-xs text-gray-500">Add / remove base ingredients used by products</p>
          </div>
          <button onClick={onClose} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50">Back</button>
        </div>

        {/* Toolbar */}
        <div className="mb-3 flex items-center gap-2 px-5">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search ingredient..."
            className="flex-1 rounded-xl border px-3 py-2 text-sm"
          />
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
          {/* Add new */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-2 text-sm font-medium">Add ingredient</div>
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Vodka"
                className="flex-1 rounded-xl border px-3 py-2 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || busyCreate}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busyCreate ? "Adding..." : "Add"}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b p-3 text-sm font-medium">
              <span>All ingredients</span>
              {loading && <span className="text-xs text-gray-500">Loading...</span>}
            </div>

            {error && (
              <div className="px-3 py-2 text-sm text-red-600">{error}</div>
            )}

            <ul className="max-h-[55vh] overflow-auto p-2">
              {filtered.length === 0 && !loading && (
                <li className="px-2 py-8 text-center text-sm text-gray-500">No ingredients yet</li>
              )}
              {filtered.map((ing) => (
                <li key={ing.ingredientId} className="group flex items-center justify-between rounded-xl p-2 hover:bg-gray-50">
                  <div className="truncate text-sm">{ing.name}</div>
                  <button
                    onClick={() => handleRemove(ing.ingredientId)}
                    disabled={busyRemove === ing.ingredientId}
                    className="invisible rounded-xl border px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 group-hover:visible disabled:opacity-50"
                    title="Remove"
                  >
                    {busyRemove === ing.ingredientId ? "Removing..." : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
