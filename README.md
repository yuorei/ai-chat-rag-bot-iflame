# AI Chat Bot with RAG

RAG（Retrieval-Augmented Generation）機能付きのAIチャットボットです。Gemini APIを使用し、思考プロセスを可視化するAI Agentとして動作します。iframe対応で外部サイトに埋め込み可能で、個人ブログやコミュニティサイトにも気軽に組み込めます。

## 機能

- 🤖 Gemini API による高性能なAI応答
- 🧠 思考プロセスを可視化するAI Agent
- 📚 RAG機能（ChromaDBによるベクトル検索）
- 🌐 iframe対応のWebインターフェース
- 🌍 ドメイン自動判定によるマルチテナント対応
- 🐳 Docker完全対応（Pythonコマンド不要）
- 💾 知識ベース追加機能

## 必要要件

- Docker & Docker Compose
- Gemini API Key

## セットアップ手順

### 1. リポジトリクローン
```bash
git clone <your-repo-url>
cd ai-chat-iflame
```

### 2. 環境変数設定
```bash
cp .env.example .env
```

`.env`ファイルを編集して必要な環境変数を設定：

```
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL_NAME=gemini-2.0-flash-lite
FLASK_ENV=development
FLASK_APP=app.py
# 認証は現在無効化中のため、WIDGET_JWT_SECRET / ADMIN_API_KEY は不要です
MGMT_API_BASE_URL=http://localhost:8787
# Qdrant（マネージド利用時はURL/APIキー、ローカルはホスト/ポートを指定）
# QDRANT_URL=https://your-qdrant-endpoint:6333
# QDRANT_API_KEY=your_qdrant_api_key
# QDRANT_HOST=vectordb
# QDRANT_PORT=6333
```

**重要**:
- 現在は認証を無効化しています。管理エンドポイントは誰でもアクセスできるため、公開環境ではIP制限やリバースプロキシで保護してください。

チャットの利用先やシステムプロンプトは管理API/管理UI（D1）に登録します。

### 3. Docker実行

#### 開発環境での起動
```bash
docker-compose up --build
```

#### バックグラウンド実行
```bash
docker-compose up -d --build
```

#### ログ確認
```bash
docker-compose logs -f
```

#### 停止
```bash
docker-compose down
```

#### 完全クリーンアップ（ボリューム含む）
```bash
docker-compose down -v
docker system prune -a
```

### Docker Composeを使わずに単体起動する

`Makefile` に Web(API) とフロントエンドを個別に起動するターゲットを用意しています。共有ネットワーク `ai-chat-iflame-net` が自動で作成されるため、必要に応じて `make network-down` で削除してください。

```bash
# Flaskバックエンドをビルド＆起動（Ctrl+Cで停止）
make web-run

# Nginxフロントエンドをビルド＆起動（Ctrl+Cで停止）
make frontend-run

# 片方だけ止めたい場合
make web-stop
make frontend-stop
```

※ Qdrantは別途起動（`docker run qdrant/qdrant ...` など）するか、`QDRANT_URL` をマネージド環境に向けてください。

## 環境変数の詳細

| 環境変数 | 必須 | 説明 |
|---------|------|------|
| `GEMINI_API_KEY` | ✅ | Google Gemini APIのキー |
| `GEMINI_MODEL_NAME` | - | 使用するGeminiモデル名。デフォルトは `gemini-2.0-flash-lite` |
| `MGMT_API_BASE_URL` | ✅ | 管理API（D1）のベースURL。Pythonがドメイン判定に使用します。 |
| `FLASK_ENV` | - | `development` または `production`。本番環境では`production`を設定してください。 |
| `FLASK_APP` | - | Flaskアプリケーションのエントリーポイント（通常は`app.py`） |
| `QDRANT_URL` | - | マネージドQdrantのエンドポイントURL。設定時は`QDRANT_HOST`/`QDRANT_PORT`より優先され、APIキーと併用します。 |
| `QDRANT_API_KEY` | - | マネージドQdrantにアクセスするためのAPIキー。`QDRANT_URL`を使う場合は必ず安全な値を設定してください。 |
| `QDRANT_HOST` | - | 自前でホストするQdrantのホスト名。デフォルトはDocker Compose内の`vectordb`。 |
| `QDRANT_PORT` | - | 自前でホストするQdrantのポート番号。デフォルトは`6333`。 |

## アクセス方法

- **フロントエンド**: http://localhost:3000
- **API**: http://localhost:8000
- **Qdrant（ベクトルDB）**: http://localhost:6333

### ローカル埋め込みの確認

`iframe-embed.html` や `sample.html` を使うと、実際に外部サイトへ埋め込んだ時の挙動をブラウザでテストできます。

