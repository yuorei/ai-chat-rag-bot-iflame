import { useEffect, useState, useRef, useCallback } from "react";
import { RefreshCw, Save, Monitor, Smartphone, ChevronDown, ChevronUp, Upload, Trash2, AlertCircle } from "lucide-react";
import { fetchUISettings, updateUISettings, uploadButtonImage, deleteButtonImage } from "../../lib/api";
import type { ChatProfile, ThemeSettings, WidgetSettings, ThemeColors, ThemeLabels, WidgetBanner } from "../../lib/types";
import { DEFAULT_COLORS, DEFAULT_LABELS, DEFAULT_WIDGET_BANNER, COLOR_LABELS } from "../../../../../shared/constants/ui-defaults";

// プレビュー用のiframeベースURL（環境変数から取得）
const PREVIEW_BASE_URL = typeof window !== 'undefined'
  ? (window as unknown as { __PREVIEW_IFRAME_URL__?: string }).__PREVIEW_IFRAME_URL__
    || import.meta.env.VITE_PREVIEW_IFRAME_URL
    || ""
  : "";

type UIEditorTabProps = {
  chats: ChatProfile[];
  activeChatId: string;
  setActiveChatId: (id: string) => void;
  setStatus: (status: string | null) => void;
  setError: (error: string | null) => void;
};

