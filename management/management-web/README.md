# management-web

Cloudflare Workers + React Router v7 で構築された管理ダッシュボード UI。

## 概要

RAG チャットボットシステムの管理画面。チャットプロファイルの作成・編集、ナレッジアセットの登録 (ファイル/URL/テキスト) などを行う。

## 技術スタック

- **Runtime**: Cloudflare Workers
- **Framework**: React Router v7 (SSR)
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript

## デプロイ先

- **Production**: Cloudflare Workers (wrangler deploy)

## セットアップ

```bash
npm install
```

### 開発

```bash
npm run dev
```

開発サーバーが起動し、`http://localhost:5173` でアクセス可能。

### ビルド

```bash
npm run build
```

### デプロイ

```bash
npm run deploy
```

## ディレクトリ構成

```
management-web/
├── app/
│   ├── routes/           # ページコンポーネント
│   │   ├── _index.tsx    # トップ (ダッシュボードへリダイレクト)
│   │   ├── login.tsx     # ログインページ
│   │   ├── register.tsx  # ユーザー登録ページ
│   │   └── dashboard.tsx # 管理ダッシュボード
│   ├── lib/
│   │   └── api.ts        # API クライアント
│   ├── root.tsx          # アプリケーションルート
│   ├── routes.ts         # ルート設定
│   └── app.css           # グローバルスタイル
├── workers/
│   └── app.ts            # Cloudflare Worker エントリーポイント
├── public/               # 静的ファイル
├── wrangler.jsonc        # Wrangler 設定
└── package.json
```

## 画面構成

### ログイン (`/login`)
- メールアドレス / パスワードでログイン
- Cookie セッションで認証状態を管理

### ユーザー登録 (`/register`)
- 新規ユーザー登録
- 最初のユーザーは自動的に管理者になる

### ダッシュボード (`/dashboard`)
- **チャット管理**: チャットプロファイルの一覧・作成・編集・削除
- **ナレッジ管理**: ファイルアップロード、URL 登録、テキスト登録
- 各チャットに紐づくナレッジアセットの確認

## 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `VITE_MANAGEMENT_API_BASE_URL` | 管理 API のベース URL | `http://localhost:8100` |

開発時は `.env` ファイルに設定可能:

```env
VITE_MANAGEMENT_API_BASE_URL=http://localhost:8100
```

本番環境では `window.__MGMT_API_BASE__` をセットすることで動的に変更可能。

## API クライアント

`app/lib/api.ts` で管理 API (`management-server-hono`) との通信を行う。

```typescript
import { apiFetch } from "~/lib/api";

// ログイン
await apiFetch("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password }),
});

// チャット一覧取得
const { chats } = await apiFetch("/api/chats");
```

- Cookie (`mgmt_session`) による認証
- 401 エラー時は `AuthError` をスロー

## npm scripts

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run preview` | ビルド後のプレビュー |
| `npm run deploy` | Cloudflare Workers へデプロイ |
| `npm run cf-typegen` | Wrangler 型生成 |
| `npm run typecheck` | 型チェック |
