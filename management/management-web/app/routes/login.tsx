import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { getFirebaseAuth, getAppUrl } from "../lib/firebase";

export function meta() {
  return [
    { title: "ログイン | Management" },
    { name: "description", content: "管理コンソールにログイン" },
  ];
}

const EMAIL_STORAGE_KEY = "emailForSignIn";

function getActionCodeSettings() {
  const appUrl = getAppUrl();
  return {
    url: `${appUrl}/login`,
    handleCodeInApp: true,
  };
}

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const auth = getFirebaseAuth();
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const storedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY);
      if (!storedEmail) {
        setError(
          "メールを送信したのと同じブラウザでこのリンクを開いてください。別のブラウザからアクセスしている場合は、この画面でメールアドレスを入力して再度ログイン用メールを送信してください。"
        );
        return;
      }
      setVerifying(true);
      signInWithEmailLink(auth, storedEmail, window.location.href)
        .then(() => {
          window.localStorage.removeItem(EMAIL_STORAGE_KEY);
          nav("/dashboard");
        })
        .catch((err) => {
          setError(err.message);
          setVerifying(false);
        });
    }
  }, [nav]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const auth = getFirebaseAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && !isSignInWithEmailLink(auth, window.location.href)) {
        nav("/dashboard");
      }
    });
    return () => unsubscribe();
  }, [nav]);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      // 既存ユーザーかどうかを確認
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      if (signInMethods.length === 0) {
        setError("このメールアドレスは登録されていません。新規登録してください。");
        setLoading(false);
        return;
      }
      await sendSignInLinkToEmail(auth, email, getActionCodeSettings());
      window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
      setEmailSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-slate-600">認証中...</p>
        </div>
      </main>
    );
  }

  if (emailSent) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg border border-slate-200 space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              メールを確認してください
            </h1>
            <p className="text-sm text-slate-600">
              <strong className="text-slate-900">{email}</strong>{" "}
              にログインリンクを送信しました。
            </p>
            <p className="text-sm text-slate-500">
              メール内のリンクをクリックしてログインしてください。
            </p>
          </div>
          <button
            onClick={() => setEmailSent(false)}
            className="w-full text-sm text-sky-700 hover:underline"
          >
            別のメールアドレスで試す
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg border border-slate-200 space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-sm font-medium text-slate-500">AIチャット管理</p>
          <h1 className="text-2xl font-bold text-slate-900">ログイン</h1>
          <p className="text-sm text-slate-600">
            メールアドレスにログインリンクを送信します。
            <br />
            パスワードは必要ありません。
          </p>
        </div>

        <form onSubmit={sendLink} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              メールアドレス
            </label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="your@email.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "送信中..." : "ログインリンクを送信"}
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="text-center text-sm text-slate-600">
          アカウントをお持ちでない方は{" "}
          <Link to="/register" className="text-sky-600 hover:underline font-medium">
            新規登録
          </Link>
        </div>
      </div>
    </main>
  );
}
