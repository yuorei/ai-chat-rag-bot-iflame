/**
 * Shared UI default settings for the chat widget
 * 
 * This file contains all default values for theme colors, labels, and widget settings.
 * These defaults are used across:
 * - Frontend UI editor (management-web)
 * - Backend API (management-server-hono)
 * - Iframe server (cfw-iframe-server)
 */

export type ThemeColors = {
  headerBackground: string;
  headerText: string;
  bodyBackground: string;
  containerBackground: string;
  messagesBackground: string;
  botMessageBackground: string;
  botMessageText: string;
  botMessageBorder: string;
  userMessageBackground: string;
  userMessageGradientEnd: string;
  userMessageText: string;
  inputAreaBackground: string;
  inputBackground: string;
  inputText: string;
  inputBorder: string;
  inputBorderFocus: string;
  accentColor: string;
  accentHover: string;
};

export type ThemeLabels = {
  headerTitle: string;
  inputPlaceholder: string;
  welcomeMessage: string;
};

export type WidgetButton = {
  size: number;
  bottom: number;
  right: number;
  color: string;
  label: string;
  closeLabel: string;
};

export type WidgetWindow = {
  width: string;
  height: string;
  mobileWidth: string;
  mobileHeight: string;
};

/**
 * Default color palette for the chat widget
 */
export const DEFAULT_COLORS: ThemeColors = {
  headerBackground: "#4a90e2",
  headerText: "#ffffff",
  bodyBackground: "#f5f5f5",
  containerBackground: "#ffffff",
  messagesBackground: "#ffffff",
  botMessageBackground: "#f8f9fa",
  botMessageText: "#333333",
  botMessageBorder: "#e9ecef",
  userMessageBackground: "#4a90e2",
  userMessageGradientEnd: "#357abd",
  userMessageText: "#ffffff",
  inputAreaBackground: "#f8f9fa",
  inputBackground: "#ffffff",
  inputText: "#333333",
  inputBorder: "#e9ecef",
  inputBorderFocus: "#4a90e2",
  accentColor: "#4a90e2",
  accentHover: "#357abd",
};

/**
 * Default text labels for the chat widget
 */
export const DEFAULT_LABELS: ThemeLabels = {
  headerTitle: "AI Chat Bot",
  inputPlaceholder: "メッセージを入力...",
  welcomeMessage: "こんにちは！何かお手伝いできることはありますか？",
};

/**
 * Default widget button configuration
 */
export const DEFAULT_WIDGET_BUTTON: WidgetButton = {
  size: 64,
  bottom: 20,
  right: 20,
  color: "#4a90e2",
  label: "💬",
  closeLabel: "✕",
};

/**
 * Default widget window dimensions
 */
export const DEFAULT_WIDGET_WINDOW: WidgetWindow = {
  width: "400px",
  height: "600px",
  mobileWidth: "calc(100vw - 20px)",
  mobileHeight: "calc(100vh - 150px)",
};

/**
 * Human-readable labels for color fields (Japanese)
 * Used in the UI editor for displaying color picker labels
 */
export const COLOR_LABELS: Record<keyof ThemeColors, string> = {
  headerBackground: "ヘッダー背景",
  headerText: "ヘッダー文字",
  bodyBackground: "ページ背景",
  containerBackground: "コンテナ背景",
  messagesBackground: "メッセージエリア背景",
  botMessageBackground: "AIメッセージ背景",
  botMessageText: "AIメッセージ文字",
  botMessageBorder: "AIメッセージ枠線",
  userMessageBackground: "ユーザーメッセージ背景",
  userMessageGradientEnd: "ユーザーメッセージグラデーション終点",
  userMessageText: "ユーザーメッセージ文字",
  inputAreaBackground: "入力エリア背景",
  inputBackground: "入力欄背景",
  inputText: "入力欄文字",
  inputBorder: "入力欄枠線",
  inputBorderFocus: "入力欄フォーカス枠線",
  accentColor: "アクセントカラー",
  accentHover: "アクセントカラー(ホバー)",
};
