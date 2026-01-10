import { useState } from "react";
import {
  MessageSquare,
  Database,
  RefreshCw,
  Trash2,
  Globe,
  AlertCircle,
  FileText,
  Link as LinkIcon,
  Type,
  Upload,
  ExternalLink,
  Search,
} from "lucide-react";
import type { ChatProfile, KnowledgeAsset } from "../../lib/types";
import { StatusBadge } from "./StatusBadge";

type KnowledgeTabProps = {
  activeChat: ChatProfile | null;
  knowledge: KnowledgeAsset[];
  loadingKnowledge: boolean;
  loadKnowledge: () => void;
  fileForm: { title: string; file: File | null };
  setFileForm: React.Dispatch<React.SetStateAction<{ title: string; file: File | null }>>;
  urlForm: { url: string; title: string };
  setUrlForm: React.Dispatch<React.SetStateAction<{ url: string; title: string }>>;
  textForm: { title: string; content: string };
  setTextForm: React.Dispatch<React.SetStateAction<{ title: string; content: string }>>;
  submitFile: (e: React.FormEvent) => void;
  submitURL: (e: React.FormEvent) => void;
  submitText: (e: React.FormEvent) => void;
  activeChatId: string;
  submittingFile: boolean;
  submittingURL: boolean;
  submittingText: boolean;
  deleteKnowledge: (id: string) => void;
  onViewKnowledge: (knowledge: KnowledgeAsset) => void;
};

