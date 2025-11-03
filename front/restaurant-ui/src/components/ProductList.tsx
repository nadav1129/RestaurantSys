import React from "react";

export interface Product {
  id: string;
  name: string;
  price: number;
  isBottleOnly: boolean;
}

export default function ProductList({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
        No products here yet.
      </div>
    );
  }

  return (
    <table className="w-full table-fixed border-separate border-spacing-y-2 text-left text-sm">
      <thead className="text-xs uppercase text-gray-500">
        <tr>
          <th className="px-3">Name</th>
          <th className="px-3 w-[80px]">Price</th>
          <th className="px-3 w-[120px]">Bottle Only?</th>
          <th className="px-3 w-[80px] text-right">Edit</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr
            key={p.id}
            className="rounded-xl bg-gray-50 text-gray-800 shadow-sm"
          >
            <td className="px-3 py-2 font-medium">{p.name}</td>
            <td className="px-3 py-2">{p.price.toFixed(2)}</td>
            <td className="px-3 py-2">
              {p.isBottleOnly ? (
                <span className="rounded-lg bg-gray-900 px-2 py-1 text-[10px] font-semibold text-white">
                  Bottle
                </span>
              ) : (
                <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-medium text-gray-600 ring-1 ring-gray-300">
                  Pour
                </span>
              )}
            </td>
            <td className="px-3 py-2 text-right">
              <button
                className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                onClick={() => {
                  /* TODO: open edit product modal */
                  alert(`TODO edit product ${p.id}`);
                }}
              >
                Edit
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
