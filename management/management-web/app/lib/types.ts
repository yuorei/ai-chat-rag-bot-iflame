// Re-export UI-related types from shared module
export type {
  ThemeColors,
  ThemeLabels,
  WidgetButton,
  WidgetWindow,
  WidgetBanner,
  PartialThemeColors,
  PartialThemeLabels,
  PartialWidgetButton,
  PartialWidgetWindow,
  PartialWidgetBanner,
  ThemeSettings,
  WidgetSettings,
  ChatUISettings,
} from '../../../../shared/constants/ui-defaults';

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

export type KnowledgeAssetWithContent = KnowledgeAsset & {
  text?: string | null;
  editable?: boolean;
};

export type User = {
  id: string;
  email: string;
};

export type Suggestion = {
  id: string;
  text: string;
  order_index: number;
  enabled: boolean;
};

// Analytics types
export type AnalyticsSummary = {
  date: string;
  totalMessages: number;
  uniqueSessions: number;
  avgResponseTimeMs: number;
  contextFoundRate: number;
  errorRate: number;
  totalTokensUsed: number;
};

export type AnalyticsOverview = {
  totalMessages: number;
  totalSessions: number;
  avgResponseTimeMs: number;
  errorRate: number;
  contextFoundRate: number;
  totalTokensUsed: number;
};

export type HourlyDistribution = {
  hour: number;
  messageCount: number;
};

export type DomainBreakdown = {
  originDomain: string;
  messageCount: number;
  avgResponseTimeMs: number;
};

export type DeviceBreakdown = {
  deviceType: string;
  browser: string;
  messageCount: number;
};

export type ChatMessage = {
  eventId: string;
  eventTimestamp: string;
  chatId: string;
  messageContent: string | null;
  responseContent: string | null;
  originDomain: string | null;
  totalDurationMs: number | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  contextFound: boolean | null;
  errorCode: string | null;
};

export type MessageListResponse = {
  messages: ChatMessage[];
  totalCount: number;
  hasMore: boolean;
  nextOffset: number;
};
