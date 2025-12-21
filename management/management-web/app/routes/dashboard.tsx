import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { apiBase, apiFetch, AuthError } from "../lib/api";
import type { ChatProfile, KnowledgeAsset, User } from "../lib/types";

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
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSession = async () => {
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
  };

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
      const res = await fetch(`${apiBase}/api/knowledge/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (res.status === 401) {
        nav("/login");
        return;
      }
      if (!res.ok) {
        throw new Error(data?.error || "アップロードに失敗しました");
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
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">AIチャット管理</p>
            <h1 className="text-xl font-bold text-slate-900">ダッシュボード</h1>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="text-sm text-right">
                <p className="font-semibold text-slate-800">{user.email}</p>
                <p className="text-slate-500">
                  {user.is_admin ? "管理者" : "ユーザー"}
                </p>
              </div>
            )}
            <button
              onClick={logout}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">チャットプロファイル</h2>
              <p className="text-sm text-slate-500">
                運用したいチャットAIを登録し、利用先ドメイン（複数可）とシステムプロンプトを管理します。登録後は下部で操作対象を選んでナレッジを投入します。
                登録済みのチャットは編集・削除も可能です。
              </p>
            </div>
            <button
              onClick={loadChats}
              className="text-sm text-sky-700 hover:underline"
              disabled={loadingChats}
            >
              再読み込み
            </button>
          </div>

          <form onSubmit={submitChat} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              チャットID（エイリアス）
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={chatForm.id}
                onChange={(e) => setChatForm((p) => ({ ...p, id: e.target.value }))}
                disabled={Boolean(editingChatId)}
                title={editingChatId ? "ID は編集できません" : ""}
                required
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              表示名
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                value={chatForm.display_name}
                onChange={(e) => setChatForm((p) => ({ ...p, display_name: e.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
              利用先ドメイン（複数可）
              <div className="space-y-2">
                {chatForm.targets.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
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
                    {chatForm.targets.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setChatForm((p) => ({
                            ...p,
                            targets: p.targets.filter((_, i) => i !== idx),
                          }))
                        }
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-red-300 hover:text-red-600"
                        aria-label="このドメインを削除"
                      >
                        削除
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setChatForm((p) => ({ ...p, targets: [...p.targets, ""] }))
                  }
                  className="text-xs font-semibold text-sky-700 hover:underline"
                >
                  ＋ ドメインを追加
                </button>
              </div>
            </label>
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              システムプロンプト
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                rows={3}
                value={chatForm.system_prompt}
                onChange={(e) => setChatForm((p) => ({ ...p, system_prompt: e.target.value }))}
                placeholder="このチャット向けの回答方針"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                {editingChatId ? "チャットを更新" : "チャットを登録"}
              </button>
              {editingChatId && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="text-xs text-slate-600 hover:text-slate-800 underline"
                  >
                    編集をキャンセル
                  </button>
                </div>
              )}
            </div>
          </form>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">登録済み</h3>
            {loadingChats ? (
              <p className="text-sm text-slate-500">読み込み中...</p>
            ) : chats.length === 0 ? (
              <p className="text-sm text-slate-500">まだ登録がありません。</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {chats.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-lg px-3 py-2 ${
                      activeChatId === c.id
                        ? "border border-sky-300 bg-sky-50 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]"
                        : "border border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{c.display_name || c.id}</p>
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-mono">
                        {c.id}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(c.targets && c.targets.length > 0 ? c.targets : [c.target]).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 border border-slate-200"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-500 flex-1">
                        {activeChatId === c.id ? "操作中のチャット" : "選択してナレッジ投入"}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="rounded border border-slate-200 px-2 py-1 font-semibold text-slate-700 hover:border-sky-500"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveChatId(c.id)}
                        className={`rounded px-2 py-1 font-semibold ${
                          activeChatId === c.id
                            ? "bg-sky-600 text-white"
                            : "border border-slate-200 text-slate-700 hover:border-sky-500"
                        }`}
                      >
                        {activeChatId === c.id ? "選択中" : "操作対象にする"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteChat(c.id)}
                        className="rounded border border-red-200 px-2 py-1 font-semibold text-red-600 hover:border-red-400"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">ナレッジ投入</h2>
              <p className="text-sm text-slate-500">
                操作対象チャットを選んでから投入してください。アップロードやURL/テキスト登録はPythonサーバーへ委譲し、Qdrantに保存されます。
              </p>
            </div>
            <button
              onClick={loadKnowledge}
              className="text-sm text-sky-700 hover:underline"
              disabled={loadingKnowledge}
            >
              再読み込み
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">操作対象チャット</p>
              {activeChat ? (
                <>
                  <p className="text-base font-semibold text-slate-900">
                    {activeChat.display_name || activeChat.id}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(activeChat.targets && activeChat.targets.length > 0
                      ? activeChat.targets
                      : [activeChat.target]
                    ).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-600">
                  登録済みのチャットから選択してください。新規作成した場合もここで選択できます。
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                className="min-w-[220px] rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
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

          <div className="grid gap-4 md:grid-cols-3">
            <form onSubmit={submitFile} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">ファイル</h3>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  PDF / TXT / DOCX
                </span>
              </div>
              <TargetHint activeChat={activeChat} />
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="タイトル（任意）"
                value={fileForm.title}
                onChange={(e) => setFileForm((p) => ({ ...p, title: e.target.value }))}
              />
              <input
                type="file"
                className="w-full text-sm"
                onChange={(e) =>
                  setFileForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))
                }
                required
              />
              <button
                type="submit"
                disabled={!activeChatId}
                className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                送信
              </button>
            </form>

            <form onSubmit={submitURL} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-800">URL取り込み</h3>
              <TargetHint activeChat={activeChat} />
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="https://example.com"
                value={urlForm.url}
                onChange={(e) => setUrlForm((p) => ({ ...p, url: e.target.value }))}
                required
              />
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="タイトル（任意）"
                value={urlForm.title}
                onChange={(e) => setUrlForm((p) => ({ ...p, title: e.target.value }))}
              />
              <button
                type="submit"
                disabled={!activeChatId}
                className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                送信
              </button>
            </form>

            <form onSubmit={submitText} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-800">テキスト</h3>
              <TargetHint activeChat={activeChat} />
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="タイトル（任意）"
                value={textForm.title}
                onChange={(e) => setTextForm((p) => ({ ...p, title: e.target.value }))}
              />
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={4}
                placeholder="登録したいテキスト"
                value={textForm.content}
                onChange={(e) => setTextForm((p) => ({ ...p, content: e.target.value }))}
                required
              />
              <button
                type="submit"
                disabled={!activeChatId}
                className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                送信
              </button>
            </form>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">最近のナレッジ</h3>
            {loadingKnowledge ? (
              <p className="text-sm text-slate-500">読み込み中...</p>
            ) : knowledge.length === 0 ? (
              <p className="text-sm text-slate-500">まだ登録がありません。</p>
            ) : (
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50">
                {knowledge.map((k) => (
                  <div key={k.id} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold uppercase">
                          {k.type}
                        </span>
                        <span className="text-xs text-slate-600 font-mono">{k.id}</span>
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          k.status === "succeeded"
                            ? "text-green-600"
                            : k.status === "failed"
                              ? "text-red-600"
                              : "text-amber-600"
                        }`}
                      >
                        {k.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 mt-1">
                      {k.title || k.original_filename || "(タイトルなし)"}
                    </p>
                    <p className="text-xs text-slate-600 break-all">{k.source_url || ""}</p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(k.created_at).toLocaleString()} / {k.chat_id}
                    </p>
                    {k.error_message && (
                      <p className="text-xs text-red-600">エラー: {k.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {(status || error) && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              status
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {status || error}
          </div>
        )}

        {!user?.is_admin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            権限: 一般ユーザーです。管理者が必要な操作は制限されます。
          </div>
        )}

        <footer className="text-xs text-slate-500">
          API: <code className="font-mono">{apiBase}</code>{" "}
          <Link to="/register" className="text-sky-700 hover:underline">
            新規登録
          </Link>
        </footer>
      </div>
    </main>
  );
}

function TargetHint({ activeChat }: { activeChat: ChatProfile | null }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      {activeChat ? (
        <>
          <p className="text-sm font-semibold text-slate-800">
            {activeChat.display_name || activeChat.id}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {(activeChat.targets && activeChat.targets.length > 0
              ? activeChat.targets
              : [activeChat.target]
            ).map((t) => (
              <span
                key={t}
                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 border border-slate-200"
              >
                {t}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p>操作するチャットを上で選択してください。</p>
      )}
    </div>
  );
}
