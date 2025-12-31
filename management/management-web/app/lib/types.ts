export type ChatProfile = {
  id: string;
  target: string;
  targets?: string[];
  display_name: string;
  system_prompt: string;
  created_at?: string;
  updated_at?: string;
};

export type KnowledgeAsset = {
  id: string;
  chat_id: string;
  type: string;
  title?: string;
  source_url?: string;
  original_filename?: string;
  status: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  email: string;
};
