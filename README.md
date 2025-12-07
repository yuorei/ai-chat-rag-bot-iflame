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
WIDGET_JWT_SECRET=your_secure_random_secret_here
ADMIN_API_KEY=your_admin_api_key_here  # オプション（管理エンドポイント用）
```

**重要**: 
- `WIDGET_JWT_SECRET`は**本番環境では必須**です。未設定の場合、アプリケーションは起動しません。開発環境では警告のみで起動しますが、安全なランダム文字列を設定してください。
- `ADMIN_API_KEY`は管理エンドポイント（`/api/add_knowledge`, `/api/upload_file`, `/api/fetch_url`）の認証に使用します。設定しない場合、開発環境では警告のみですが、本番環境では設定を強く推奨します。

併せて `data/tenants.json` に利用したいサイトやコミュニティのテナント情報（`allowed_domains` を含む）を登録してください。

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

## 環境変数の詳細

| 環境変数 | 必須 | 説明 |
|---------|------|------|
| `GEMINI_API_KEY` | ✅ | Google Gemini APIのキー |
| `GEMINI_MODEL_NAME` | - | 使用するGeminiモデル名。デフォルトは `gemini-2.0-flash-lite` |
| `WIDGET_JWT_SECRET` | ✅（本番） | JWTセッショントークンの署名用シークレット。本番環境では必須。開発環境では未設定でも起動しますが、警告が表示されます。 |
| `ADMIN_API_KEY` | ⚠️（推奨） | 管理エンドポイント用のAPIキー。設定すると、`/api/add_knowledge`, `/api/upload_file`, `/api/fetch_url`に`X-Admin-API-Key`ヘッダーが必要になります。本番環境では設定を強く推奨します。 |
| `FLASK_ENV` | - | `development` または `production`。本番環境では`production`を設定してください。 |
| `FLASK_APP` | - | Flaskアプリケーションのエントリーポイント（通常は`app.py`） |
| `TENANT_CONFIG_PATH` | - | テナント設定ファイルのパス（デフォルト: `./data/tenants.json`） |
| `WIDGET_SESSION_TTL_SECONDS` | - | セッショントークンの有効期限（秒）。デフォルト: 21600（6時間） |

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

1. `data/tenants.json` にサイト／プロジェクトごとの設定を登録します。最低限、`id` / `name` / `allowed_domains` / `system_prompt` を記載してください。
2. 公開したいサイトに貼るのは 1 行のスクリプトだけです。

```html
<script src="https://chat.example.com/widget.js" defer></script>
```

`widget.js` は現在のホスト名（`Origin`ヘッダーまたは`request.host`）を `https://api.example.com/public/init` に送信し、該当ドメインのテナントを自動判定します。サーバーはテナントIDを含む JWT を発行し、iframe に引き渡します。

**セキュリティ**: `/public/init`エンドポイントは、リクエストボディやカスタムヘッダーからホスト情報を受け取らず、実際のリクエスト元（`Origin`ヘッダーまたは`request.host`）のみを使用します。これにより、任意のドメインでトークンを取得する攻撃を防ぎます。

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

ウィジェットには丸いトグルボタンが付属しており、クリックすると iframe のチャット画面が開閉します。テナントIDや鍵情報は一切露出せず、ドメインのみで認証されます。

リポジトリ内の `iframe-embed.html` をブラウザで開くと、上記スクリプトを組み込んだサンプルページをそのまま確認できます。

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
  "sessionToken": "JWT...",
  "tenant": {"id": "tenant_demo", "name": "Demo Tenant"}
}
```

**セキュリティ**: このエンドポイントは公開されていますが、実際のリクエスト元ホストのみを使用するため、任意のドメインでトークンを取得することはできません。

### 2. `/api/chat`

`Authorization: Bearer <sessionToken>` ヘッダーが必須です。ウィジェット経由では自動で付与されます。

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "こんにちは"}'
```

**セキュリティ**: JWTトークンに含まれる`host`クレームとリクエスト元ホストが照合されます。異なるドメインからのトークン再利用は拒否されます。

