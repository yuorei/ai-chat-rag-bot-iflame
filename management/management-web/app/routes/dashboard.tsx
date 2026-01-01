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
  const [activeTab, setActiveTab] = useState<"chats" | "knowledge">("chats");
  const emptyChatForm = { id: "", targets: [""], display_name: "", system_prompt: "" };
  const [chatForm, setChatForm] = useState(emptyChatForm);
  const [fileForm, setFileForm] = useState<{ title: string; file: File | null }>({
    title: "",
    file: null,
  });
  const [urlForm, setUrlForm] = useState({ url: "", title: "" });
  const [textForm, setTextForm] = useState({ title: "", content: "" });
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
      {/* サイドバー */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full">
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
            onClick={() => setActiveTab("chats")}
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
            onClick={() => setActiveTab("knowledge")}
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
      <main className="flex-1 ml-64">
        {/* ヘッダー */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 sticky top-0 z-10">
          <div className="flex items-center justify-between w-full">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {activeTab === "chats" ? "チャット管理" : "ナレッジ投入"}
              </h1>
              <p className="text-sm text-gray-500">
                {activeTab === "chats"
                  ? "チャットAIの登録・編集・削除を行います"
                  : "選択したチャットにナレッジを追加します"}
              </p>
            </div>

            {/* 操作対象チャット */}
            {activeTab === "knowledge" && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl">
                  <span className="text-sm text-blue-600 font-medium">操作対象:</span>
                  <select
                    className="bg-transparent border-none text-sm font-semibold text-blue-700 focus:outline-none cursor-pointer"
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
          <div className="px-8 pt-4">
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

        <div className="p-8">
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

        <form onSubmit={submitChat} className="p-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                チャットID（エイリアス）
              </label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                value={chatForm.id}
                onChange={(e) => setChatForm((p) => ({ ...p, id: e.target.value }))}
                disabled={Boolean(editingChatId)}
                placeholder="my-chat-bot"
                required
              />
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
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:outline-none transition-all"
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
            <label className="block text-sm font-medium text-gray-700">
              システムプロンプト
            </label>
            <textarea
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:outline-none transition-all resize-none"
              rows={4}
              value={chatForm.system_prompt}
              onChange={(e) => setChatForm((p) => ({ ...p, system_prompt: e.target.value }))}
              placeholder="このチャット向けの回答方針を入力してください..."
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-sm"
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
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">登録済みチャット</h2>
              <p className="text-sm text-gray-500">{chats.length}件のチャットが登録されています</p>
            </div>
          </div>
          <button
            onClick={loadChats}
            disabled={loadingChats}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loadingChats ? "animate-spin" : ""}`} />
            更新
          </button>
        </div>

        <div className="p-6">
          {loadingChats ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {chats.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-xl border-2 p-4 transition-all ${
                    activeChatId === c.id
                      ? "border-blue-500 bg-blue-50/50 shadow-md"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {c.display_name || c.id}
                      </h3>
                      <code className="text-xs text-gray-500 font-mono">{c.id}</code>
                    </div>
                    {activeChatId === c.id && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                        <Check className="w-3 h-3" />
                        選択中
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(c.targets && c.targets.length > 0 ? c.targets : [c.target]).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full"
                      >
                        <Globe className="w-3 h-3" />
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => setActiveChatId(c.id)}
                      disabled={activeChatId === c.id}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                        activeChatId === c.id
                          ? "bg-blue-600 text-white cursor-default"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {activeChatId === c.id ? "選択中" : "選択"}
                    </button>
                    <button
                      onClick={() => startEdit(c)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteChat(c.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
}) {
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
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-600 font-medium">操作対象チャット</p>
              <h3 className="text-lg font-bold text-gray-900">{activeChat.display_name || activeChat.id}</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {(activeChat.targets && activeChat.targets.length > 0 ? activeChat.targets : [activeChat.target]).map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-gray-700 text-xs font-medium rounded-full shadow-sm"
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
      <div className="grid gap-6 md:grid-cols-3">
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
            />
            <div className="relative">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={(e) => setFileForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
                required
              />
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-300 hover:bg-violet-50/50 transition-all">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-500 truncate">
                  {fileForm.file ? fileForm.file.name : "ファイルを選択..."}
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={!activeChatId}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white font-medium rounded-xl transition-all"
            >
              <Upload className="w-4 h-4" />
              アップロード
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
              />
            </div>
            <input
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:outline-none transition-all"
              placeholder="タイトル（任意）"
              value={urlForm.title}
              onChange={(e) => setUrlForm((p) => ({ ...p, title: e.target.value }))}
            />
            <button
              type="submit"
              disabled={!activeChatId}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-medium rounded-xl transition-all"
            >
              <LinkIcon className="w-4 h-4" />
              取り込む
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
            />
            <textarea
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:bg-white focus:outline-none transition-all resize-none"
              rows={4}
              placeholder="登録したいテキスト..."
              value={textForm.content}
              onChange={(e) => setTextForm((p) => ({ ...p, content: e.target.value }))}
              required
            />
            <button
              type="submit"
              disabled={!activeChatId}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-medium rounded-xl transition-all"
            >
              <Type className="w-4 h-4" />
              登録する
            </button>
          </form>
        </div>
      </div>

      {/* ナレッジ一覧 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">最近のナレッジ</h2>
              <p className="text-sm text-gray-500">{knowledge.length}件のナレッジが登録されています</p>
            </div>
          </div>
          <button
            onClick={loadKnowledge}
            disabled={loadingKnowledge}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loadingKnowledge ? "animate-spin" : ""}`} />
            更新
          </button>
        </div>

        <div className="p-6">
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
          ) : (
            <div className="space-y-3">
              {knowledge.map((k) => (
                <div key={k.id} className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      k.type === "file"
                        ? "bg-violet-100"
                        : k.type === "url"
                          ? "bg-emerald-100"
                          : "bg-amber-100"
                    }`}
                  >
                    {k.type === "file" ? (
                      <FileText className="w-5 h-5 text-violet-600" />
                    ) : k.type === "url" ? (
                      <LinkIcon className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Type className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 truncate">
                        {k.title || k.original_filename || "(タイトルなし)"}
                      </h4>
                      <StatusBadge status={k.status} />
                    </div>
                    {k.source_url && (
                      <p className="text-xs text-gray-500 truncate mb-1">{k.source_url}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{new Date(k.created_at).toLocaleString()}</span>
                      <span className="font-mono">{k.chat_id}</span>
                    </div>
                    {k.error_message && (
                      <p className="text-xs text-red-600 mt-1">エラー: {k.error_message}</p>
                    )}
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
