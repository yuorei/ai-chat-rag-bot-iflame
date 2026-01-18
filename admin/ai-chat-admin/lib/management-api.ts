function getConfig() {
  return {
    baseUrl: process.env.MANAGEMENT_API_BASE_URL || '',
    apiKey: process.env.MANAGEMENT_API_KEY || '',
  };
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

async function fetchApi<T>(path: string): Promise<T> {
  const { baseUrl, apiKey } = getConfig();

  if (!baseUrl) {
    throw new Error('MANAGEMENT_API_BASE_URL is not configured');
  }
  if (!apiKey) {
    throw new Error('MANAGEMENT_API_KEY is not configured');
  }

  const url = `${baseUrl}${path}`;
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

export async function getUsers(): Promise<User[]> {
  const data = await fetchApi<{ users: User[] }>('/api/admin/users');
  return data.users;
}

export async function getChats(): Promise<Chat[]> {
  const data = await fetchApi<{ chats: Chat[] }>('/api/admin/chats');
  return data.chats;
}

export async function getKnowledge(): Promise<KnowledgeAsset[]> {
  const data = await fetchApi<{ items: KnowledgeAsset[] }>('/api/admin/knowledge');
  return data.items;
}

export async function getStats(): Promise<Stats> {
  return fetchApi<Stats>('/api/admin/stats');
}
