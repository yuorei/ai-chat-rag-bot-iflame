# Terraform - AI Chat iFlame Infrastructure

Google Cloud Platform上にAI Chat iFlameをデプロイするためのTerraform構成です。

## ディレクトリ構造

```
terraform/
├── modules/
│   └── cloud_run/          # Cloud Run再利用モジュール
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
└── env/
    └── prod/               # 本番環境
        ├── main.tf
        ├── variables.tf
        ├── outputs.tf
        ├── terraform.tfvars.example
        └── deploy.sh       # デプロイスクリプト
```

## 前提条件

- Terraform >= 1.0.0
- Google Cloud SDK (gcloud CLI)
- Docker
- GCPプロジェクト（課金有効化済み）

## セットアップ

### 1. GCP認証

```bash
gcloud auth login
gcloud auth application-default login
```

### 2. 設定ファイルの作成

```bash
cd terraform/env/prod
cp terraform.tfvars.example terraform.tfvars
```

`terraform.tfvars` を編集して必要な値を設定:

```hcl
# GCP Project Configuration
project_id = "your-gcp-project-id"
region     = "asia-northeast1"

# Container Image
image_tag = "latest"

# Cloud Run Resources
cpu           = "1"
memory        = "1Gi"
min_instances = 0
max_instances = 10

# Gemini Configuration
gemini_model_name = "gemini-2.0-flash-lite"

# Qdrant Configuration
qdrant_url = "https://your-qdrant-endpoint:6333"

# Management API Configuration (optional)
mgmt_api_base_url = "https://your-management-api.example.com"

# API Keys (sensitive)
gemini_api_key = "your-gemini-api-key"
qdrant_api_key = "your-qdrant-api-key"
```

### 3. Terraformの初期化

```bash
./deploy.sh init
```

## デプロイ

### ワンコマンドデプロイ（推奨）

```bash
./deploy.sh deploy
```

これにより以下が実行されます:
1. Dockerイメージのビルドとプッシュ
2. Terraformによるインフラ適用

### 個別コマンド

```bash
# Dockerイメージのビルドとプッシュのみ
./deploy.sh build

# Terraformプランの確認
./deploy.sh plan

# Terraformの適用
./deploy.sh apply
```

## インフラ構成

デプロイされるリソース:

| リソース | 説明 |
|---------|------|
| Cloud Run Service | AI Chatサーバー |
| Artifact Registry | Dockerイメージリポジトリ |
| IAM | 公開アクセス設定 |

## 変数一覧

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `project_id` | GCPプロジェクトID | - (必須) |
| `region` | デプロイリージョン | `asia-northeast1` |
| `image_tag` | Dockerイメージタグ | `latest` |
| `cpu` | CPU割り当て | `1` |
| `memory` | メモリ割り当て | `1Gi` |
| `min_instances` | 最小インスタンス数 | `0` |
| `max_instances` | 最大インスタンス数 | `10` |
| `gemini_model_name` | Geminiモデル名 | `gemini-2.0-flash-lite` |
| `qdrant_url` | QdrantのURL | - (必須) |
| `gemini_api_key` | Gemini APIキー | - (必須) |
| `qdrant_api_key` | Qdrant APIキー | - (必須) |

## 出力値

デプロイ後に以下の値が出力されます:

```bash
# サービスURLの確認
terraform output service_url

# Artifact Registryリポジトリの確認
terraform output artifact_registry_repository
```

## 削除

```bash
./deploy.sh destroy
```

## リモートステート（オプション）

チーム開発の場合、GCSバックエンドを有効化できます。
`env/prod/main.tf` のbackendブロックのコメントを解除してください:

```hcl
backend "gcs" {
  bucket = "your-terraform-state-bucket"
  prefix = "ai-chat-iflame/prod"
}
```

## トラブルシューティング

### API有効化エラー

必要なAPIが自動で有効化されますが、手動で有効化する場合:

```bash
gcloud services enable run.googleapis.com --project=YOUR_PROJECT_ID
gcloud services enable artifactregistry.googleapis.com --project=YOUR_PROJECT_ID
```

### 認証エラー

```bash
gcloud auth application-default login
gcloud auth configure-docker asia-northeast1-docker.pkg.dev
```
