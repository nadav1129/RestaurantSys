// front/src/api/api.ts
export const API_BASE = "http://localhost:8080";

type ApiOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;                 // allow plain objects here
  headers?: HeadersInit;
  query?: Record<string, string | number | boolean | null | undefined>;
};

function isNativeBody(b: unknown): b is
  | string
  | Blob
  | FormData
  | URLSearchParams
  | ReadableStream<any>
  | ArrayBuffer
  | ArrayBufferView {
  return (
    typeof b === "string" ||
    b instanceof Blob ||
    b instanceof FormData ||
    b instanceof URLSearchParams ||
    b instanceof ReadableStream ||
    b instanceof ArrayBuffer ||
    ArrayBuffer.isView(b as any)
  );
}

export async function apiFetch<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, query, ...rest } = options;

  // Build URL with optional query params
  let url = `${API_BASE}${path}`;
  if (query && Object.keys(query).length) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    }
    url += `?${qs.toString()}`;
  }

  // Start with caller headers; we’ll add JSON content-type only if appropriate
  const hdrs = new Headers(headers ?? {});
  const init: RequestInit = { method: "GET", ...rest, headers: hdrs };

  // Handle body
  if (body !== undefined) {
    if (isNativeBody(body)) {
      // Pass through as-is; don't force a content-type
      init.body = body as any;
    } else {
      // JSON-encode plain objects/numbers/booleans, etc.
      init.body = JSON.stringify(body);
      if (!hdrs.has("Content-Type")) {
        hdrs.set("Content-Type", "application/json");
      }
    }
  } else {
    // If no body and no content-type, set JSON for typical JSON APIs only when method implies a body? (optional)
    // We leave it unset to avoid sending misleading headers on GETs.
  }

  const res = await fetch(url, init);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${errText ? `: ${errText}` : ""}`);
  }

  // 204 No Content
  if (res.status === 204) return null as T;

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const text = await res.text();
    return (text ? (JSON.parse(text) as T) : (null as T));
  }

  // If needed you could return text/blob here; to match your old behavior return null for non-JSON.
  return null as T;
}