**レスポンス**: `tenant_id`はデバッグモード（`FLASK_ENV=development`）の場合のみ含まれます。本番環境では含まれません。

### 3. `/api/add_knowledge`

運営者向けの管理画面から利用するエンドポイントです。`tenant_id` を指定して登録すると、ベクトルDBに `tenant_id` が付与され、他テナントと分離されます。

**認証**: `ADMIN_API_KEY`が設定されている場合、`X-Admin-API-Key`ヘッダーが必要です。

```bash
# ADMIN_API_KEYが設定されている場合
curl -X POST http://localhost:8000/api/add_knowledge \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: $ADMIN_API_KEY" \
  -d '{"tenant_id": "tenant_demo", "title": "Python基礎", "content": "Pythonは汎用..."}'

# ADMIN_API_KEYが設定されていない場合（開発環境のみ推奨）
curl -X POST http://localhost:8000/api/add_knowledge \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "tenant_demo", "title": "Python基礎", "content": "Pythonは汎用..."}'
```

### 4. `/api/upload_file`

フォームデータでファイルと `tenant_id` を送信します。

**認証**: `ADMIN_API_KEY`が設定されている場合、`X-Admin-API-Key`ヘッダーが必要です。

```bash
# ADMIN_API_KEYが設定されている場合
curl -X POST http://localhost:8000/api/upload_file \
  -H "X-Admin-API-Key: $ADMIN_API_KEY" \
  -F tenant_id=tenant_demo \
  -F file=@manual.pdf
```

### 5. `/api/fetch_url`

**認証**: `ADMIN_API_KEY`が設定されている場合、`X-Admin-API-Key`ヘッダーが必要です。

```bash
# ADMIN_API_KEYが設定されている場合
curl -X POST http://localhost:8000/api/fetch_url \
  -H "Content-Type: application/json" \
  -H "X-Admin-API-Key: $ADMIN_API_KEY" \
  -d '{"tenant_id": "tenant_demo", "url": "https://example.com"}'
```

**重要**: 管理エンドポイント（`/api/add_knowledge`, `/api/upload_file`, `/api/fetch_url`）は、本番環境では必ず`ADMIN_API_KEY`を設定してください。未設定の場合、誰でも任意のテナントに知識を追加できてしまいます。

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
├── data/                # テナント設定などの永続データ
│   └── tenants.json
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

### 本番環境での必須設定

1. **`WIDGET_JWT_SECRET`は必須**
   - 本番環境（`FLASK_ENV=production`）では、`WIDGET_JWT_SECRET`が未設定の場合、アプリケーションは起動しません
   - 安全なランダム文字列を生成して設定してください（例: `openssl rand -hex 32`）

2. **`ADMIN_API_KEY`の設定を強く推奨**
   - 管理エンドポイント（`/api/add_knowledge`, `/api/upload_file`, `/api/fetch_url`）は、`ADMIN_API_KEY`が設定されていない場合、誰でもアクセス可能です
   - 本番環境では必ず設定してください

3. **CORS設定**
   - `/public/init`エンドポイントは`Origin`ヘッダーを使用するため、CORSが適切に設定されていることを確認してください
   - 現在の実装では`CORS(app)`によりすべてのオリジンからのアクセスを許可していますが、本番環境では必要に応じて制限を検討してください

4. **テナント分離**
   - JWTトークンに含まれる`host`クレームとリクエスト元ホストが照合されるため、異なるドメインからのトークン再利用は拒否されます
   - これにより、テナント間のデータ分離が保証されます

### 開発環境での注意

- 開発環境では`WIDGET_JWT_SECRET`が未設定でも起動しますが、警告が表示されます
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

### 本番環境でアプリケーションが起動しない場合
- `WIDGET_JWT_SECRET`が設定されているか確認（本番環境では必須）
- `FLASK_ENV=production`が設定されているか確認
- エラーログを確認: `docker-compose logs web`

### 管理エンドポイントにアクセスできない場合
- `ADMIN_API_KEY`が設定されている場合、`X-Admin-API-Key`ヘッダーが正しく設定されているか確認
- 開発環境では`ADMIN_API_KEY`が未設定でもアクセス可能ですが、警告が表示されます

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
