import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { apiFetch } from "../lib/api";
import type { User } from "../lib/types";

export function meta() {
  return [
    { title: "新規登録 | Management" },
    { name: "description", content: "管理コンソールの新規登録" },
  ];
}

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ user: User }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuthError: true,
      });
      if (res?.user) {
        nav("/dashboard");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg border border-slate-200 space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium text-slate-500">AIチャット管理</p>
          <h1 className="text-2xl font-bold text-slate-900">新規登録</h1>
          <p className="text-sm text-slate-600">
            初回ユーザーは自動的に管理者として登録されます。
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">メールアドレス</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">パスワード</label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "登録中..." : "登録してログイン"}
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <p className="text-sm text-slate-600 text-center">
          既にアカウントをお持ちですか？{" "}
          <Link to="/login" className="text-sky-700 font-semibold hover:underline">
            ログインする
          </Link>
        </p>
      </div>
    </main>
  );
}
