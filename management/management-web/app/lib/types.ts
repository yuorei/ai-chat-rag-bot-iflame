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

export type ThemeColors = {
  headerBackground?: string;
  headerText?: string;
  bodyBackground?: string;
  containerBackground?: string;
  messagesBackground?: string;
  botMessageBackground?: string;
  botMessageText?: string;
  botMessageBorder?: string;
  userMessageBackground?: string;
  userMessageGradientEnd?: string;
  userMessageText?: string;
  inputAreaBackground?: string;
  inputBackground?: string;
  inputText?: string;
  inputBorder?: string;
  inputBorderFocus?: string;
  accentColor?: string;
  accentHover?: string;
};

export type ThemeLabels = {
  headerTitle?: string;
  inputPlaceholder?: string;
  welcomeMessage?: string;
};

export type ThemeSettings = {
  colors?: ThemeColors;
  labels?: ThemeLabels;
};

export type WidgetButton = {
  size?: number;
  bottom?: number;
  right?: number;
  color?: string;
  label?: string;
  closeLabel?: string;
};

export type WidgetWindow = {
  width?: string;
  height?: string;
  mobileWidth?: string;
  mobileHeight?: string;
};

export type WidgetSettings = {
  button?: WidgetButton;
  window?: WidgetWindow;
};

export type ChatUISettings = {
  id: string;
  chat_id: string;
  theme_settings: ThemeSettings;
  widget_settings: WidgetSettings;
  created_at: string;
  updated_at: string;
};
