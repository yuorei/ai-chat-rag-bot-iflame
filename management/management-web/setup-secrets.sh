#!/bin/bash

# .env から全てのシークレットを読み込んで Cloudflare Workers に設定するスクリプト
# 使い方: ./setup-secrets.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "エラー: .env ファイルが見つかりません"
    exit 1
fi

echo "=========================================="
echo "  Cloudflare Workers シークレット設定"
echo "=========================================="
echo ""
echo "設定するシークレット:"

# .env の内容を表示（値は一部マスク）
while IFS='=' read -r key value || [ -n "$key" ]; do
    # 空行やコメント行をスキップ
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    # 値の最初の10文字だけ表示
    masked="${value:0:10}"
    if [ ${#value} -gt 10 ]; then
        masked="${masked}..."
    fi
    echo "  $key: $masked"
done < "$ENV_FILE"

echo ""
read -p "続行しますか？ (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "キャンセルしました"
    exit 0
fi

cd "$SCRIPT_DIR"

echo ""

# .env の各行を処理してシークレットを設定
while IFS='=' read -r key value || [ -n "$key" ]; do
    # 空行やコメント行をスキップ
    [[ -z "$key" || "$key" =~ ^# ]] && continue

    echo "$key を設定中..."
    echo "$value" | npx wrangler secret put "$key"
done < "$ENV_FILE"

echo ""
echo "完了しました"