export function KnowledgeTab({
  activeChat,
  knowledge,
  loadingKnowledge,
  loadKnowledge,
  fileForm,
  setFileForm,
  urlForm,
  setUrlForm,
  textForm,
  setTextForm,
  submitFile,
  submitURL,
  submitText,
  activeChatId,
  submittingFile,
  submittingURL,
  submittingText,
  deleteKnowledge,
  onViewKnowledge,
}: KnowledgeTabProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");

  // ドラッグ&ドロップハンドラ
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setFileForm((p) => ({ ...p, file: files[0] }));
    }
  };

  // ナレッジ検索フィルタ
  const filteredKnowledge = knowledge.filter((k) => {
    if (!knowledgeSearch.trim()) return true;
    const query = knowledgeSearch.toLowerCase();
    return (
      (k.title || "").toLowerCase().includes(query) ||
      (k.original_filename || "").toLowerCase().includes(query) ||
      (k.source_url || "").toLowerCase().includes(query) ||
      k.chat_id.toLowerCase().includes(query)
    );
  });

  if (!activeChatId) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-amber-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">
          チャットを選択してください
        </h2>
        <p className="text-gray-500 mb-6">
          ナレッジを投入するには、まず「チャット管理」タブで操作対象のチャットを選択してください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 操作対象チャット情報 */}
      {activeChat && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-4 lg:p-6">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs lg:text-sm text-blue-600 font-medium">操作対象チャット</p>
              <h3 className="text-base lg:text-lg font-bold text-gray-900 truncate">
                {activeChat.display_name || activeChat.id}
              </h3>
              <div className="flex flex-wrap gap-1.5 lg:gap-2 mt-2">
                {(activeChat.targets && activeChat.targets.length > 0
                  ? activeChat.targets
                  : [activeChat.target]
                ).map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 lg:px-2.5 py-0.5 lg:py-1 bg-white text-gray-700 text-xs font-medium rounded-full shadow-sm"
                  >
                    <Globe className="w-3 h-3" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ナレッジ投入フォーム */}
      <div className="grid gap-4 lg:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* ファイルアップロード */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">ファイル</h3>
                <p className="text-xs text-gray-500">PDF / TXT / DOCX</p>
              </div>
            </div>
          </div>
          <form onSubmit={submitFile} className="p-5 space-y-4">
            <input
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:bg-white focus:outline-none transition-all"
              placeholder="タイトル（任意）"
              value={fileForm.title}
              onChange={(e) => setFileForm((p) => ({ ...p, title: e.target.value }))}
              disabled={submittingFile}
            />
            <div
              className="relative"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={(e) =>
                  setFileForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))
                }
                required
                disabled={submittingFile}
              />
              <div
                className={`flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed transition-all ${
                  isDragging
                    ? "border-violet-500 bg-violet-100"
                    : fileForm.file
                      ? "border-violet-300 bg-violet-50"
                      : "border-gray-200 hover:border-violet-300 hover:bg-violet-50/50"
                }`}
              >
                <Upload
                  className={`w-8 h-8 ${isDragging ? "text-violet-600" : "text-gray-400"}`}
                />
                <div className="text-center">
                  <span className="text-sm font-medium text-gray-700">
                    {fileForm.file ? fileForm.file.name : "ドラッグ&ドロップ"}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {fileForm.file
                      ? `${(fileForm.file.size / 1024).toFixed(1)} KB`
                      : "またはクリックして選択"}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={!activeChatId || submittingFile}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all"
            >
              {submittingFile ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  アップロード
                </>
              )}
            </button>
          </form>
        </div>

        {/* URL取り込み */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <LinkIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">URL取り込み</h3>
                <p className="text-xs text-gray-500">Webページを取得</p>
              </div>
            </div>
          </div>
          <form onSubmit={submitURL} className="p-5 space-y-4">
            <div className="relative">
              <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:outline-none transition-all"
                placeholder="https://example.com"
                value={urlForm.url}
                onChange={(e) => setUrlForm((p) => ({ ...p, url: e.target.value }))}
                required
                disabled={submittingURL}
              />
            </div>
            <input
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:outline-none transition-all"
              placeholder="タイトル（任意）"
              value={urlForm.title}
              onChange={(e) => setUrlForm((p) => ({ ...p, title: e.target.value }))}
              disabled={submittingURL}
            />
            <button
              type="submit"
              disabled={!activeChatId || submittingURL}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all"
            >
              {submittingURL ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  取り込み中...
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4" />
                  取り込む
                </>
              )}
            </button>
          </form>
        </div>

        {/* テキスト */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Type className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">テキスト</h3>
                <p className="text-xs text-gray-500">直接入力</p>
              </div>
            </div>
          </div>
          <form onSubmit={submitText} className="p-5 space-y-4">
            <input
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:bg-white focus:outline-none transition-all"
              placeholder="タイトル（任意）"
              value={textForm.title}
              onChange={(e) => setTextForm((p) => ({ ...p, title: e.target.value }))}
              disabled={submittingText}
            />
            <textarea
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:bg-white focus:outline-none transition-all resize-none"
              rows={4}
              placeholder="登録したいテキスト..."
              value={textForm.content}
              onChange={(e) => setTextForm((p) => ({ ...p, content: e.target.value }))}
              required
              disabled={submittingText}
            />
            <button
              type="submit"
              disabled={!activeChatId || submittingText}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all"
            >
              {submittingText ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  登録中...
                </>
              ) : (
                <>
                  <Type className="w-4 h-4" />
                  登録する
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ナレッジ一覧 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 lg:px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Database className="w-5 h-5 text-gray-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base lg:text-lg font-semibold text-gray-900">
                  最近のナレッジ
                </h2>
                <p className="text-xs lg:text-sm text-gray-500">
                  {filteredKnowledge.length === knowledge.length
                    ? `${knowledge.length}件登録`
                    : `${filteredKnowledge.length}/${knowledge.length}件表示`}
                </p>
              </div>
            </div>

            {/* 検索・更新 */}
            <div className="flex items-center gap-2 lg:gap-3">
              {/* 検索ボックス */}
              <div className="relative flex-1 lg:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ナレッジを検索..."
                  value={knowledgeSearch}
                  onChange={(e) => setKnowledgeSearch(e.target.value)}
                  className="w-full lg:w-48 pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                />
              </div>

              {/* 更新ボタン */}
              <button
                onClick={loadKnowledge}
                disabled={loadingKnowledge}
                className="flex items-center gap-2 px-3 lg:px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-60 flex-shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${loadingKnowledge ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">更新</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6">
          {loadingKnowledge ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse flex items-center gap-4 p-4 rounded-xl bg-gray-50"
                >
                  <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : knowledge.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ナレッジがありません
              </h3>
              <p className="text-sm text-gray-500">
                上のフォームからナレッジを投入してください
              </p>
            </div>
          ) : filteredKnowledge.length === 0 ? (
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
            <div className="space-y-3">
              {filteredKnowledge.map((k) => (
                <div
                  key={k.id}
                  onClick={() => onViewKnowledge(k)}
                  className="flex items-start gap-3 lg:gap-4 p-3 lg:p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all group cursor-pointer"
                >
                  <div
                    className={`w-8 h-8 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      k.type === "file"
                        ? "bg-violet-100"
                        : k.type === "url"
                          ? "bg-emerald-100"
                          : "bg-amber-100"
                    }`}
                  >
                    {k.type === "file" ? (
                      <FileText className="w-4 h-4 lg:w-5 lg:h-5 text-violet-600" />
                    ) : k.type === "url" ? (
                      <LinkIcon className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-600" />
                    ) : (
                      <Type className="w-4 h-4 lg:w-5 lg:h-5 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm lg:text-base text-gray-900 truncate max-w-full">
                        {k.title || k.original_filename || "(タイトルなし)"}
                      </h4>
                      <StatusBadge status={k.status} />
                    </div>
                    {k.source_url && (
                      <p className="text-xs text-gray-500 truncate mb-1">{k.source_url}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 lg:gap-3 text-xs text-gray-400">
                      <span>{new Date(k.created_at).toLocaleString()}</span>
                      <span className="font-mono truncate">{k.chat_id}</span>
                    </div>
                    {k.error_message && (
                      <p className="text-xs text-red-600 mt-1 break-words">
                        エラー: {k.error_message}
                      </p>
                    )}
                  </div>
                  {/* 削除ボタン */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteKnowledge(k.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 lg:opacity-100 flex-shrink-0"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