export function UIEditorTab({
  chats,
  activeChatId,
  setActiveChatId,
  setStatus,
  setError,
}: UIEditorTabProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [colors, setColors] = useState<ThemeColors>({ ...DEFAULT_COLORS });
  const [labels, setLabels] = useState<ThemeLabels>({ ...DEFAULT_LABELS });
  const [widgetSettings, setWidgetSettings] = useState<WidgetSettings>({});
  const [bannerSettings, setBannerSettings] = useState<WidgetBanner>({ ...DEFAULT_WIDGET_BANNER });
  const [buttonImageUrl, setButtonImageUrl] = useState<string | null>(null);
  const [buttonColor, setButtonColor] = useState("#4a90e2");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [expandedSections, setExpandedSections] = useState({
    colors: true,
    labels: true,
    widget: true,
  });
  const [colorErrors, setColorErrors] = useState<Partial<Record<keyof ThemeColors, string>>>({});
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // カラーバリデーション関数
  const validateColor = (color: string | undefined): string | null => {
    // undefined または空文字列の場合はバリデーションをスキップ（デフォルト値が使用される）
    if (!color) return null;
    // #RGB または #RRGGBB 形式をチェック
    const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    if (!hexColorRegex.test(color)) {
      return "有効な色形式で入力してください（例: #RRGGBB）";
    }
    return null;
  };

  const loadSettings = useCallback(async () => {
    if (!activeChatId) return;
    setLoading(true);
    try {
      const settings = await fetchUISettings(activeChatId);
      const loadedColors = { ...DEFAULT_COLORS, ...settings.theme_settings.colors };
      setColors(loadedColors);
      setLabels({ ...DEFAULT_LABELS, ...settings.theme_settings.labels });
      setWidgetSettings(settings.widget_settings || {});
      setBannerSettings({ ...DEFAULT_WIDGET_BANNER, ...settings.widget_settings?.banner });
      setButtonImageUrl(settings.widget_settings?.button?.imageUrl || null);
      setButtonColor(settings.widget_settings?.button?.color || "#4a90e2");

      // 読み込んだ色をバリデーション（undefinedやnullはスキップ）
      const errors: Partial<Record<keyof ThemeColors, string>> = {};
      (Object.keys(loadedColors) as (keyof ThemeColors)[]).forEach((key) => {
        const colorValue = loadedColors[key];
        if (colorValue) {  // 値が存在する場合のみバリデーション
          const error = validateColor(colorValue);
          if (error) {
            errors[key] = error;
          }
        }
      });
      setColorErrors(errors);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeChatId, setError]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Send preview update to iframe
  const sendPreviewUpdate = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    const themeSettings: ThemeSettings = { colors, labels };
    iframeRef.current.contentWindow.postMessage(
      { type: "uiSettingsPreview", settings: themeSettings },
      "*"
    );
  }, [colors, labels]);

  useEffect(() => {
    sendPreviewUpdate();
  }, [sendPreviewUpdate]);

  const handleSave = async () => {
    if (!activeChatId) {
      setError("チャットを選択してください");
      return;
    }
    // カラーバリデーションエラーがある場合は保存できない
    if (Object.keys(colorErrors).length > 0) {
      setError("色の値が正しくありません。修正してから保存してください。");
      return;
    }
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const themeSettings: ThemeSettings = { colors, labels };
      const updatedWidgetSettings: WidgetSettings = {
        ...widgetSettings,
        banner: bannerSettings,
        button: {
          ...widgetSettings.button,
          imageUrl: buttonImageUrl || undefined,
          color: buttonColor,
        },
      };
      await updateUISettings(activeChatId, themeSettings, updatedWidgetSettings);
      setStatus("デザイン設定を保存しました");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!activeChatId) return;
    setUploadingImage(true);
    setError(null);
    try {
      const result = await uploadButtonImage(activeChatId, file);
      setButtonImageUrl(result.imageUrl);
      setStatus("画像をアップロードしました");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageDelete = async () => {
    if (!activeChatId) return;
    setUploadingImage(true);
    setError(null);
    try {
      await deleteButtonImage(activeChatId);
      setButtonImageUrl(null);
      setStatus("画像を削除しました");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageUpload(file);
    }
  };

  const handleBannerChange = (key: keyof WidgetBanner, value: string) => {
    setBannerSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
    // バリデーションを実行
    const error = validateColor(value);
    setColorErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[key] = error;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const handleLabelChange = (key: keyof ThemeLabels, value: string) => {
    setLabels((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!activeChatId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">デザインを編集するチャットを選択してください</p>
        <select
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value=""
          onChange={(e) => setActiveChatId(e.target.value)}
        >
          <option value="">チャットを選択...</option>
          {chats.map((chat) => (
            <option key={chat.id} value={chat.id}>
              {chat.display_name} ({chat.id})
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left Panel - Settings */}
      <div className="flex-1 lg:max-w-[60%] space-y-4">
        {/* Chat Selector & Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">編集対象:</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={activeChatId}
                onChange={(e) => setActiveChatId(e.target.value)}
              >
                {chats.map((chat) => (
                  <option key={chat.id} value={chat.id}>
                    {chat.display_name} ({chat.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadSettings}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                リセット
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !activeChatId || Object.keys(colorErrors).length > 0}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>

        {/* Color Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection("colors")}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-semibold text-gray-900">カラー設定</h3>
            {expandedSections.colors ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>
          {expandedSections.colors && (
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(COLOR_LABELS) as (keyof ThemeColors)[]).map((key) => (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={colors[key] || DEFAULT_COLORS[key]}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <label className="text-sm text-gray-700 truncate block">
                        {COLOR_LABELS[key]}
                      </label>
                      <input
                        type="text"
                        value={colors[key] || DEFAULT_COLORS[key]}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        className={`w-full text-xs px-2 py-1 rounded border focus:ring-1 focus:outline-none ${
                          colorErrors[key]
                            ? "text-red-600 bg-red-50 border-red-300 focus:ring-red-500 focus:border-red-500"
                            : "text-gray-500 bg-gray-50 border-gray-200 focus:ring-blue-500 focus:border-blue-500"
                        }`}
                      />
                    </div>
                  </div>
                  {colorErrors[key] && (
                    <p className="text-xs text-red-600 flex items-center gap-1 ml-12">
                      <AlertCircle className="w-3 h-3" />
                      {colorErrors[key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Label Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection("labels")}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-semibold text-gray-900">テキスト設定</h3>
            {expandedSections.labels ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>
          {expandedSections.labels && (
            <div className="p-4 pt-0 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ヘッダータイトル
                </label>
                <input
                  type="text"
                  value={labels.headerTitle || ""}
                  onChange={(e) => handleLabelChange("headerTitle", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="AI Chat Bot"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  入力欄プレースホルダー
                </label>
                <input
                  type="text"
                  value={labels.inputPlaceholder || ""}
                  onChange={(e) => handleLabelChange("inputPlaceholder", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="メッセージを入力..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ウェルカムメッセージ
                </label>
                <textarea
                  value={labels.welcomeMessage || ""}
                  onChange={(e) => handleLabelChange("welcomeMessage", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="こんにちは！何かお手伝いできることはありますか？"
                />
              </div>
            </div>
          )}
        </div>

        {/* Widget Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection("widget")}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-semibold text-gray-900">ウィジェット設定</h3>
            {expandedSections.widget ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>
          {expandedSections.widget && (
            <div className="p-4 pt-0 space-y-6">
              {/* Button Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ボタン画像（省略時は絵文字表示）
                </label>
                {buttonImageUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img
                        src={buttonImageUrl}
                        alt="Button"
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        変更
                      </button>
                      <button
                        onClick={handleImageDelete}
                        disabled={uploadingImage}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        削除
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingImage ? (
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        アップロード中...
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">画像をドロップまたはクリックして選択</p>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, WebP, SVG (最大1MB)</p>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Banner Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  バナーテキスト
                </label>
                <input
                  type="text"
                  value={bannerSettings.text || ""}
                  onChange={(e) => handleBannerChange("text", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="チャットで質問できます！"
                />
              </div>

              {/* Button Color (when no image) */}
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={buttonColor}
                  onChange={(e) => setButtonColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  disabled={!!buttonImageUrl}
                />
                <div className="flex-1 min-w-0">
                  <label className="text-sm text-gray-700 block">ボタン背景色（画像未設定時）</label>
                  <input
                    type="text"
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    disabled={!!buttonImageUrl}
                    className="w-full text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Banner Colors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={bannerSettings.backgroundColor || "#4dd0e1"}
                    onChange={(e) => handleBannerChange("backgroundColor", e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <label className="text-sm text-gray-700 block">バナー背景色</label>
                    <input
                      type="text"
                      value={bannerSettings.backgroundColor || "#4dd0e1"}
                      onChange={(e) => handleBannerChange("backgroundColor", e.target.value)}
                      className="w-full text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={bannerSettings.textColor || "#000000"}
                    onChange={(e) => handleBannerChange("textColor", e.target.value)}
                    className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <label className="text-sm text-gray-700 block">バナー文字色</label>
                    <input
                      type="text"
                      value={bannerSettings.textColor || "#000000"}
                      onChange={(e) => handleBannerChange("textColor", e.target.value)}
                      className="w-full text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Widget Preview */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  ウィジェットプレビュー
                </label>
                <div className="relative bg-gray-100 rounded-lg p-6 min-h-[180px]">
                  {/* Banner Preview */}
                  <div
                    className="absolute right-4 bottom-24 flex items-center gap-3 px-4 py-3 rounded-lg shadow-md max-w-[220px]"
                    style={{
                      backgroundColor: bannerSettings.backgroundColor || "#4dd0e1",
                      color: bannerSettings.textColor || "#000000",
                    }}
                  >
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="text-sm flex-1 truncate">
                      {bannerSettings.text || "チャットで質問できます！"}
                    </span>
                    <span className="text-lg cursor-pointer opacity-70">×</span>
                  </div>

                  {/* Button Preview */}
                  <div
                    className="absolute right-4 bottom-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center overflow-hidden cursor-pointer"
                    style={{
                      backgroundColor: buttonImageUrl ? "transparent" : buttonColor,
                    }}
                  >
                    {buttonImageUrl ? (
                      <img
                        src={buttonImageUrl}
                        alt="Button"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">
                        {widgetSettings.button?.label || "💬"}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 absolute left-4 bottom-4">
                    実際のサイト上での表示イメージ
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Preview */}
      <div className="flex-1 lg:max-w-[40%]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-4">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">プレビュー</h3>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setPreviewMode("desktop")}
                className={`p-2 rounded-md transition-colors ${
                  previewMode === "desktop"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                title="デスクトップ"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewMode("mobile")}
                className={`p-2 rounded-md transition-colors ${
                  previewMode === "mobile"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                title="モバイル"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div
            className="p-4 bg-gray-100 flex justify-center"
            style={{ minHeight: "500px" }}
          >
            <div
              className={`bg-white rounded-lg shadow-lg overflow-hidden transition-all ${
                previewMode === "mobile" ? "w-[320px]" : "w-full max-w-[400px]"
              }`}
              style={{ height: previewMode === "mobile" ? "568px" : "480px" }}
            >
              <iframe
                ref={iframeRef}
                src={`${PREVIEW_BASE_URL}/index.html?chatId=${activeChatId}&preview=true`}
                className="w-full h-full border-0"
                title="Chat Preview"
                onLoad={sendPreviewUpdate}
              />
            </div>
          </div>
          <div className="p-3 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              プレビューはリアルタイムで更新されます。保存するまで変更は反映されません。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