```bash
# 例: ポート8001で簡易サーバーを立てて sample.html を開く
python3 -m http.server 8001
# ブラウザで http://localhost:8001/sample.html を開く
```

`sample.html` では `widget.js`（デフォルト: http://localhost:3000/widget.js）を読み込んでおり、`window.IFRAME_WIDGET_CONFIG` を定義すると `apiBaseUrl` や `widgetBaseUrl` を任意のURLに切り替えられます。

## テナント管理とウィジェット公開

1. 管理API/管理UIからチャット設定（ドメイン・表示名・システムプロンプト等）を登録します。
2. 公開したいサイトに貼るのは 1 行のスクリプトだけです。

```html
<script src="https://chat.example.com/widget.js" defer></script>
```

`widget.js` は現在のホスト名（`Origin`ヘッダーまたは`request.host`）を `https://api.example.com/public/init` に送信し、該当ドメインのテナントを自動判定します。サーバーは `chatId` を返し、iframe に引き渡します。チャット画面は `chatId` を `/api/chat` のリクエストボディに含めて会話します。

**セキュリティ**: `/public/init`エンドポイントは、リクエストボディやカスタムヘッダーからホスト情報を受け取らず、実際のリクエスト元（`Origin`ヘッダーまたは`request.host`）のみを使用します。これにより、任意のドメインで他テナントを取得する攻撃を防ぎます。

### ローカル／カスタム構成

本番のように API とチャットのホスト名が異なる場合は、スクリプトの直前に以下を仕込むか、`widget.js` の `data-api-base` / `data-widget-base` 属性を利用してください。

```html
<script>
  window.IFRAME_WIDGET_CONFIG = {
    apiBaseUrl: 'http://localhost:8000',
    widgetBaseUrl: 'http://localhost:3000'
  };
</script>
<script src="http://localhost:3000/widget.js" defer></script>
```

ウィジェットには丸いトグルボタンが付属しており、クリックすると iframe のチャット画面が開閉します。テナントはドメイン判定で紐づけられ、iframe 内では `chatId` を使って会話を行います。

リポジトリ内の `iframe-embed.html` をブラウザで開くと、上記スクリプトを組み込んだサンプルページをそのまま確認できます。

## Managementコンソール / 管理API（D1）

- 役割: チャット設定とドメインをD1に保存し、ナレッジ登録リクエストをPythonサーバーへ委譲してQdrantへ投入します。
- 起動: `management/management-server-hono` で `npm install && npm run dev`（wrangler dev）。ローカルの管理APIは `http://localhost:8787` がデフォルトです。
- 認証: 管理UIからの操作はメール/パスワードのログインで行い、セッションクッキーを使用します。初回登録ユーザーは自動で管理者になります。`MGMT_ALLOW_OPEN_SIGNUP` を `false` にすると追加登録は管理者のみ許可。サービス間連携用に `MGMT_ADMIN_API_KEY` をヘッダー指定すればキー認証も利用可能です。
- エンドポイント例: `http://localhost:8787`（デフォルト）。  
  - `POST /api/auth/register` / `POST /api/auth/login` / `POST /api/auth/logout` / `GET /api/auth/me`  
  - `GET /api/chats` / `POST /api/chats` / `PUT|DELETE /api/chats/{id}`  
  - `GET /api/knowledge`（chat_idクエリで絞り込み）  
  - `POST /api/knowledge/files|urls|texts` → Pythonサーバーの `/api/upload_file` `/api/fetch_url` `/api/add_knowledge` を呼び出し、Qdrantへ登録
- 管理UI: `management/management-web` で `npm install && npm run dev`。`/login`・`/register` ページでログイン後、`/dashboard` でチャット登録とナレッジ投入（ファイル/URL/テキスト）が可能です。APIは `VITE_MANAGEMENT_API_BASE_URL` または `window.__MGMT_API_BASE__` で上書きできます（デフォルト: `http://localhost:8787`）。

## トラブルシューティング

- **Gemini APIの利用上限に達してチャットが回答しない**: サーバーログに `ResourceExhausted` や 429 が表示された場合は、`.env` に `GEMINI_MODEL_NAME=gemini-2.0-flash-lite` を指定して `docker compose restart web` してください。どうしても上限が解消できない場合でも、ウィジェットは取得済みのナレッジを簡易的に返すフェイルセーフが働きます。

## API仕様

### 1. `/public/init`
任意のサイトに埋め込まれた `widget.js` がコールし、現在のドメインからテナントを自動判定します。

**重要**: このエンドポイントはリクエストボディからホスト情報を受け取りません。`Origin`ヘッダーまたは`request.host`から自動的に判定します。

