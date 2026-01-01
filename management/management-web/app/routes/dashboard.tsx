import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getFirebaseAuth } from "../lib/firebase";
import { apiBase, apiFetch, AuthError } from "../lib/api";
import type { ChatProfile, KnowledgeAsset, User } from "../lib/types";
import {
  MessageSquare,
  Database,
  LogOut,
  Book,
  ChevronDown,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Check,
  Globe,
  FileText,
  Link as LinkIcon,
  Type,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  Upload,
  ExternalLink,
  Bot,
  Menu,
  Search,
  ArrowUpDown,
} from "lucide-react";

export function meta() {
  return [
    { title: "ダッシュボード | Management" },
    { name: "description", content: "チャット設定とナレッジ投入" },
  ];
}

export default function Dashboard() {
  const nav = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [chats, setChats] = useState<ChatProfile[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeAsset[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chats" | "knowledge">("chats");
  const emptyChatForm = { id: "", targets: [""], display_name: "", system_prompt: "" };
  const [chatForm, setChatForm] = useState(emptyChatForm);
  const [fileForm, setFileForm] = useState<{ title: string; file: File | null }>({
    title: "",
    file: null,
  });
  const [urlForm, setUrlForm] = useState({ url: "", title: "" });
  const [textForm, setTextForm] = useState({ title: "", content: "" });
  const [submittingFile, setSubmittingFile] = useState(false);
  const [submittingURL, setSubmittingURL] = useState(false);
  const [submittingText, setSubmittingText] = useState(false);
  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        nav("/login");
        return;
      }
      try {
        const me = await apiFetch<{ user: User }>("/api/auth/me");
        setUser(me.user);
        loadChats();
        loadKnowledge();
      } catch (err) {
        if (err instanceof AuthError) {
          nav("/login");
        } else {
          setError((err as Error).message);
        }
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadChats = async () => {
    setLoadingChats(true);
    setError(null);
    try {
      const res = await apiFetch<{ chats: ChatProfile[] }>("/api/chats");
      const list = res.chats || [];
      setChats(list);
      setActiveChatId((prev) => {
        if (prev && list.some((c) => c.id === prev)) {
          return prev;
        }
        return list[0]?.id || "";
      });
    } catch (err) {
      if (err instanceof AuthError) {
        nav("/login");
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoadingChats(false);
    }
  };

  const loadKnowledge = async () => {
    setLoadingKnowledge(true);
    setError(null);
    try {
      const res = await apiFetch<{ items: KnowledgeAsset[] }>("/api/knowledge");
      setKnowledge(res.items || []);
    } catch (err) {
      if (err instanceof AuthError) {
        nav("/login");
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoadingKnowledge(false);
    }
  };

  const submitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    try {
      const targets = chatForm.targets.map((t) => t.trim()).filter(Boolean);
      if (targets.length === 0) {
        setError("利用先ドメインを1つ以上入力してください");
        return;
      }
      if (editingChatId) {
        const res = await apiFetch<ChatProfile>(`/api/chats/${editingChatId}`, {
          method: "PUT",
          body: JSON.stringify({
            targets,
            display_name: chatForm.display_name || chatForm.id,
            system_prompt: chatForm.system_prompt,
          }),
        });
        setStatus(`チャット ${res.id} を更新しました`);
        setActiveChatId(res.id);
      } else {
        const res = await apiFetch<ChatProfile>("/api/chats", {
          method: "POST",
          body: JSON.stringify({
            id: chatForm.id,
            targets,
            display_name: chatForm.display_name || chatForm.id,
            system_prompt: chatForm.system_prompt,
          }),
        });
        setStatus(`チャット ${res.id} を作成し、操作対象に設定しました`);
        setActiveChatId(res.id);
      }
      setChatForm(emptyChatForm);
      setEditingChatId(null);
      loadChats();
    } catch (err) {
      if (err instanceof AuthError) {
        nav("/login");
      } else {
        setError((err as Error).message);
      }
    }
  };

  const submitFile = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    if (!activeChatId) {
      setError("先に操作するチャットを選択してください");
      return;
    }
    if (!fileForm.file) {
      setError("ファイルを選択してください");
      return;
    }
    setSubmittingFile(true);
    const formData = new FormData();
    formData.append("chat_id", activeChatId);
    formData.append("title", fileForm.title);
    formData.append("file", fileForm.file);
    try {
      const currentUser = getFirebaseAuth().currentUser;
      const idToken = currentUser ? await currentUser.getIdToken() : "";
      const res = await fetch(`${apiBase}/api/knowledge/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });
      const data = (await res.json()) as { error?: string };
      if (res.status === 401) {
        nav("/login");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "アップロードに失敗しました");
      }
      setStatus("ファイルを登録しました");
      setFileForm({ title: "", file: null });
      loadKnowledge();
    } catch (err) {
      if (err instanceof AuthError) {
        nav("/login");
      } else {
        setError((err as Error).message);
      }
    } finally {
      setSubmittingFile(false);
    }
  };

  const submitURL = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    if (!activeChatId) {
      setError("先に操作するチャットを選択してください");
      return;
    }
    setSubmittingURL(true);
    try {
      await apiFetch("/api/knowledge/urls", {
        method: "POST",
        body: JSON.stringify({ ...urlForm, chat_id: activeChatId }),
      });
      setStatus("URLを登録しました");
      setUrlForm({ url: "", title: "" });
      loadKnowledge();
    } catch (err) {
      if (err instanceof AuthError) {
        nav("/login");
      } else {
        setError((err as Error).message);
      }
    } finally {
      setSubmittingURL(false);
    }
  };

  const submitText = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    if (!activeChatId) {
      setError("先に操作するチャットを選択してください");
      return;
    }
    setSubmittingText(true);
    try {
      await apiFetch("/api/knowledge/texts", {
        method: "POST",
        body: JSON.stringify({ ...textForm, chat_id: activeChatId }),
      });
      setStatus("テキストを登録しました");
      setTextForm({ title: "", content: "" });
      loadKnowledge();
    } catch (err) {
      if (err instanceof AuthError) {
        nav("/login");
      } else {
        setError((err as Error).message);
      }
    } finally {
      setSubmittingText(false);
    }
  };

  const deleteKnowledge = async (id: string) => {
    if (!window.confirm("このナレッジを削除しますか？")) return;
    setStatus(null);
    setError(null);
    try {
      await apiFetch(`/api/knowledge/${id}`, { method: "DELETE" });
      setStatus("ナレッジを削除しました");
      loadKnowledge();
    } catch (err) {
      if (err instanceof AuthError) {
        nav("/login");
      } else {
        setError((err as Error).message);
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(getFirebaseAuth());
      await apiFetch("/api/auth/logout", { method: "POST", skipAuthError: true });
    } catch {
      // ignore
    } finally {
      nav("/login");
    }
  };

  const startEdit = (chat: ChatProfile) => {
    setEditingChatId(chat.id);
    setActiveChatId(chat.id);
    setChatForm({
      id: chat.id,
      targets: chat.targets && chat.targets.length > 0 ? chat.targets : [chat.target],
      display_name: chat.display_name,
      system_prompt: chat.system_prompt,
    });
    setStatus(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingChatId(null);
    setChatForm(emptyChatForm);
  };

  const deleteChat = async (id: string) => {
    if (!window.confirm(`チャット ${id} を削除しますか？`)) return;
    setStatus(null);
    setError(null);
    try {
      await apiFetch(`/api/chats/${id}`, { method: "DELETE" });
      setStatus(`チャット ${id} を削除しました`);
      if (activeChatId === id) {
        setActiveChatId("");
      }
      if (editingChatId === id) {
        cancelEdit();
      }
      loadChats();
    } catch (err) {
      if (err instanceof AuthError) {
        nav("/login");
      } else {
        setError((err as Error).message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* モバイルオーバーレイ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside className={`w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-50 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* ロゴ */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">AI Chat</span>
          </div>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => { setActiveTab("chats"); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "chats"
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            チャット管理
          </button>
          <button
            onClick={() => { setActiveTab("knowledge"); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === "knowledge"
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <Database className="w-5 h-5" />
            ナレッジ投入
          </button>
          <Link
            to="/docs"
            onClick={() => setSidebarOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
          >
            <Book className="w-5 h-5" />
            埋め込みガイド
          </Link>
        </nav>

        {/* ユーザー情報 */}
        <div className="p-4 border-t border-gray-200">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-all"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {user?.email?.charAt(0).toUpperCase() || "?"}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.email || "ログイン中..."}
                </p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 lg:ml-64">
        {/* ヘッダー */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-8 sticky top-0 z-10">
          <div className="flex items-center justify-between w-full gap-4">
            <div className="flex items-center gap-3">
              {/* モバイルメニューボタン */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl lg:hidden"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-lg lg:text-xl font-bold text-gray-900">
                  {activeTab === "chats" ? "チャット管理" : "ナレッジ投入"}
                </h1>
                <p className="text-xs lg:text-sm text-gray-500 hidden sm:block">
                  {activeTab === "chats"
                    ? "チャットAIの登録・編集・削除を行います"
                    : "選択したチャットにナレッジを追加します"}
                </p>
              </div>
            </div>

            {/* 操作対象チャット */}
            {activeTab === "knowledge" && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-blue-50 px-3 lg:px-4 py-2 rounded-xl">
                  <span className="text-xs lg:text-sm text-blue-600 font-medium hidden sm:inline">操作対象:</span>
                  <select
                    className="bg-transparent border-none text-xs lg:text-sm font-semibold text-blue-700 focus:outline-none cursor-pointer max-w-[120px] lg:max-w-none"
                    value={activeChatId}
                    onChange={(e) => setActiveChatId(e.target.value)}
                  >
                    <option value="">チャットを選択</option>
                    {chats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.display_name || c.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* 通知 */}
        {(status || error) && (
          <div className="px-4 lg:px-8 pt-4">
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                status
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {status ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{status || error}</span>
              <button
                onClick={() => {
                  setStatus(null);
                  setError(null);
                }}
                className="ml-auto p-1 hover:bg-black/5 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="p-4 lg:p-8">
          {activeTab === "chats" ? (
            <ChatsTab
              chats={chats}
              loadingChats={loadingChats}
              loadChats={loadChats}
              activeChatId={activeChatId}
              setActiveChatId={setActiveChatId}
              editingChatId={editingChatId}
              chatForm={chatForm}
              setChatForm={setChatForm}
              submitChat={submitChat}
              startEdit={startEdit}
              cancelEdit={cancelEdit}
              deleteChat={deleteChat}
            />
          ) : (
            <KnowledgeTab
              activeChat={activeChat}
              knowledge={knowledge}
              loadingKnowledge={loadingKnowledge}
              loadKnowledge={loadKnowledge}
              fileForm={fileForm}
              setFileForm={setFileForm}
              urlForm={urlForm}
              setUrlForm={setUrlForm}
              textForm={textForm}
              setTextForm={setTextForm}
              submitFile={submitFile}
              submitURL={submitURL}
              submitText={submitText}
              activeChatId={activeChatId}
              submittingFile={submittingFile}
              submittingURL={submittingURL}
              submittingText={submittingText}
              deleteKnowledge={deleteKnowledge}
            />
          )}
        </div>

      </main>
    </div>
  );
}

// チャット管理タブ
function ChatsTab({
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
}: {
  chats: ChatProfile[];
  loadingChats: boolean;
  loadChats: () => void;
  activeChatId: string;
  setActiveChatId: (id: string) => void;
  editingChatId: string | null;
  chatForm: { id: string; targets: string[]; display_name: string; system_prompt: string };
  setChatForm: React.Dispatch<React.SetStateAction<{ id: string; targets: string[]; display_name: string; system_prompt: string }>>;
  submitChat: (e: React.FormEvent) => void;
  startEdit: (chat: ChatProfile) => void;
  cancelEdit: () => void;
  deleteChat: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "id" | "created">("name");

  // バリデーション
  const MAX_SYSTEM_PROMPT_LENGTH = 2000;

  const validateChatId = (id: string): string | null => {
    if (!id) return null;
    if (!/^[a-zA-Z0-9-_]+$/.test(id)) {
      return "英数字、ハイフン、アンダースコアのみ使用可能です";
    }
    if (id.length < 3) {
      return "3文字以上で入力してください";
    }
    if (id.length > 50) {
      return "50文字以内で入力してください";
    }
    return null;
  };

  const validateDomain = (domain: string): string | null => {
    if (!domain) return null;
    // シンプルなドメイン形式チェック
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain)) {
      return "有効なドメイン形式で入力してください（例: example.com）";
    }
    return null;
  };

  const chatIdError = validateChatId(chatForm.id);
  const domainErrors = chatForm.targets.map(validateDomain);
  const hasValidationErrors = (chatIdError && chatForm.id) || domainErrors.some((e, i) => e && chatForm.targets[i]);

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
              {editingChatId ? <Edit2 className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
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
                onChange={(e) => setChatForm((p) => ({ ...p, display_name: e.target.value }))}
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
                      <Globe className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${
                        domainErrors[idx] && t ? "text-red-400" : "text-gray-400"
                      }`} />
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
              <span className={`text-xs ${
                chatForm.system_prompt.length > MAX_SYSTEM_PROMPT_LENGTH
                  ? "text-red-600 font-medium"
                  : chatForm.system_prompt.length > MAX_SYSTEM_PROMPT_LENGTH * 0.9
                    ? "text-amber-600"
                    : "text-gray-400"
              }`}>
                {chatForm.system_prompt.length.toLocaleString()} / {MAX_SYSTEM_PROMPT_LENGTH.toLocaleString()}
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
              onChange={(e) => setChatForm((p) => ({ ...p, system_prompt: e.target.value }))}
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
              disabled={Boolean(hasValidationErrors) || chatForm.system_prompt.length > MAX_SYSTEM_PROMPT_LENGTH}
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
                <h2 className="text-base lg:text-lg font-semibold text-gray-900">登録済みチャット</h2>
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">チャットがありません</h3>
              <p className="text-sm text-gray-500">上のフォームから新しいチャットを登録してください</p>
            </div>
          ) : filteredAndSortedChats.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">検索結果がありません</h3>
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
                      {c.system_prompt.slice(0, 100)}{c.system_prompt.length > 100 ? '...' : ''}
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

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
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

// ナレッジ投入タブ
function KnowledgeTab({
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
}: {
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
}) {
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
        <h2 className="text-xl font-semibold text-gray-900 mb-3">チャットを選択してください</h2>
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
              <h3 className="text-base lg:text-lg font-bold text-gray-900 truncate">{activeChat.display_name || activeChat.id}</h3>
              <div className="flex flex-wrap gap-1.5 lg:gap-2 mt-2">
                {(activeChat.targets && activeChat.targets.length > 0 ? activeChat.targets : [activeChat.target]).map((t) => (
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
                onChange={(e) => setFileForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
                required
                disabled={submittingFile}
              />
              <div className={`flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed transition-all ${
                isDragging
                  ? "border-violet-500 bg-violet-100"
                  : fileForm.file
                    ? "border-violet-300 bg-violet-50"
                    : "border-gray-200 hover:border-violet-300 hover:bg-violet-50/50"
              }`}>
                <Upload className={`w-8 h-8 ${isDragging ? "text-violet-600" : "text-gray-400"}`} />
                <div className="text-center">
                  <span className="text-sm font-medium text-gray-700">
                    {fileForm.file ? fileForm.file.name : "ドラッグ&ドロップ"}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {fileForm.file ? `${(fileForm.file.size / 1024).toFixed(1)} KB` : "またはクリックして選択"}
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
                <h2 className="text-base lg:text-lg font-semibold text-gray-900">最近のナレッジ</h2>
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
                <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-xl bg-gray-50">
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">ナレッジがありません</h3>
              <p className="text-sm text-gray-500">上のフォームからナレッジを投入してください</p>
            </div>
          ) : filteredKnowledge.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">検索結果がありません</h3>
              <p className="text-sm text-gray-500">別のキーワードで検索してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredKnowledge.map((k) => (
                <div key={k.id} className="flex items-start gap-3 lg:gap-4 p-3 lg:p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all group">
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
                      <p className="text-xs text-red-600 mt-1 break-words">エラー: {k.error_message}</p>
                    )}
                  </div>
                  {/* 削除ボタン */}
                  <button
                    onClick={() => deleteKnowledge(k.id)}
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

// ステータスバッジ
function StatusBadge({ status }: { status: string }) {
  if (status === "succeeded") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
        <CheckCircle2 className="w-3 h-3" />
        完了
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
        <AlertCircle className="w-3 h-3" />
        失敗
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
      <Clock className="w-3 h-3" />
      処理中
    </span>
  );
}
