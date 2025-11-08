import React, { useEffect, useState } from "react";
import type { MenuNode } from "./MenuTree";

type ProductIngredientLineDraft = {
  ingredientId: string;
  isLeading: boolean;
  isChangeable: boolean;
  amount: string;
};

export default function AddProductModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: {
    name: string;
    isBottleOnly: boolean;
    lines: ProductIngredientLineDraft[];
  }) => void;
}) {
  const [name, setName] = useState("");
  const [isBottleOnly, setIsBottleOnly] = useState(false);
  const [ingredients, setIngredients] = useState<
    { ingredientId: string; name: string }[]
  >([]);

  const [lines, setLines] = useState<ProductIngredientLineDraft[]>([
    { ingredientId: "", isLeading: false, isChangeable: false, amount: "" },
  ]);

  /* ingredients */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ingredients");
        const data = await res.json();
        setIngredients(Array.isArray(data) ? data : []);
      } catch {
        setIngredients([]);
      }
    })();
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
    onSave({
      name,
      isBottleOnly,
      lines,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <div className="text-sm font-medium text-gray-500">New Product</div>
            <div className="text-lg font-semibold text-gray-800">
              Create Menu Item
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto p-5">
          <div className="mb-5 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-700">
                Product Name
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <input
                id="bottleOnly"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                checked={isBottleOnly}
                onChange={(e) => setIsBottleOnly(e.target.checked)}
              />
              <label htmlFor="bottleOnly" className="text-xs font-semibold text-gray-700">
                Sold as full bottle only
              </label>
            </div>
          </div>

          <div className="mb-3 text-sm font-semibold text-gray-800">
            Composition / Ingredients
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"
              >
                <div className="mb-2 grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-semibold text-gray-700">
                      Ingredient
                    </label>
                    <select
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
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
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold text-gray-700">
                      Amount
                    </label>
                    <input
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      value={line.amount}
                      onChange={(e) => updateLine(idx, { amount: e.target.value })}
                      placeholder="50ml / 200g / etc"
                      required={!isBottleOnly}
                    />
                  </div>

                  <div className="flex flex-col justify-end gap-2">
                    <label className="flex items-center gap-2 text-[10px] font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                        checked={line.isLeading}
                        onChange={(e) =>
                          updateLine(idx, { isLeading: e.target.checked })
                        }
                      />
                      Leading
                    </label>

                    <label className="flex items-center gap-2 text-[10px] font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                        checked={line.isChangeable}
                        onChange={(e) =>
                          updateLine(idx, { isChangeable: e.target.checked })
                        }
                      />
                      Changeable
                    </label>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-100"
                    onClick={() => removeLine(idx)}
                  >
                    Remove line
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={addLine}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              + Add ingredient line
            </button>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
            >
              Save Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
