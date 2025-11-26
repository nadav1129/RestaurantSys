import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/api";

interface SpeedRow {
  ingredientId: string;
  ingredientName: string;
  bottleProductId: string | null;
}

interface BottleProductOption {
  id: string;
  name: string;
}

export default function SpeedPage() {
  const [rows, setRows] = useState<SpeedRow[]>([]);
  const [bottles, setBottles] = useState<BottleProductOption[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    async function loadAll() {
      try {
        const resSpeed = await apiFetch("/api/speed-map");
        if (resSpeed.ok) {
          const dataSpeed: SpeedRow[] = await resSpeed.json();
          setRows(Array.isArray(dataSpeed) ? dataSpeed : []);
        } else {
          console.warn("GET /api/speed-map failed", resSpeed.status);
          setRows([]);
        }
      } catch (err) {
        console.warn("GET /api/speed-map error", err);
        setRows([]);
      }

      try {
        const resBottles = await apiFetch(
          "/api/products?isBottleOnly=true"
        );
        if (resBottles.ok) {
          const dataBottles: BottleProductOption[] =
            await resBottles.json();
          setBottles(Array.isArray(dataBottles) ? dataBottles : []);
        } else {
          console.warn(
            "GET /api/products?isBottleOnly=true failed",
            resBottles.status
          );
          setBottles([]);
        }
      } catch (err) {
        console.warn("GET bottle SKUs error", err);
        setBottles([]);
      }
    }

    loadAll();
  }, []);

  function updateRow(idx: number, bottleProductId: string) {
    setRows((old) => {
      const copy = [...old];
      copy[idx] = { ...copy[idx], bottleProductId };
      return copy;
    });
    setIsDirty(true);
  }

  async function handleSave() {
    const payload = rows.map((r) => ({
      ingredientId: r.ingredientId,
      bottleProductId: r.bottleProductId,
    }));

    try {
      const res = await apiFetch("/api/speed-map", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error("Failed to save speed map", res.status);
        return;
      }

      setIsDirty(false);
    } catch (err) {
      console.error("PUT /api/speed-map error", err);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="text-sm font-medium text-gray-500">
            Speed Rail Defaults
          </div>
          <div className="text-lg font-semibold text-gray-800">
            What bottle do we pour by default?
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Example: Gin → Gordon&apos;s 700ml
          </div>
        </div>

        <button
          disabled={!isDirty}
          onClick={handleSave}
          className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
            isDirty
              ? "bg-gray-900 hover:bg-black"
              : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          Save Changes
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <table className="w-full table-fixed border-separate border-spacing-y-2 text-left text-sm">
          <thead className="text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Base Ingredient</th>
              <th className="px-3 py-2">Default Bottle / SKU</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  className="px-3 py-10 text-center text-sm text-gray-400"
                >
                  (no speed rail yet / backend not connected)
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={row.ingredientId}
                  className="rounded-xl bg-gray-50 text-gray-800 shadow-sm"
                >
                  <td className="px-3 py-2 font-medium">
                    {row.ingredientName}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      value={row.bottleProductId ?? ""}
                      onChange={(e) =>
                        updateRow(idx, e.target.value)
                      }
                    >
                      <option value="">Select bottle…</option>
                      {bottles.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-[10px] text-gray-400">
        Speed rail changes affect pouring defaults and bottle usage
        tracking.
      </div>
    </div>
  );
}
