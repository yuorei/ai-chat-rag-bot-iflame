import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getFirebaseAuth } from "../lib/firebase";
import { apiBase, apiFetch, AuthError } from "../lib/api";
import type { ChatProfile, KnowledgeAsset, User } from "../lib/types";
import { Sidebar } from "../components/dashboard/Sidebar";
import { Header } from "../components/dashboard/Header";
import { NotificationBanner } from "../components/dashboard/NotificationBanner";
import { ChatsTab, type ChatFormData } from "../components/dashboard/ChatsTab";
import { KnowledgeTab } from "../components/dashboard/KnowledgeTab";
import { KnowledgeModal } from "../components/dashboard/KnowledgeModal";
import { UIEditorTab } from "../components/dashboard/UIEditorTab";

const STORAGE_KEY = "ai-chat-management:lastEditedChatId";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chats" | "knowledge" | "ui-editor">("chats");
  const emptyChatForm: ChatFormData = { id: "", targets: [""], display_name: "", system_prompt: "" };
  const [chatForm, setChatForm] = useState<ChatFormData>(emptyChatForm);
  const [fileForm, setFileForm] = useState<{ title: string; file: File | null }>({
    title: "",
    file: null,
  });
  const [urlForm, setUrlForm] = useState({ url: "", title: "" });
  const [textForm, setTextForm] = useState({ title: "", content: "" });
  const [submittingFile, setSubmittingFile] = useState(false);
  const [submittingURL, setSubmittingURL] = useState(false);
  const [submittingText, setSubmittingText] = useState(false);
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeAsset | null>(null);
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

  // activeChatIdをlocalStorageに保存
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeChatId) {
      localStorage.setItem(STORAGE_KEY, activeChatId);
    }
  }, [activeChatId]);

  const loadChats = async () => {
    setLoadingChats(true);
    setError(null);
    try {
      const res = await apiFetch<{ chats: ChatProfile[] }>("/api/chats");
      const list = res.chats || [];
      setChats(list);
      setActiveChatId((prev) => {
        // 既存のactiveChatIdがあれば維持
        if (prev && list.some((c) => c.id === prev)) {
          return prev;
        }
        // localStorageから復元を試みる
        if (typeof window !== "undefined") {
          const savedId = localStorage.getItem(STORAGE_KEY);
          if (savedId && list.some((c) => c.id === savedId)) {
            return savedId;
          }
        }
        // 最初のチャットを選択
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
            display_name: chatForm.display_name,
            system_prompt: chatForm.system_prompt,
          }),
        });
        setStatus(`チャット ${res.id} を更新しました`);
        setActiveChatId(res.id);
      } else {
        const res = await apiFetch<ChatProfile>("/api/chats", {
          method: "POST",
          body: JSON.stringify({
            targets,
            display_name: chatForm.display_name,
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

  const startEdit = useCallback((chat: ChatProfile) => {
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
  }, []);

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

  const handleViewKnowledge = (knowledge: KnowledgeAsset) => {
    setSelectedKnowledge(knowledge);
  };

  const handleCloseKnowledgeModal = () => {
    setSelectedKnowledge(null);
  };

  const handleKnowledgeSaved = () => {
    loadKnowledge();
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
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        logout={logout}
        chats={chats}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
        loadingChats={loadingChats}
      />

      {/* メインコンテンツ */}
      <main className="flex-1 lg:ml-64">
        {/* ヘッダー */}
        <Header
          activeTab={activeTab}
          setSidebarOpen={setSidebarOpen}
        />

        {/* 通知 */}
        <NotificationBanner
          status={status}
          error={error}
          onClose={() => {
            setStatus(null);
            setError(null);
          }}
        />

        <div className="p-4 lg:p-8">
          {activeTab === "chats" && (
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
          )}
          {activeTab === "knowledge" && (
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
              onViewKnowledge={handleViewKnowledge}
            />
          )}
          {activeTab === "ui-editor" && (
            <UIEditorTab
              chats={chats}
              activeChatId={activeChatId}
              setStatus={setStatus}
              setError={setError}
            />
          )}
        </div>
      </main>

      {/* ナレッジ詳細モーダル */}
      {selectedKnowledge && (
        <KnowledgeModal
          knowledge={selectedKnowledge}
          onClose={handleCloseKnowledgeModal}
          onSaved={handleKnowledgeSaved}
          setError={setError}
          setStatus={setStatus}
        />
      )}
    </div>
  );
}
