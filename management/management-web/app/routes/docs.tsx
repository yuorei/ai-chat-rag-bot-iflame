import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "../lib/firebase";
import { apiFetch, AuthError } from "../lib/api";
import type { User } from "../lib/types";

export function meta() {
  return [
    { title: "埋め込みガイド | Management" },
    { name: "description", content: "widget.js を使ったチャットウィジェットの埋め込み方法" },
  ];
}

export default function Docs() {
  const nav = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState("quickstart");

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
      } catch (err) {
        if (err instanceof AuthError) {
          nav("/login");
        }
      }
    });
    return () => unsubscribe();
  }, [nav]);

  const sections = [
    { id: "quickstart", label: "クイックスタート" },
    { id: "configuration", label: "設定オプション" },
    { id: "theme", label: "テーマ設定" },
    { id: "advanced", label: "高度な設定" },
    { id: "events", label: "イベント" },
    { id: "troubleshooting", label: "トラブルシューティング" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-sm text-sky-600 hover:text-sky-800 font-semibold"
            >
              ← ダッシュボードに戻る
            </Link>
            <div className="border-l border-slate-200 pl-4">
              <p className="text-sm text-slate-500">AIチャット管理</p>
              <h1 className="text-xl font-bold text-slate-900">埋め込みガイド</h1>
            </div>
          </div>
          {user && (
            <p className="text-sm text-slate-600">{user.email}</p>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex gap-8">
          {/* サイドバー */}
          <nav className="w-56 flex-shrink-0">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">目次</p>
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setActiveSection(s.id)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === s.id
                      ? "bg-sky-100 text-sky-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {s.label}
                </a>
              ))}
            </div>
          </nav>

          {/* メインコンテンツ */}
          <main className="flex-1 space-y-10">
            {/* クイックスタート */}
            <section id="quickstart" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">クイックスタート</h2>
              <p className="text-slate-600 mb-4">
                widget.js を使用すると、あなたのウェブサイトにAIチャットウィジェットを簡単に埋め込むことができます。
              </p>

              <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-3">基本的な埋め込み</h3>
              <p className="text-slate-600 mb-3">
                以下のスクリプトタグをHTMLの <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm text-pink-600">&lt;body&gt;</code> の終了タグの直前に追加するだけで、チャットウィジェットが表示されます。
              </p>

              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                <pre className="text-sm text-slate-100 font-mono">
{`<!-- チャットウィジェットの埋め込み -->
<script
    src="https://your-domain.com/widget.js"
    data-api-base="https://api.your-domain.com"
></script>`}
                </pre>
              </div>

              <div className="mt-4 rounded-xl bg-green-50 border border-green-200 p-4">
                <p className="text-green-800 font-semibold">これだけでOK!</p>
                <p className="text-green-700 text-sm mt-1">
                  スクリプトを追加すると、ページ右下にチャットボタンが表示されます。ボタンをクリックするとチャットウィンドウが開きます。
                </p>
              </div>
            </section>

            {/* 設定オプション */}
            <section id="configuration" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">設定オプション</h2>
              <p className="text-slate-600 mb-4">
                widget.js は data-* 属性またはグローバル設定オブジェクトで設定できます。
              </p>

              <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-3">data-* 属性による設定</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">属性</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">説明</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">デフォルト値</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">data-api-base</code></td>
                      <td className="px-4 py-3 text-slate-600">APIサーバーのベースURL</td>
                      <td className="px-4 py-3 text-slate-500">widget.jsのホストURL</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">data-widget-base</code></td>
                      <td className="px-4 py-3 text-slate-600">ウィジェットのホスティングURL</td>
                      <td className="px-4 py-3 text-slate-500">現在のページのorigin</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">
                        <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">data-theme</code>
                        <span className="ml-2 rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">NEW</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">テーマ設定: light, dark, auto</td>
                      <td className="px-4 py-3 text-slate-500">auto (システム設定に従う)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">data-button-size</code></td>
                      <td className="px-4 py-3 text-slate-600">トグルボタンのサイズ (px)</td>
                      <td className="px-4 py-3 text-slate-500">64px / 72px (モバイル)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">data-button-color</code></td>
                      <td className="px-4 py-3 text-slate-600">トグルボタンの背景色</td>
                      <td className="px-4 py-3 text-slate-500">#4a90e2</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">data-button-label</code></td>
                      <td className="px-4 py-3 text-slate-600">ボタンのラベル</td>
                      <td className="px-4 py-3 text-slate-500">💬</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">data-close-label</code></td>
                      <td className="px-4 py-3 text-slate-600">閉じるボタンのラベル</td>
                      <td className="px-4 py-3 text-slate-500">✕</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">data-width</code></td>
                      <td className="px-4 py-3 text-slate-600">チャットウィンドウの幅</td>
                      <td className="px-4 py-3 text-slate-500">400px</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">data-height</code></td>
                      <td className="px-4 py-3 text-slate-600">チャットウィンドウの高さ</td>
                      <td className="px-4 py-3 text-slate-500">600px</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">data-right</code></td>
                      <td className="px-4 py-3 text-slate-600">右端からの距離</td>
                      <td className="px-4 py-3 text-slate-500">20px</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">data-button-bottom</code></td>
                      <td className="px-4 py-3 text-slate-600">ボタンの下端からの距離</td>
                      <td className="px-4 py-3 text-slate-500">20px</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">data-gap</code></td>
                      <td className="px-4 py-3 text-slate-600">ボタンとウィンドウの間隔</td>
                      <td className="px-4 py-3 text-slate-500">16px</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold text-slate-800 mt-8 mb-3">カスタマイズ例</h3>
              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                <pre className="text-sm text-slate-100 font-mono">
{`<script
    src="https://your-domain.com/widget.js"
    data-api-base="https://api.your-domain.com"
    data-theme="dark"
    data-button-size="80"
    data-button-color="#6c5ce7"
    data-width="450px"
    data-height="700px"
></script>`}
                </pre>
              </div>

              <h3 className="text-lg font-semibold text-slate-800 mt-8 mb-3">グローバル設定オブジェクトによる設定</h3>
              <p className="text-slate-600 mb-3">
                widget.js を読み込む前にグローバル設定オブジェクトを定義することもできます。
              </p>
              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                <pre className="text-sm text-slate-100 font-mono">
{`<script>
window.IFRAME_WIDGET_CONFIG = {
    apiBaseUrl: 'https://api.your-domain.com',
    widgetBaseUrl: 'https://widget.your-domain.com',
    theme: 'auto'
};
</script>
<script src="https://your-domain.com/widget.js"></script>`}
                </pre>
              </div>
            </section>

            {/* テーマ設定 */}
            <section id="theme" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">テーマ設定（ダークモード対応）</h2>
              <p className="text-slate-600 mb-4">
                チャットウィジェットはライトモードとダークモードの両方に対応しています。
              </p>

              <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-3">テーマオプション</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">値</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">説明</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">auto</code></td>
                      <td className="px-4 py-3 text-slate-600">システム（OS）のカラースキーム設定に自動で追従します。リアルタイムで反映されます。</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">light</code></td>
                      <td className="px-4 py-3 text-slate-600">常にライトモードで表示します。</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">dark</code></td>
                      <td className="px-4 py-3 text-slate-600">常にダークモードで表示します。</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold text-slate-800 mt-8 mb-3">1. システム設定に自動追従（推奨）</h3>
              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                <pre className="text-sm text-slate-100 font-mono">
{`<!-- data-theme を省略または "auto" を指定 -->
<script
    src="https://your-domain.com/widget.js"
    data-api-base="https://api.your-domain.com"
    data-theme="auto"
></script>`}
                </pre>
              </div>

              <h3 className="text-lg font-semibold text-slate-800 mt-8 mb-3">2. 常にダークモード</h3>
              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                <pre className="text-sm text-slate-100 font-mono">
{`<script
    src="https://your-domain.com/widget.js"
    data-api-base="https://api.your-domain.com"
    data-theme="dark"
></script>`}
                </pre>
              </div>

              <h3 className="text-lg font-semibold text-slate-800 mt-8 mb-3">3. サイトのテーマと連動させる</h3>
              <p className="text-slate-600 mb-3">
                サイト独自のテーマ切り替え機能と連動させたい場合は、postMessage APIを使用できます。
              </p>
              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                <pre className="text-sm text-slate-100 font-mono">
{`// サイトのテーマが変更されたときにチャットウィジェットに通知
function updateChatTheme(theme) {
    const iframe = document.getElementById('iframe-widget-frame');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
            type: 'setTheme',
            theme: theme  // 'light' または 'dark'
        }, '*');
    }
}

// 例: サイトのダークモードボタンがクリックされたとき
document.getElementById('dark-mode-toggle').addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    updateChatTheme(isDark ? 'dark' : 'light');
});`}
                </pre>
              </div>

              <div className="mt-4 rounded-xl bg-sky-50 border border-sky-200 p-4">
                <p className="text-sky-800 font-semibold">ヒント</p>
                <p className="text-sky-700 text-sm mt-1">
                  URLパラメータでもテーマを指定できます。<code className="bg-sky-100 px-1 rounded">?theme=dark</code> をiframeのURLに追加することで、直接テーマを設定できます。
                </p>
              </div>
            </section>

            {/* 高度な設定 */}
            <section id="advanced" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">高度な設定</h2>

              <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-3">ページコンテキストの自動収集</h3>
              <p className="text-slate-600 mb-3">
                widget.js は埋め込み先ページの情報を自動的に収集し、チャットのコンテキストとして使用します。
              </p>

              <h4 className="font-semibold text-slate-700 mt-4 mb-2">収集される情報</h4>
              <ul className="list-disc list-inside text-slate-600 space-y-1">
                <li><strong>title</strong> - ページタイトル</li>
                <li><strong>url</strong> - 現在のURL</li>
                <li><strong>pathname</strong> - URLのパス部分</li>
                <li><strong>description</strong> - meta descriptionの内容</li>
                <li><strong>keywords</strong> - meta keywordsの内容</li>
                <li><strong>ogTitle / ogDescription</strong> - Open Graph情報</li>
                <li><strong>bodyText</strong> - ページ本文テキスト（最大5000文字）</li>
              </ul>

              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-amber-800 font-semibold">注意</p>
                <p className="text-amber-700 text-sm mt-1">
                  bodyTextには script, style, iframe, noscript タグの内容は含まれません。また、ウィジェット自体の要素も除外されます。
                </p>
              </div>

              <h3 className="text-lg font-semibold text-slate-800 mt-8 mb-3">iframeへのメッセージ送信</h3>
              <p className="text-slate-600 mb-3">
                postMessage APIを使用して、チャットウィジェットに直接メッセージを送信できます。
              </p>
              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                <pre className="text-sm text-slate-100 font-mono">
{`const iframe = document.getElementById('iframe-widget-frame');

// チャットにメッセージを自動入力して送信
iframe.contentWindow.postMessage({
    type: 'sendMessage',
    message: 'こんにちは!'
}, '*');

// テーマを変更
iframe.contentWindow.postMessage({
    type: 'setTheme',
    theme: 'dark'
}, '*');

// カスタムページコンテキストを送信
iframe.contentWindow.postMessage({
    type: 'pageContext',
    context: {
        title: 'カスタムタイトル',
        bodyText: 'カスタムコンテンツ...'
    }
}, '*');`}
                </pre>
              </div>
            </section>

            {/* イベント */}
            <section id="events" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">イベント</h2>
              <p className="text-slate-600 mb-4">
                widget.js はカスタムイベントを発火します。これらをリッスンして独自の処理を実行できます。
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">イベント名</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">説明</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">詳細データ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">iframe-widget-ready</code></td>
                      <td className="px-4 py-3 text-slate-600">ウィジェットの初期化が完了した時</td>
                      <td className="px-4 py-3 text-slate-500">なし</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3"><code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">iframe-widget-error</code></td>
                      <td className="px-4 py-3 text-slate-600">初期化中にエラーが発生した時</td>
                      <td className="px-4 py-3 text-slate-500">event.detail にエラーメッセージ</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-3">イベントのリッスン例</h3>
              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                <pre className="text-sm text-slate-100 font-mono">
{`// ウィジェット準備完了時
window.addEventListener('iframe-widget-ready', () => {
    console.log('チャットウィジェットが準備完了しました');
});

// エラー発生時
window.addEventListener('iframe-widget-error', (event) => {
    console.error('ウィジェットエラー:', event.detail);
});`}
                </pre>
              </div>
            </section>

            {/* トラブルシューティング */}
            <section id="troubleshooting" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">トラブルシューティング</h2>

              <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-3">ウィジェットが表示されない</h3>
              <ul className="list-disc list-inside text-slate-600 space-y-1">
                <li><code className="bg-slate-100 px-1 rounded text-xs">data-api-base</code> が正しく設定されているか確認してください</li>
                <li>APIサーバーが稼働しているか確認してください</li>
                <li>ブラウザのコンソールでエラーを確認してください</li>
                <li>CORSが正しく設定されているか確認してください</li>
              </ul>

              <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-3">テーマが反映されない</h3>
              <ul className="list-disc list-inside text-slate-600 space-y-1">
                <li><code className="bg-slate-100 px-1 rounded text-xs">data-theme</code> の値が light, dark, auto のいずれかであることを確認してください</li>
                <li>auto の場合、OSのダークモード設定を確認してください</li>
                <li>iframeの読み込みが完了してからテーマが適用されます</li>
              </ul>

              <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-3">ページコンテキストが送信されない</h3>
              <ul className="list-disc list-inside text-slate-600 space-y-1">
                <li>iframeが完全に読み込まれるまで待機してください</li>
                <li>コンソールで <code className="bg-slate-100 px-1 rounded text-xs">[iframe-widget] Sent page context</code> のログを確認してください</li>
              </ul>

              <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-3">複数回スクリプトが読み込まれる</h3>
              <p className="text-slate-600">
                widget.js は重複読み込みを自動的に防止します。<code className="bg-slate-100 px-1 rounded text-xs">window.__IFRAME_WIDGET_LOADED__</code> フラグで判定しています。
              </p>

              <div className="mt-6 rounded-xl bg-sky-50 border border-sky-200 p-4">
                <p className="text-sky-800 font-semibold">デバッグのヒント</p>
                <p className="text-sky-700 text-sm mt-1">
                  ブラウザのコンソールで <code className="bg-sky-100 px-1 rounded">[iframe-widget]</code> で始まるログメッセージを確認すると、ウィジェットの動作状況を把握できます。
                </p>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
