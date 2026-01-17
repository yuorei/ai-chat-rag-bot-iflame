import { getFirebaseAuth } from './firebase'
import type { ChatUISettings, ThemeSettings, WidgetSettings, KnowledgeAssetWithContent, Suggestion, AnalyticsSummary, AnalyticsOverview, HourlyDistribution, DomainBreakdown, DeviceBreakdown, MessageListResponse } from './types';

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

// 画像をリサイズしてWebPに変換する処理
const MAX_IMAGE_SIZE = 1024 * 1024; // 1MB
const MAX_IMAGE_DIMENSION = 512; // 最大幅/高さ（ボタン用なので小さめ）

async function processImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // リサイズ計算
      let width = img.width;
      let height = img.height;

      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Canvasで描画
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // WebPに変換（品質を調整して1MB以下にする）
      const tryConvert = (quality: number): Promise<Blob> => {
        return new Promise((res, rej) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                rej(new Error('Failed to convert image'));
                return;
              }
              res(blob);
            },
            'image/webp',
            quality
          );
        });
      };

      // 品質を段階的に下げながら1MB以下になるまで試行
      const convertWithQualityAdjustment = async () => {
        let quality = 0.9;
        let blob = await tryConvert(quality);

        while (blob.size > MAX_IMAGE_SIZE && quality > 0.1) {
          quality -= 0.1;
          blob = await tryConvert(quality);
        }

        if (blob.size > MAX_IMAGE_SIZE) {
          throw new Error('画像を1MB以下に圧縮できませんでした。より小さい画像を選択してください。');
        }

        return blob;
      };

      convertWithQualityAdjustment().then(resolve).catch(reject);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像の読み込みに失敗しました'));
    };

    img.src = url;
  });
}

export async function uploadButtonImage(
  chatId: string,
  file: File
): Promise<{ imageUrl: string; size: number }> {
  // SVGはそのままアップロード（変換不要）
  let processedFile: File | Blob = file;
  if (file.type !== 'image/svg+xml') {
    processedFile = await processImage(file);
  } else if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('SVGファイルは1MB以下にしてください');
  }

  const formData = new FormData();
  // WebP変換後のファイルを送信
  const fileName = file.type === 'image/svg+xml' ? file.name : file.name.replace(/\.[^.]+$/, '.webp');
  formData.append('image', processedFile, fileName);

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

  const data: { imageUrl?: string; size?: number; error?: string } = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'upload failed');
  }
  return { imageUrl: data.imageUrl!, size: data.size! };
}

export async function deleteButtonImage(chatId: string): Promise<void> {
  await apiFetch(`/api/chats/${chatId}/button-image`, { method: 'DELETE' });
}

// --- Knowledge API ---

export async function fetchKnowledgeContent(id: string): Promise<KnowledgeAssetWithContent> {
  return apiFetch<KnowledgeAssetWithContent>(`/api/knowledge/${id}`);
}

export async function updateKnowledge(
  id: string,
  data: { title?: string; text?: string }
): Promise<{ success: boolean }> {
  return apiFetch(`/api/knowledge/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// --- Suggestions API ---

export async function fetchSuggestions(chatId: string): Promise<Suggestion[]> {
  const data = await apiFetch<{ suggestions: Suggestion[] }>(`/api/chats/${chatId}/suggestions`);
  return data.suggestions || [];
}

export async function updateSuggestions(
  chatId: string,
  suggestions: Suggestion[]
): Promise<Suggestion[]> {
  const data = await apiFetch<{ suggestions: Suggestion[] }>(`/api/chats/${chatId}/suggestions`, {
    method: 'PUT',
    body: JSON.stringify({ suggestions }),
  });
  return data.suggestions || [];
}

// --- Analytics API ---

export async function fetchAnalyticsSummary(
  chatId: string,
  startDate: string,
  endDate: string
): Promise<AnalyticsSummary[]> {
  const params = new URLSearchParams({
    chat_id: chatId,
    start_date: startDate,
    end_date: endDate,
  });
  const data = await apiFetch<{ data: AnalyticsSummary[] }>(`/api/analytics/summary?${params}`);
  return data.data || [];
}

export async function fetchAnalyticsOverview(
  chatId: string,
  startDate: string,
  endDate: string
): Promise<AnalyticsOverview> {
  const params = new URLSearchParams({
    chat_id: chatId,
    start_date: startDate,
    end_date: endDate,
  });
  return apiFetch<AnalyticsOverview>(`/api/analytics/overview?${params}`);
}

export async function fetchHourlyDistribution(
  chatId: string,
  startDate: string,
  endDate: string
): Promise<HourlyDistribution[]> {
  const params = new URLSearchParams({
    chat_id: chatId,
    start_date: startDate,
    end_date: endDate,
  });
  const data = await apiFetch<{ data: HourlyDistribution[] }>(`/api/analytics/hourly?${params}`);
  return data.data || [];
}

export async function fetchDomainBreakdown(
  chatId: string,
  startDate: string,
  endDate: string
): Promise<DomainBreakdown[]> {
  const params = new URLSearchParams({
    chat_id: chatId,
    start_date: startDate,
    end_date: endDate,
  });
  const data = await apiFetch<{ data: DomainBreakdown[] }>(`/api/analytics/domains?${params}`);
  return data.data || [];
}

export async function fetchDeviceBreakdown(
  chatId: string,
  startDate: string,
  endDate: string
): Promise<DeviceBreakdown[]> {
  const params = new URLSearchParams({
    chat_id: chatId,
    start_date: startDate,
    end_date: endDate,
  });
  const data = await apiFetch<{ data: DeviceBreakdown[] }>(`/api/analytics/devices?${params}`);
  return data.data || [];
}

export async function fetchMessages(
  chatId: string,
  startDate: string,
  endDate: string,
  limit: number = 50,
  offset: number = 0,
  searchQuery?: string
): Promise<MessageListResponse> {
  const params = new URLSearchParams({
    chat_id: chatId,
    start_date: startDate,
    end_date: endDate,
    limit: limit.toString(),
    offset: offset.toString(),
  });
  if (searchQuery) {
    params.append('search', searchQuery);
  }
  return apiFetch<MessageListResponse>(`/api/analytics/messages?${params}`);
}

declare global {
  interface Window {
    __MGMT_API_BASE__?: string;
  }
}
