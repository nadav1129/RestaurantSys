// front/restaurant-ui/src/pages/DevTestsPage/DevTestsPage.tsx
import React, { useState } from "react";
import { apiFetch } from "../../api/api";

type TestResult = {
  id: string;
  category: string;
  description: string;
  success: boolean;
  error?: string;
  logs: string[];
  durationMs: number;
};

export default function DevTestsPage() {
  const [category, setCategory] = useState<string | "">("");
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function runTests() {
    setLoading(true);
    try {
      const body = category ? { category } : {};
      const data = await apiFetch("/api/dev/tests/run", {
        method: "POST",
        body :body,
      });
      setResults(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Category</label>
          <input
            className="border rounded px-2 py-1 text-sm"
            placeholder="api / e2e / db or empty for all"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <button
          onClick={runTests}
          disabled={loading}
          className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
        >
          {loading ? "Running..." : "Run tests"}
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 text-left">Status</th>
              <th className="px-2 py-1 text-left">Id</th>
              <th className="px-2 py-1 text-left">Description</th>
              <th className="px-2 py-1 text-right">Duration (ms)</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <React.Fragment key={r.id}>
                <tr className={r.success ? "bg-green-50" : "bg-red-50"}>
                  <td className="px-2 py-1">
                    {r.success ? "✅" : "❌"}
                  </td>
                  <td className="px-2 py-1">{r.id}</td>
                  <td className="px-2 py-1">{r.description}</td>
                  <td className="px-2 py-1 text-right">
                    {r.durationMs.toFixed(1)}
                  </td>
                </tr>
                <tr>
                  <td className="px-2 pb-2" colSpan={4}>
                    {r.error && (
                      <div className="text-xs text-red-600 mb-1">
                        Error: {r.error}
                      </div>
                    )}
                    {r.logs.length > 0 && (
                      <pre className="text-xs bg-gray-900 text-gray-100 p-2 rounded">
                        {r.logs.join("\n")}
                      </pre>
                    )}
                  </td>
                </tr>
              </React.Fragment>
            ))}

            {results.length === 0 && !loading && (
              <tr>
                <td className="px-2 py-2 text-center text-gray-400" colSpan={4}>
                  No results yet. Run tests above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
