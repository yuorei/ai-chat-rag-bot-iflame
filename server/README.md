# AI Chat iFlame - Backend Server

RAGベースのAIチャットボットのバックエンドAPIサーバー。

## 技術スタック

- **Python 3.11**
- **Flask** - WebフレームワーA ク
- **Google Gemini API** - AI応答生成
- **Qdrant** - ベクトルデータベース
- **Sentence Transformers** - テキスト埋め込み (`all-MiniLM-L6-v2`)

## ディレクトリ構成

```
server/
├── app.py              # メインFlaskアプリケーション
├── ai_agent.py         # Gemini APIを使用したAIエージェント
├── auth.py             # 認証デコレーター
├── domain_registry.py  # ドメインベースのテナント管理
├── file_utils.py       # ファイル処理ユーティリティ
├── settings.py         # 環境変数・設定管理
├── requirements.txt    # Python依存関係
├── Dockerfile          # Dockerイメージ定義
└── data/               # データディレクトリ
```

## APIエンドポイント

### Public

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/health` | GET | ヘルスチェック |
| `/public/init` | POST | ドメインからチャット設定を取得 |

### Chat

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/chat` | POST | AIチャット応答を生成 |

### Admin (要認証)

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/api/add_knowledge` | POST | ナレッジを手動追加 |
| `/api/upload_file` | POST | ファイルをアップロードしてナレッジに追加 |
| `/api/fetch_url` | POST | URLからコンテンツを取得してナレッジに追加 |

## 環境変数

### 必須

| 変数名 | 説明 |
|-------|------|
| `GEMINI_API_KEY` | Google Gemini APIキー |
| `MGMT_API_BASE_URL` | 管理サーバーのベースURL |

### Qdrant接続

| 変数名 | デフォルト | 説明 |
|-------|-----------|------|
| `QDRANT_URL` | - | Qdrant Cloud等のURL（設定時はURL接続を使用） |
| `QDRANT_API_KEY` | - | Qdrant APIキー |
| `QDRANT_HOST` | `vectordb` | Qdrantホスト名（URL未設定時） |
| `QDRANT_PORT` | `6333` | Qdrantポート番号 |

### オプション

| 変数名 | デフォルト | 説明 |
|-------|-----------|------|
| `GEMINI_MODEL_NAME` | `gemini-2.0-flash-lite` | 使用するGeminiモデル |
| `MGMT_ADMIN_API_KEY` | - | 管理サーバー用APIキー |
| `MGMT_API_CACHE_TTL` | `30` | ドメイン情報のキャッシュTTL（秒） |
| `MGMT_API_TIMEOUT_SEC` | `5` | 管理サーバーへのリクエストタイムアウト（秒） |
| `WIDGET_JWT_SECRET` | `dev-change-me` | JWT署名用シークレット |
| `WIDGET_SESSION_TTL_SECONDS` | `21600` (6時間) | セッショントークンの有効期限 |
| `ADMIN_API_KEY` | - | 管理API用のAPIキー |
| `FLASK_ENV` | - | `development`で開発モード |

## ローカル開発

### Docker Composeを使用

```bash
# ルートディレクトリで実行
docker-compose up --build
```

### 直接実行

```bash
cd server
pip install -r requirements.txt
python app.py
```

サーバーは `http://localhost:8000` で起動します。

## 対応ファイル形式

アップロード可能なファイル形式：
- テキスト: `.txt`, `.md`
- ドキュメント: `.pdf`, `.docx`
- データ: `.json`

最大ファイルサイズ: 16MB

## Cloud Runへのデプロイ

```bash
# Dockerイメージをビルド
docker build -t asia-northeast1-docker.pkg.dev/yuovision/ai-chat-iflame/server:latest ./server

# イメージをプッシュ
docker push asia-northeast1-docker.pkg.dev/yuovision/ai-chat-iflame/server:latest

# Cloud Runにデプロイ
gcloud run deploy ai-chat-iflame-server \
    --project yuovision \
    --region asia-northeast1 \
    --image asia-northeast1-docker.pkg.dev/yuovision/ai-chat-iflame/server:latest \
    --platform managed
```

## Qdrantデータ構造

コレクション名: `chat_context`

ベクトル: 384次元（all-MiniLM-L6-v2）

### ペイロードスキーマ

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `text` | string | テキストコンテンツ |
| `title` | string | タイトル |
| `chat_id` | keyword | チャットID（インデックス付き） |
| `type` | keyword | タイプ: `knowledge`, `chat`, `file_upload`, `url_fetch` |
| `timestamp` | string | 登録日時 |
| `source` | string | ソース種別 |
| `category` | string | カテゴリ（オプション） |
| `tags` | array | タグリスト（オプション） |
