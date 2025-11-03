// front/src/api/api.ts
export const API_BASE = "http://localhost:8080";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers({ "Content-Type": "application/json" });
  const init: RequestInit = { method: "GET", ...options, headers };

  // If body is a plain object, JSON.stringify it
  if (init.body && typeof init.body !== "string") {
    init.body = JSON.stringify(init.body);
  }

  const res = await fetch(`${API_BASE}${path}`, init);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${errText ? `: ${errText}` : ""}`);
  }

  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
