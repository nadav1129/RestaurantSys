import { useEffect, useState } from "react";
import { apiFetch } from "../api/api";
import Button from "./Button";
import { PlusIcon, XIcon } from "./icons";

type ProductIngredientLineDraft = {
  ingredientId: string;
  isLeading: boolean;
  isChangeable: boolean;
  amount: string;
};

type Ingredient = { ingredientId: string; name: string };

export default function AddProductModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: {
    name: string;
    isBottleOnly: boolean;
    productType: string;
    lines: ProductIngredientLineDraft[];
  }) => void;
}) {
  const [name, setName] = useState("");
  const [isBottleOnly, setIsBottleOnly] = useState(false);
  const [isFood, setIsFood] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingLoading, setIngLoading] = useState<boolean>(false);
  const [ingError, setIngError] = useState<string | null>(null);
  const [lines, setLines] = useState<ProductIngredientLineDraft[]>([
    { ingredientId: "", isLeading: false, isChangeable: false, amount: "" },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIngLoading(true);
        setIngError(null);
        const data = await apiFetch("/api/ingredients");

        const list: Ingredient[] = (Array.isArray(data) ? data : []).map(
          (x: any) => ({
            ingredientId: x.ingredientId ?? x.ingredient_id ?? x.id,
            name: x.name ?? x.Name,
          })
        );

        if (!cancelled) {
          const cleaned = list.filter((i) => i.ingredientId && i.name);
          setIngredients(cleaned);
        }
      } catch (e: any) {
        if (!cancelled) {
          setIngredients([]);
          setIngError(e?.message || "Failed to load ingredients.");
        }
      } finally {
        if (!cancelled) setIngLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateLine(idx: number, patch: Partial<ProductIngredientLineDraft>) {
    setLines((old) => {
      const copy = [...old];
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
  }

  function addLine() {
    setLines((old) => [
      ...old,
      { ingredientId: "", isLeading: false, isChangeable: false, amount: "" },
    ]);
  }

  function removeLine(idx: number) {
    setLines((old) => old.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();

    const cleaned = lines
      .map((l) => ({
        ...l,
        ingredientId: (l.ingredientId || "").trim(),
        amount: (l.amount || "").trim(),
      }))
      .filter((l) => l.ingredientId && (isBottleOnly ? true : l.amount));

    const productType = isFood ? "food" : "default";

    onSave({
      name: name.trim(),
      isBottleOnly,
      productType,
      lines: cleaned,
    });
  }

  function handleBottleOnlyChange(checked: boolean) {
    setIsBottleOnly(checked);
    if (checked) {
      setIsFood(false);
    }
  }

  function handleFoodChange(checked: boolean) {
    setIsFood(checked);
    if (checked) {
      setIsBottleOnly(false);
    }
  }

  return (
    <div
      className="rs-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="rs-modal w-full max-w-3xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
              New Product
            </div>
            <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              Create menu item
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <XIcon className="h-4.5 w-4.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                Product name
              </span>
              <input
                className="rs-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label className="rs-surface-muted flex items-center gap-3 p-4">
              <input
                id="bottleOnly"
                type="checkbox"
                className="h-4 w-4"
                checked={isBottleOnly}
                onChange={(e) => handleBottleOnlyChange(e.target.checked)}
              />
              <span className="text-sm font-medium text-[var(--foreground)]">
                Sold as full bottle only
              </span>
            </label>

            <label className="rs-surface-muted flex items-center gap-3 p-4">
              <input
                id="foodType"
                type="checkbox"
                className="h-4 w-4"
                checked={isFood}
                onChange={(e) => handleFoodChange(e.target.checked)}
              />
              <span className="text-sm font-medium text-[var(--foreground)]">
                Food
              </span>
            </label>
          </div>

          <div className="mt-6">
            <div className="text-lg font-semibold text-[var(--foreground)]">
              Composition / Ingredients
            </div>
            <div className="mt-1 text-sm text-[var(--muted-foreground)]">
              Build a clean ingredient breakdown for the product without changing the existing creation flow.
            </div>
          </div>

          {ingLoading ? (
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] p-4 text-sm text-[var(--muted-foreground)]">
              Loading ingredients...
            </div>
          ) : null}

          {ingError ? (
            <div className="mt-4 rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] p-4 text-sm text-[var(--destructive)]">
              {ingError}
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            {lines.map((line, idx) => (
              <div key={idx} className="rs-surface-muted p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      Ingredient
                    </span>
                    <select
                      className="rs-select"
                      value={line.ingredientId}
                      onChange={(e) =>
                        updateLine(idx, { ingredientId: e.target.value })
                      }
                      required
                    >
                      <option value="">Select...</option>
                      {ingredients.map((ing) => (
                        <option key={ing.ingredientId} value={ing.ingredientId}>
                          {ing.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      Amount
                    </span>
                    <input
                      className="rs-input"
                      value={line.amount}
                      onChange={(e) => updateLine(idx, { amount: e.target.value })}
                      placeholder="50ml / 200g / etc"
                      required={!isBottleOnly}
                    />
                  </label>

                  <div className="grid gap-3">
                    <label className="rs-surface flex items-center gap-3 p-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={line.isLeading}
                        onChange={(e) =>
                          updateLine(idx, { isLeading: e.target.checked })
                        }
                      />
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        Leading ingredient
                      </span>
                    </label>

                    <label className="rs-surface flex items-center gap-3 p-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={line.isChangeable}
                        onChange={(e) =>
                          updateLine(idx, { isChangeable: e.target.checked })
                        }
                      />
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        Changeable ingredient
                      </span>
                    </label>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => removeLine(idx)}
                  >
                    Remove line
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Button type="button" variant="secondary" onClick={addLine}>
              <PlusIcon className="h-4 w-4" />
              Add ingredient line
            </Button>
          </div>

          <div className="mt-8 flex justify-end gap-2 border-t border-[var(--border)] pt-5">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>

            <Button type="submit" disabled={!name.trim()}>
              Save Product
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
