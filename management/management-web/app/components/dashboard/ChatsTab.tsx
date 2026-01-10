import { useEffect, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  Globe,
  AlertCircle,
  CheckCircle2,
  X,
  MessageSquare,
} from "lucide-react";
import type { ChatProfile } from "../../lib/types";

export type ChatFormData = {
  id: string;
  targets: string[];
  display_name: string;
  system_prompt: string;
};

type ChatsTabProps = {
  chats: ChatProfile[];
  loadingChats: boolean;
  loadChats: () => void;
  activeChatId: string;
  setActiveChatId: (id: string) => void;
  editingChatId: string | null;
  chatForm: ChatFormData;
  setChatForm: React.Dispatch<React.SetStateAction<ChatFormData>>;
  submitChat: (e: React.FormEvent) => void;
  startEdit: (chat: ChatProfile) => void;
  cancelEdit: () => void;
  deleteChat: (id: string) => void;
};

export function ChatsTab({
  chats,
  loadingChats,
  activeChatId,
  editingChatId,
  chatForm,
  setChatForm,
  submitChat,
  startEdit,
  cancelEdit,
  deleteChat,
}: ChatsTabProps) {
  const [isCreating, setIsCreating] = useState(false);

  // 操作対象チャットが変更されたら自動的に編集モードにする
  const activeChat = chats.find((c) => c.id === activeChatId);

  useEffect(() => {
    if (activeChat && !isCreating) {
      startEdit(activeChat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId]);

  // バリデーション
  const MAX_SYSTEM_PROMPT_LENGTH = 2000;

  const validateChatId = (id: string): string | null => {
    if (!id) return null;
    if (!/^[a-zA-Z0-9-_]+$/.test(id)) {
      return "英数字、ハイフン、アンダースコアのみ使用可能です";
    }
    if (id.length < 2) {
      return "チャットIDは2文字以上50文字以内で入力してください";
    }
    if (id.length > 50) {
      return "チャットIDは2文字以上50文字以内で入力してください";
    }
    return null;
  };

  const validateDomain = (domain: string): string | null => {
    if (!domain) return null;
    const domainRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain)) {
      return "有効なドメイン形式で入力してください（例: example.com）";
    }
    return null;
  };

  const chatIdError = validateChatId(chatForm.id);
  const domainErrors = chatForm.targets.map(validateDomain);
  const hasValidationErrors =
    (chatIdError && chatForm.id) ||
    domainErrors.some((e, i) => e && chatForm.targets[i]);

  const handleCancelCreate = () => {
    setIsCreating(false);
    cancelEdit();
    // 元のチャットに戻る
    if (activeChat) {
      startEdit(activeChat);
    }
  };

  const handleSubmitChat = (e: React.FormEvent) => {
    submitChat(e);
    setIsCreating(false);
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    cancelEdit();
    setChatForm({ id: "", targets: [""], display_name: "", system_prompt: "" });
  };

  const handleDeleteChat = () => {
    if (activeChatId) {
      deleteChat(activeChatId);
    }
  };

  // ローディング中
  if (loadingChats) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  // チャットが1つもない場合
  if (chats.length === 0 && !isCreating) {
    return (
      <div className="space-y-6">
        <button
          onClick={handleStartCreate}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          新規チャットを作成
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            チャットがありません
          </h3>
          <p className="text-sm text-gray-500">
            上のボタンから新しいチャットを作成してください
          </p>
        </div>
      </div>
    );
  }

  // チャットが選択されていない場合
  if (!activeChatId && !isCreating) {
    return (
      <div className="space-y-6">
        <button
          onClick={handleStartCreate}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          新規チャットを作成
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Edit2 className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            編集するチャットを選択してください
          </h3>
          <p className="text-sm text-gray-500">
            左のサイドバーから操作対象のチャットを選択すると、ここで編集できます
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 新規作成ボタン */}
      {!isCreating && (
        <button
          onClick={handleStartCreate}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          新規チャットを作成
        </button>
      )}

      {/* 編集フォーム */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                {isCreating ? (
                  <Plus className="w-5 h-5 text-blue-600" />
                ) : (
                  <Edit2 className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {isCreating ? "新しいチャットを登録" : `チャットを編集`}
                </h2>
                <p className="text-sm text-gray-600">
                  {isCreating
                    ? "利用先ドメインとシステムプロンプトを設定してください"
                    : `ID: ${activeChatId}`}
                </p>
              </div>
            </div>
            {!isCreating && (
              <button
                onClick={handleDeleteChat}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4" />
                削除
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmitChat} className="p-4 lg:p-6 space-y-4 lg:space-y-6">
          <div className="grid gap-4 lg:gap-6 grid-cols-1 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                チャットID（変更不可）
              </label>
              <input
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:ring-2 focus:outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  chatIdError && chatForm.id
                    ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/20"
                    : "border-gray-200 bg-gray-50 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white"
                }`}
                value={chatForm.id}
                onChange={(e) => setChatForm((p) => ({ ...p, id: e.target.value }))}
                disabled={!isCreating}
                placeholder="my-chat-bot"
                required
              />
              {chatIdError && chatForm.id && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {chatIdError}
                </p>
              )}
              {!chatIdError && chatForm.id && isCreating && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  有効なIDです
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                表示名
              </label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:outline-none transition-all"
                value={chatForm.display_name}
                onChange={(e) =>
                  setChatForm((p) => ({ ...p, display_name: e.target.value }))
                }
                placeholder="カスタマーサポートBot"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              利用先ドメイン（複数可）
            </label>
            <div className="space-y-3">
              {chatForm.targets.map((t, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <Globe
                        className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${
                          domainErrors[idx] && t ? "text-red-400" : "text-gray-400"
                        }`}
                      />
                      <input
                        className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm focus:ring-2 focus:outline-none transition-all ${
                          domainErrors[idx] && t
                            ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/20"
                            : "border-gray-200 bg-gray-50 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white"
                        }`}
                        value={t}
                        onChange={(e) =>
                          setChatForm((p) => {
                            const next = [...p.targets];
                            next[idx] = e.target.value;
                            return { ...p, targets: next };
                          })
                        }
                        placeholder="example.com"
                        required
                      />
                    </div>
                    {chatForm.targets.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setChatForm((p) => ({
                            ...p,
                            targets: p.targets.filter((_, i) => i !== idx),
                          }))
                        }
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  {domainErrors[idx] && t && (
                    <p className="text-xs text-red-600 flex items-center gap-1 pl-1">
                      <AlertCircle className="w-3 h-3" />
                      {domainErrors[idx]}
                    </p>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setChatForm((p) => ({ ...p, targets: [...p.targets, ""] }))}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                ドメインを追加
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                システムプロンプト
              </label>
              <span
                className={`text-xs ${
                  chatForm.system_prompt.length > MAX_SYSTEM_PROMPT_LENGTH
                    ? "text-red-600 font-medium"
                    : chatForm.system_prompt.length > MAX_SYSTEM_PROMPT_LENGTH * 0.9
                      ? "text-amber-600"
                      : "text-gray-400"
                }`}
              >
                {chatForm.system_prompt.length.toLocaleString()} /{" "}
                {MAX_SYSTEM_PROMPT_LENGTH.toLocaleString()}
              </span>
            </div>
            <textarea
              className={`w-full px-4 py-3 rounded-xl border text-sm focus:ring-2 focus:outline-none transition-all resize-none ${
                chatForm.system_prompt.length > MAX_SYSTEM_PROMPT_LENGTH
                  ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/20"
                  : "border-gray-200 bg-gray-50 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white"
              }`}
              rows={6}
              value={chatForm.system_prompt}
              onChange={(e) =>
                setChatForm((p) => ({ ...p, system_prompt: e.target.value }))
              }
              placeholder="このチャット向けの回答方針を入力してください..."
            />
            {chatForm.system_prompt.length > MAX_SYSTEM_PROMPT_LENGTH && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                文字数が上限を超えています
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={
                Boolean(hasValidationErrors) ||
                chatForm.system_prompt.length > MAX_SYSTEM_PROMPT_LENGTH
              }
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-sm"
            >
              {isCreating ? (
                <>
                  <Plus className="w-4 h-4" />
                  登録する
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  更新する
                </>
              )}
            </button>
            {isCreating && (
              <button
                type="button"
                onClick={handleCancelCreate}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium rounded-xl hover:bg-gray-100 transition-all"
              >
                キャンセル
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
