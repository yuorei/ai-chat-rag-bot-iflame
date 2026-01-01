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
    } catch (error) {
      // Firebase 初期化エラーなどでトークン取得に失敗した場合は、少なくとも開発環境ではログを出す
      if (import.meta.env && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('Failed to get Firebase ID token. Proceeding without auth token.', error)
      }
      // プロダクションでは挙動を変えず、トークンなしでリクエストを続行する
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

// --- UI Settings API ---
import type { ChatUISettings, ThemeSettings, WidgetSettings } from './types';

export async function fetchUISettings(chatId: string): Promise<ChatUISettings> {
  return apiFetch<ChatUISettings>(`/api/chats/${chatId}/ui-settings`);
}

export async function updateUISettings(
  chatId: string,
  themeSettings: ThemeSettings,
  widgetSettings: WidgetSettings
): Promise<ChatUISettings> {
  return apiFetch<ChatUISettings>(`/api/chats/${chatId}/ui-settings`, {
    method: 'PUT',
    body: JSON.stringify({
      theme_settings: themeSettings,
      widget_settings: widgetSettings,
    }),
  });
}

export async function uploadButtonImage(
  chatId: string,
  file: File
): Promise<{ imageUrl: string; size: number }> {
  const formData = new FormData();
  formData.append('image', file);

  let idToken = '';
  if (typeof window !== 'undefined') {
    try {
      const currentUser = getFirebaseAuth().currentUser;
      if (currentUser) {
        idToken = await currentUser.getIdToken();
      }
    } catch {
      // Ignore token errors
    }
  }

  const res = await fetch(`${apiBase}/api/chats/${chatId}/button-image`, {
    method: 'POST',
    credentials: 'include',
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'upload failed');
  }
  return data;
}

export async function deleteButtonImage(chatId: string): Promise<void> {
  await apiFetch(`/api/chats/${chatId}/button-image`, { method: 'DELETE' });
}

declare global {
  interface Window {
    __MGMT_API_BASE__?: string;
  }
}
