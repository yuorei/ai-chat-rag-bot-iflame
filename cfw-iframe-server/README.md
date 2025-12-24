# cfw-iframe-server

iframeチャットウィジェット用のCloudflare Workers APIサーバー。ドメインベースでチャットプロファイルを解決し、Pythonバックエンドにメッセージを転送します。

## 技術スタック

- **Hono** - 軽量なWebフレームワーク
- **Cloudflare Workers** - エッジコンピューティング
- **Cloudflare D1** - SQLiteベースのデータベース

## セットアップ

```bash
npm install
```

## 開発

```bash
npm run dev
```

ローカルで http://localhost:8787 にサーバーが起動します。

## デプロイ

```bash
npm run deploy
```

## API エンドポイント

### `GET /health`
ヘルスチェック。D1データベースへの接続を確認します。

```bash
curl https://cfw-iframe-server.<your-subdomain>.workers.dev/health
```

**レスポンス:**
```json
{ "status": "ok", "service": "cfw-iframe-server" }
```

### `GET /init?target=<domain>`
ドメインからチャットプロファイルを取得します。

```bash
curl "https://cfw-iframe-server.<your-subdomain>.workers.dev/init?target=example.com"
```

**レスポンス:**
```json
{
  "chat_id": "uuid-xxxx",
  "display_name": "サポートBot",
  "target_type": "customer_support"
}
```

### `POST /init`
リクエストボディでターゲットを指定してプロファイルを取得します。

```bash
curl -X POST https://cfw-iframe-server.<your-subdomain>.workers.dev/init \
  -H "Content-Type: application/json" \
  -d '{"target": "example.com"}'
```

### `POST /chat`
チャットメッセージをPythonバックエンドサーバーに転送します。

```bash
curl -X POST https://cfw-iframe-server.<your-subdomain>.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "こんにちは", "chat_id": "uuid-xxxx"}'
```

**リクエストボディ:**
- `message` (必須): チャットメッセージ
- `chat_id` (任意): チャットプロファイルID
- `target` (任意): chat_idがない場合、ドメインから解決

**レスポンス:**
```json
{
  "response": "AIからの応答メッセージ"
}
```

### `GET /profile/:chatId`
チャットIDから公開プロファイル情報を取得します。

```bash
curl https://cfw-iframe-server.<your-subdomain>.workers.dev/profile/uuid-xxxx
```

## 環境変数

`wrangler.jsonc` で設定:

| 変数名 | 説明 |
|--------|------|
| `PYTHON_SERVER_URL` | Pythonバックエンドサーバーのエンドポイント |
| `ALLOWED_ORIGINS` | CORS許可オリジン (`*` または カンマ区切りのドメイン) |

## D1データベース

以下のテーブルを使用します:

- `chat_profiles` - チャットプロファイル情報
- `chat_targets` - ドメインとチャットプロファイルのマッピング

## 型生成

Wrangler設定からTypeScript型を生成:

```bash
npm run cf-typegen
```
