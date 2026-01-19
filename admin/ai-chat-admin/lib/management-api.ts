function getBaseUrl(): string {
  return process.env.MANAGEMENT_API_BASE_URL ?? '';
}

function getApiKey(): string {
  return process.env.MANAGEMENT_API_KEY ?? '';
}

export type User = {
  id: string;
  email: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  chat_count: number;
};

export type Chat = {
  id: string;
  target: string;
  target_type: string;
  display_name: string;
  system_prompt: string;
  owner_user_id: string;
  owner_email: string | null;
  targets: string[];
  created_at: string;
  updated_at: string;
};

export type KnowledgeAsset = {
  id: string;
  chat_id: string;
  chat_display_name: string | null;
  owner_email: string | null;
  type: string;
  title?: string;
  source_url?: string;
  original_filename?: string;
  storage_path?: string;
  status: string;
  embedding_count: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
};

export type Stats = {
  users_count: number;
  chats_count: number;
  knowledge_count: number;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  pagination: Pagination;
} & T;

async function fetchApi<T>(path: string, params?: Record<string, string>): Promise<T> {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();
  console.log('[management-api] ベースURL:', baseUrl);
  console.log('[management-api] fetchApi called for path:', path);
  console.log('[management-api] MANAGEMENT_API_BASE_URL:', baseUrl ? `${baseUrl.substring(0, 20)}...` : 'NOT SET');
  console.log('[management-api] MANAGEMENT_API_KEY:', apiKey ? 'SET (hidden)' : 'NOT SET');

  if (!baseUrl) {
    throw new Error('MANAGEMENT_API_BASE_URL is not configured');
  }
  if (!apiKey) {
    throw new Error('MANAGEMENT_API_KEY is not configured');
  }

  let url = `${baseUrl}${path}`;
  if (params) {
    const queryString = new URLSearchParams(params).toString();
    url = `${url}?${queryString}`;
  }

  const response = await fetch(url, {
    headers: {
      'X-Admin-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { error?: string }).error || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getUsers(page = 1, limit = 50): Promise<PaginatedResponse<{ users: User[] }>> {
  return fetchApi<PaginatedResponse<{ users: User[] }>>(
    '/api/admin/users',
    { page: String(page), limit: String(limit) }
  );
}

export async function getChats(page = 1, limit = 50): Promise<PaginatedResponse<{ chats: Chat[] }>> {
  return fetchApi<PaginatedResponse<{ chats: Chat[] }>>(
    '/api/admin/chats',
    { page: String(page), limit: String(limit) }
  );
}

export async function getKnowledge(page = 1, limit = 50): Promise<PaginatedResponse<{ items: KnowledgeAsset[] }>> {
  return fetchApi<PaginatedResponse<{ items: KnowledgeAsset[] }>>(
    '/api/admin/knowledge',
    { page: String(page), limit: String(limit) }
  );
}

export async function getStats(): Promise<Stats> {
  return fetchApi<Stats>('/api/admin/stats');
}
