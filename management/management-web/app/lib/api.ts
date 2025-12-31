import { getFirebaseAuth } from './firebase'

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
  let idToken = ''
  // クライアントサイドのみで認証トークンを取得
  if (typeof window !== 'undefined') {
    try {
      const currentUser = getFirebaseAuth().currentUser
      if (currentUser) {
        idToken = await currentUser.getIdToken()
      }
    } catch {
      // Firebase 初期化エラーは無視してリクエストを続行
    }
  }

  const res = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {}),
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
