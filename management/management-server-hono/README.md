# management-server-hono

Cloudflare Workers + Hono + D1 で構築された管理サーバー API。

## 概要

RAG チャットボットシステムの管理機能を提供する API サーバー。ユーザー認証、チャットプロファイル管理、ナレッジアセット管理などの機能を持つ。

## 技術スタック

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Authentication**: JWT (Cookie / Bearer)

## セットアップ

```bash
npm install
```

### D1 データベース作成

```bash
# DB 作成
npx wrangler d1 create management-server-hono

# wrangler.jsonc の database_id を更新
```

### マイグレーション

```bash
# ローカル
npx wrangler d1 migrations apply management-server-hono --local

# リモート (本番)
npx wrangler d1 migrations apply management-server-hono --remote
```

### 開発 / デプロイ

```bash
npm run dev       # wrangler dev
npm run deploy    # wrangler deploy --minify
npm run cf-typegen
```

## API エンドポイント

### ヘルスチェック

```
GET /health
```

### 認証

| Method | Endpoint | 説明 |
|--------|----------|------|
| POST | `/api/auth/register` | ユーザー登録 |
| POST | `/api/auth/login` | ログイン |
| GET | `/api/auth/me` | 現在のユーザー情報取得 |
| POST | `/api/auth/logout` | ログアウト |

### チャットプロファイル (管理者のみ)

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/chats` | 一覧取得 |
| POST | `/api/chats` | 新規作成 |
| GET | `/api/chats/:id` | 詳細取得 |
| PUT | `/api/chats/:id` | 更新 |
| DELETE | `/api/chats/:id` | 削除 |

### ナレッジアセット (管理者のみ)

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/knowledge` | 一覧取得 (`?chat_id=xxx` でフィルタ可) |
| POST | `/api/knowledge/files` | ファイルアップロード |
| POST | `/api/knowledge/urls` | URL 登録 |
| POST | `/api/knowledge/texts` | テキスト登録 |

## 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `MGMT_FLASK_BASE_URL` | Python バックエンド URL | `http://localhost:8000` |
| `MGMT_AUTH_SECRET` | JWT 署名用シークレット (secret) | `dev-secret-change-me` |
| `MGMT_ADMIN_API_KEY` | 管理者 API キー (optional) | - |
| `MGMT_ALLOWED_ORIGINS` | CORS 許可オリジン (カンマ区切り) | `http://localhost:5173` |
| `MGMT_ALLOW_OPEN_SIGNUP` | オープンサインアップ許可 | `true` |
| `MGMT_COOKIE_SECURE` | Secure Cookie | `false` |
| `MGMT_MAX_UPLOAD_MB` | 最大アップロードサイズ (MB) | `50` |
| `MGMT_HTTP_TIMEOUT_SEC` | HTTP タイムアウト (秒) | `120` |

## シークレットの設定

```bash
# JWT シークレット (必須)
echo "your-secret" | npx wrangler secret put MGMT_AUTH_SECRET

# 管理者 API キー (オプション: 設定すると X-Admin-API-Key ヘッダーで認証可能)
echo "your-api-key" | npx wrangler secret put MGMT_ADMIN_API_KEY
```

## データベーススキーマ

### users
ユーザー情報を格納。

| カラム | 型 | 説明 |
|--------|------|------|
| id | TEXT | UUID |
| email | TEXT | メールアドレス (UNIQUE) |
| password_hash | TEXT | パスワードハッシュ (PBKDF2) |
| is_admin | INTEGER | 管理者フラグ |
| created_at | TEXT | 作成日時 |
| updated_at | TEXT | 更新日時 |

### chat_profiles
チャットプロファイル情報。

| カラム | 型 | 説明 |
|--------|------|------|
| id | TEXT | チャットID |
| target | TEXT | プライマリターゲット (ドメイン等) |
| target_type | TEXT | `web` / `line` / `custom` |
| display_name | TEXT | 表示名 |
| system_prompt | TEXT | システムプロンプト |
| owner_user_id | TEXT | 作成者ユーザーID |
| created_at | TEXT | 作成日時 |
| updated_at | TEXT | 更新日時 |

### chat_targets
チャットに紐づく複数ターゲット (ドメイン)。

| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER | 自動採番ID |
| chat_id | TEXT | チャットID (FK) |
| target | TEXT | ターゲット (UNIQUE) |
| created_at | TEXT | 作成日時 |

### knowledge_assets
ナレッジアセット情報。

| カラム | 型 | 説明 |
|--------|------|------|
| id | TEXT | UUID |
| chat_id | TEXT | チャットID (FK) |
| type | TEXT | `file` / `url` / `text` |
| title | TEXT | タイトル |
| source_url | TEXT | URL (type=url の場合) |
| original_filename | TEXT | 元ファイル名 |
| storage_path | TEXT | 保存パス |
| status | TEXT | `pending` / `processing` / `succeeded` / `failed` |
| embedding_count | INTEGER | 埋め込みベクトル数 |
| error_message | TEXT | エラーメッセージ |
| created_at | TEXT | 作成日時 |
| updated_at | TEXT | 更新日時 |

## 認証フロー

1. 最初のユーザー登録時、そのユーザーは自動的に管理者になる
2. `MGMT_ALLOW_OPEN_SIGNUP=true` の場合、誰でも登録可能
3. `MGMT_ALLOW_OPEN_SIGNUP=false` の場合、管理者のみが新規ユーザーを登録可能
4. 認証は Cookie (`mgmt_session`) または Bearer トークンで行う

## 使用例

### ユーザー登録

```bash
curl -X POST https://your-worker.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password123"}'
```

### ログイン

```bash
curl -X POST https://your-worker.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password123"}' \
  -c cookies.txt
```

### チャットプロファイル作成

```bash
curl -X POST https://your-worker.workers.dev/api/chats \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "id": "my-chat",
    "targets": ["example.com", "sub.example.com"],
    "target_type": "web",
    "display_name": "My Chat",
    "system_prompt": "あなたは親切なアシスタントです。"
  }'
```

### ナレッジ登録 (テキスト)

```bash
curl -X POST https://your-worker.workers.dev/api/knowledge/texts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "chat_id": "my-chat",
    "title": "会社概要",
    "content": "弊社は2020年に設立されました..."
  }'
```

### ナレッジ登録 (ファイル)

```bash
curl -X POST https://your-worker.workers.dev/api/knowledge/files \
  -b cookies.txt \
  -F "chat_id=my-chat" \
  -F "title=製品カタログ" \
  -F "file=@catalog.pdf"
```
