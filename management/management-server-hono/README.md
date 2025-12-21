## セットアップ

```bash
npm install
```

### D1 データベース作成とマイグレーション

```bash
# DB 作成（ローカルの場合）
wrangler d1 create management-server-hono

# wrangler.jsonc の database_id を設定
# 初期スキーマ適用
wrangler d1 migrations apply management-server-hono --local
```

### 開発 / デプロイ

```bash
npm run dev       # wrangler dev
npm run deploy    # wrangler deploy --minify
npm run cf-typegen
```

環境変数は `wrangler.jsonc` の `vars` か `--var` で渡してください。
主なキー: `MGMT_AUTH_SECRET`, `MGMT_ADMIN_API_KEY`, `MGMT_FLASK_BASE_URL`, `MGMT_ALLOWED_ORIGINS`, `MGMT_ALLOW_OPEN_SIGNUP`, `MGMT_COOKIE_SECURE`, `MGMT_MAX_UPLOAD_MB`, `MGMT_HTTP_TIMEOUT_SEC`。
