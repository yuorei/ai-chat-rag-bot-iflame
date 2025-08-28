# AI Chat Bot with RAG

RAG（Retrieval-Augmented Generation）機能付きのAIチャットボットです。Gemini APIを使用し、思考プロセスを可視化するAI Agentとして動作します。iframe対応で外部サイトに埋め込み可能です。

## 機能

- 🤖 Gemini API による高性能なAI応答
- 🧠 思考プロセスを可視化するAI Agent
- 📚 RAG機能（ChromaDBによるベクトル検索）
- 🌐 iframe対応のWebインターフェース
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

## API仕様

### チャット
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "こんにちは"}'
```

### 知識追加
```bash
curl -X POST http://localhost:8000/api/add_knowledge \
  -H "Content-Type: application/json" \
  -d '{"title": "Python基礎", "content": "Pythonは汎用プログラミング言語です"}'
```

### ヘルスチェック
```bash
curl http://localhost:8000/health
```

## iframe埋め込み

```html
<iframe 
  src="http://localhost:3000" 
  width="800" 
  height="600"
  frameborder="0">
</iframe>
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
    └── index.html      # チャットUI
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