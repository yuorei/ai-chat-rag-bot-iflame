const fallbackBase =
  import.meta.env.VITE_MANAGEMENT_API_BASE_URL ?? "http://localhost:8100";

export const apiBase =
  typeof window !== "undefined"
    ? window.__MGMT_API_BASE__ ?? fallbackBase
    : fallbackBase;

type Options = RequestInit & { skipAuthError?: boolean };

export async function apiFetch<T = any>(
  path: string,
  init: Options = {},
): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg = data?.error || `request failed (${res.status})`;
    if (res.status === 401 && !init.skipAuthError) {
      throw new AuthError(msg);
    }
    throw new Error(msg);
  }
  return data as T;
}

export class AuthError extends Error {}

declare global {
  interface Window {
    __MGMT_API_BASE__?: string;
  }
}
