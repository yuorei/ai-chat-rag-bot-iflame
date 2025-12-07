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

`.env`ファイルを編集してGemini API Keyを設定：
```
GEMINI_API_KEY=your_actual_gemini_api_key_here
FLASK_ENV=development
FLASK_APP=app.py
```

併せて `WIDGET_JWT_SECRET` を安全な値に変更し、`data/tenants.json` に利用したいサイトやコミュニティのテナント情報（`allowed_domains` を含む）を登録してください。

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

## アクセス方法

- **フロントエンド**: http://localhost:3000
- **API**: http://localhost:8000
- **ChromaDB**: http://localhost:8001

## テナント管理とウィジェット公開

1. `data/tenants.json` にサイト／プロジェクトごとの設定を登録します。最低限、`id` / `name` / `allowed_domains` / `system_prompt` を記載してください。
2. 公開したいサイトに貼るのは 1 行のスクリプトだけです。

```html
<script src="https://chat.example.com/widget.js" defer></script>
```

`widget.js` は現在のホスト名を `https://api.example.com/public/init` に送信し、該当ドメインのテナントを自動判定します。サーバーはテナントIDを含む JWT を発行し、iframe に引き渡します。

### ローカル／カスタム構成

本番のように API とチャットのホスト名が異なる場合は、スクリプトの直前に以下を仕込むか、`widget.js` の `data-api-base` / `data-widget-base` 属性を利用してください。

```html
<script>
  window.IFLAME_WIDGET_CONFIG = {
    apiBaseUrl: 'http://localhost:8000',
    widgetBaseUrl: 'http://localhost:3000'
  };
</script>
<script src="http://localhost:3000/widget.js" defer></script>
```

ウィジェットには丸いトグルボタンが付属しており、クリックすると iframe のチャット画面が開閉します。テナントIDや鍵情報は一切露出せず、ドメインのみで認証されます。

リポジトリ内の `iframe-embed.html` をブラウザで開くと、上記スクリプトを組み込んだサンプルページをそのまま確認できます。

## API仕様

### 1. `/public/init`
任意のサイトに埋め込まれた `widget.js` がコールし、現在のドメインからテナントを自動判定します。

```bash
curl -X POST http://localhost:8000/public/init \
  -H "Content-Type: application/json" \
  -d '{"host": "www.example.com"}'
```

レスポンス（該当テナントがある場合）

```json
{
  "ok": true,
  "sessionToken": "JWT...",
  "tenant": {"id": "tenant_demo", "name": "Demo Tenant"}
}
```

### 2. `/api/chat`

`Authorization: Bearer <sessionToken>` ヘッダーが必須です。ウィジェット経由では自動で付与されます。

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "こんにちは"}'
```

### 3. `/api/add_knowledge`

運営者向けの管理画面から利用するエンドポイントです。`tenant_id` を指定して登録すると、ベクトルDBに `tenant_id` が付与され、他テナントと分離されます。

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

### 6. `/health`

```bash
curl http://localhost:8000/health
```

## 埋め込みスニペット

どんなサイトにも以下の 1 行を貼るだけで構成できます（必要に応じて `window.IFLAME_WIDGET_CONFIG` でAPIのURLなどを上書きしてください）。

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

## トラブルシューティング

### ポートが使用中の場合
```bash
# 使用中のプロセスを確認
lsof -i :3000
lsof -i :8000
lsof -i :8001

# docker-compose.ymlのポート番号を変更
```

### ChromaDBが起動しない場合
```bash
# データディレクトリの権限確認
mkdir -p chroma_data
chmod 755 chroma_data

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

## ライセンス

MIT License
