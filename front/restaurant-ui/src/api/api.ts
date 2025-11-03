// front/src/api/api.ts
export const API_BASE = "http://localhost:8080";

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  // Throw with any error text to help debugging
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${errText ? `: ${errText}` : ""}`);
  }

  // 204 No Content or empty body → return null
  if (res.status === 204) return null;

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    // No JSON -> treat as empty/success
    return null;
  }

  // Some servers send application/json with empty body; handle that too
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}
