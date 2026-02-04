import { CONVEX_URL_ENDPOINT } from "@/config";

let convexUrl: string | null = null;

async function getConvexUrl(): Promise<string> {
  if (convexUrl) return convexUrl;
  const res = await fetch(CONVEX_URL_ENDPOINT);
  const data = await res.json();
  convexUrl = data.url;
  return convexUrl!;
}

async function callConvex<T>(
  type: "query" | "mutation",
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const url = await getConvexUrl();
  const res = await fetch(`${url}/api/${type}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: name, args, format: "json" }),
  });
  if (!res.ok) {
    throw new Error(`Convex ${type} failed: ${res.status}`);
  }
  const data = await res.json();
  return data.value as T;
}

export function convexQuery<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  return callConvex<T>("query", name, args);
}

export function convexMutation<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  return callConvex<T>("mutation", name, args);
}
