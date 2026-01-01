import { useState } from "react";
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Check,
  Globe,
  AlertCircle,
  CheckCircle2,
  X,
  Search,
  ArrowUpDown,
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
  loadChats,
  activeChatId,
  setActiveChatId,
  editingChatId,
  chatForm,
  setChatForm,
  submitChat,
  startEdit,
  cancelEdit,
  deleteChat,
}: ChatsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "id" | "created">("name");

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
    // シンプルなドメイン形式チェック
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

  // フィルタリングとソート
  const filteredAndSortedChats = chats
    .filter((c) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        c.id.toLowerCase().includes(query) ||
        (c.display_name || "").toLowerCase().includes(query) ||
        (c.system_prompt || "").toLowerCase().includes(query) ||
        (c.targets || [c.target]).some((t) => t.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.display_name || a.id).localeCompare(b.display_name || b.id);
        case "id":
          return a.id.localeCompare(b.id);
        case "created":
          return (b.created_at || "").localeCompare(a.created_at || "");
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-8">
      {/* 新規登録・編集フォーム */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              {editingChatId ? (
                <Edit2 className="w-5 h-5 text-blue-600" />
              ) : (
                <Plus className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {editingChatId ? "チャットを編集" : "新しいチャットを登録"}
              </h2>
              <p className="text-sm text-gray-600">
                {editingChatId
                  ? "チャットの設定を変更できます"
                  : "利用先ドメインとシステムプロンプトを設定してください"}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={submitChat} className="p-4 lg:p-6 space-y-4 lg:space-y-6">
          <div className="grid gap-4 lg:gap-6 grid-cols-1 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                チャットID（エイリアス）
              </label>
              <input
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:ring-2 focus:outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  chatIdError && chatForm.id
                    ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500/20"
                    : "border-gray-200 bg-gray-50 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white"
                }`}
                value={chatForm.id}
                onChange={(e) => setChatForm((p) => ({ ...p, id: e.target.value }))}
                disabled={Boolean(editingChatId)}
                placeholder="my-chat-bot"
                required
              />
              {chatIdError && chatForm.id && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {chatIdError}
                </p>
              )}
              {!chatIdError && chatForm.id && (
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
              rows={4}
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

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={
                Boolean(hasValidationErrors) ||
                chatForm.system_prompt.length > MAX_SYSTEM_PROMPT_LENGTH
              }
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-sm"
            >
              {editingChatId ? (
                <>
                  <Check className="w-4 h-4" />
                  更新する
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  登録する
                </>
              )}
            </button>
            {editingChatId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium rounded-xl hover:bg-gray-100 transition-all"
              >
                キャンセル
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 登録済みチャット一覧 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 lg:px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-gray-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base lg:text-lg font-semibold text-gray-900">
                  登録済みチャット
                </h2>
                <p className="text-xs lg:text-sm text-gray-500">
                  {filteredAndSortedChats.length === chats.length
                    ? `${chats.length}件登録`
                    : `${filteredAndSortedChats.length}/${chats.length}件表示`}
                </p>
              </div>
            </div>

            {/* 検索・ソート・更新 */}
            <div className="flex items-center gap-2 lg:gap-3">
              {/* 検索ボックス */}
              <div className="relative flex-1 lg:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full lg:w-48 pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                />
              </div>

              {/* ソート */}
              <div className="relative">
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "name" | "id" | "created")}
                  className="pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-blue-500 focus:outline-none cursor-pointer appearance-none"
                >
                  <option value="name">名前順</option>
                  <option value="id">ID順</option>
                  <option value="created">作成日順</option>
                </select>
              </div>

              {/* 更新ボタン */}
              <button
                onClick={loadChats}
                disabled={loadingChats}
                className="flex items-center gap-2 px-3 lg:px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-60 flex-shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${loadingChats ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">更新</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6">
          {loadingChats ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-gray-200 p-4">
                  <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="flex gap-2 mt-4">
                    <div className="h-6 bg-gray-200 rounded-full w-20" />
                    <div className="h-6 bg-gray-200 rounded-full w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                チャットがありません
              </h3>
              <p className="text-sm text-gray-500">
                上のフォームから新しいチャットを登録してください
              </p>
            </div>
          ) : filteredAndSortedChats.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                検索結果がありません
              </h3>
              <p className="text-sm text-gray-500">別のキーワードで検索してください</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedChats.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-xl border-2 p-4 transition-all cursor-pointer ${
                    activeChatId === c.id
                      ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg ring-2 ring-blue-200"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md hover:scale-[1.01]"
                  }`}
                  onClick={() => setActiveChatId(c.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {c.display_name || c.id}
                      </h3>
                      <code className="text-xs text-gray-500 font-mono">{c.id}</code>
                    </div>
                    {activeChatId === c.id && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full shadow-sm">
                        <Check className="w-3 h-3" />
                        選択中
                      </span>
                    )}
                  </div>

                  {/* システムプロンプトプレビュー */}
                  {c.system_prompt && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                      {c.system_prompt.slice(0, 100)}
                      {c.system_prompt.length > 100 ? "..." : ""}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(c.targets && c.targets.length > 0 ? c.targets : [c.target]).map((t) => (
                      <span
                        key={t}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${
                          activeChatId === c.id
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        <Globe className="w-3 h-3" />
                        {t}
                      </span>
                    ))}
                  </div>

                  <div
                    className="flex items-center gap-2 pt-3 border-t border-gray-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => startEdit(c)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                        activeChatId === c.id
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      編集
                    </button>
                    <button
                      onClick={() => deleteChat(c.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