```bash
# ブラウザから自動的に呼び出されます（Originヘッダーが自動付与）
curl -X POST http://localhost:8000/public/init \
  -H "Content-Type: application/json" \
  -H "Origin: http://www.example.com"
```

レスポンス（該当テナントがある場合）

```json
{
  "ok": true,
  "chatId": "tenant_demo",
  "chat": {"id": "tenant_demo", "display_name": "Demo Tenant"}
}
```

**セキュリティ**: このエンドポイントは公開されていますが、実際のリクエスト元ホストのみを使用するため、任意のドメインで他テナントを取得することはできません。

### 2. `/api/chat`

`chat_id` をボディに含めるとそのテナントで会話します。省略時は `Origin` / `request.host` から判定します。

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "こんにちは", "chat_id": "tenant_demo"}'
```

**レスポンス**: `tenant_id`はデバッグモード（`FLASK_ENV=development`）の場合のみ含まれます。本番環境では含まれません。

### 3. `/api/add_knowledge`

運営者向けの管理画面から利用するエンドポイントです。`tenant_id` を指定して登録すると、ベクトルDBに `tenant_id` が付与され、他テナントと分離されます。

**注意**: 現在は認証なしのため、公開環境ではアクセス制限してください。

```bash
curl -X POST http://localhost:8000/api/add_knowledge \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "tenant_demo", "title": "Python基礎", "content": "Pythonは汎用..."}'
```

### 4. `/api/upload_file`

フォームデータでファイルと `tenant_id` を送信します。

```bash
curl -X POST http://localhost:8000/api/upload_file \
  -F tenant_id=tenant_demo \
  -F file=@manual.pdf
```

### 5. `/api/fetch_url`

```bash
curl -X POST http://localhost:8000/api/fetch_url \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "tenant_demo", "url": "https://example.com"}'
```

**注意**: 管理エンドポイント（`/api/add_knowledge`, `/api/upload_file`, `/api/fetch_url`）は認証なしで利用できます。公開環境では必ずアクセス制限を検討してください。

### 6. `/health`

```bash
curl http://localhost:8000/health
```

## 埋め込みスニペット

どんなサイトにも以下の 1 行を貼るだけで構成できます（必要に応じて `window.IFRAME_WIDGET_CONFIG` でAPIのURLなどを上書きしてください）。

```html
<script src="https://chat.example.com/widget.js" defer></script>
```

## プロジェクト構造

```
ai-chat-iflame/
├── docker-compose.yml     # Docker設定
├── .env.example          # 環境変数テンプレート
├── README.md            # このファイル
├── server/              # Flask APIサーバー
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app.py          # メインアプリケーション
└── front/              # フロントエンド
    ├── Dockerfile
    ├── index.html      # チャットUI（iframe内）
    ├── widget.js       # サイト向け埋め込みスクリプト
    └── upload.html etc # 管理者ツール
```

## セキュリティに関する重要な注意事項

### 本番環境での注意

1. **認証が無効化されています**
   - すべてのAPIが公開状態になるため、IP制限やリバースプロキシでの保護を必ず実施してください
   - 将来的に認証を戻す場合は、管理エンドポイントとチャットAPIの両方を再保護してください

2. **CORS設定**
   - `/public/init`エンドポイントは`Origin`ヘッダーを使用するため、CORSが適切に設定されていることを確認してください
   - 現在の実装では`CORS(app)`によりすべてのオリジンからのアクセスを許可していますが、本番環境では必要に応じて制限を検討してください

3. **テナント分離**
   - 現在は `chat_id` を指定してテナントを選択します
   - 公開環境では `chat_id` が外部に漏れない運用にしてください

### 開発環境での注意

- `tenant_id`はデバッグモード（`FLASK_ENV=development`）の場合のみAPIレスポンスに含まれます

## トラブルシューティング

### ポートが使用中の場合
```bash
# 使用中のプロセスを確認
lsof -i :3000
lsof -i :8000
lsof -i :8001

# docker-compose.ymlのポート番号を変更
```

### Qdrant（ベクトルDB）が起動しない場合
```bash
# データディレクトリの権限確認
mkdir -p qdrant_storage
chmod 755 qdrant_storage

# 再起動
docker-compose restart vectordb
```

### Gemini APIエラーの場合
- APIキーが正しく設定されているか確認
- APIキーの使用量制限を確認
- `.env`ファイルが正しく読み込まれているか確認

## 開発・カスタマイズ

### コード変更の反映
```bash
# サーバー再起動
docker-compose restart web

# フロントエンド再起動  
docker-compose restart frontend

# 全体再ビルド
docker-compose up --build
```

### ログ監視
```bash
# 全体ログ
docker-compose logs -f

# 特定サービスのログ
docker-compose logs -f web
docker-compose logs -f vectordb
```
