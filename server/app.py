import os
import time

from flask import Flask, jsonify, g, request
from flask_cors import CORS
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, FieldCondition, Filter, MatchValue, VectorParams
from sentence_transformers import SentenceTransformer

import settings
from ai_agent import AIAgent
from auth import issue_session_token, require_admin_auth, require_tenant_session
from file_utils import add_manual_knowledge, handle_file_upload, handle_url_fetch
from tenant_registry import TenantRegistry


app = Flask(__name__)
CORS(app)

qdrant_client = None
embedding_model = None
tenant_registry = TenantRegistry(settings.TENANT_CONFIG_PATH)
ai_agent = AIAgent()


def init_qdrant():
    """Qdrantクライアントと埋め込みモデルの初期化を行う。"""
    global qdrant_client, embedding_model
    max_retries = 5
    retry_delay = 2

    for attempt in range(max_retries):
        try:
            print(f"Attempting to connect to Qdrant (attempt {attempt + 1}/{max_retries})")
            qdrant_kwargs = {}
            if settings.QDRANT_URL:
                qdrant_kwargs["url"] = settings.QDRANT_URL
                if settings.QDRANT_API_KEY:
                    qdrant_kwargs["api_key"] = settings.QDRANT_API_KEY
                print(f"Connecting to Qdrant via URL endpoint: {settings.QDRANT_URL}")
            else:
                qdrant_kwargs["host"] = settings.QDRANT_HOST
                qdrant_kwargs["port"] = settings.QDRANT_PORT
                print(f"Connecting to Qdrant via host/port: {settings.QDRANT_HOST}:{settings.QDRANT_PORT}")
            qdrant_client = QdrantClient(**qdrant_kwargs)

            # 接続テスト
            qdrant_client.get_collections()

            # 埋め込みモデルの初期化
            embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

            # コレクションの確認/作成
            collections = qdrant_client.get_collections()
            collection_exists = any(
                col.name == settings.QDRANT_COLLECTION_NAME for col in collections.collections
            )

            if not collection_exists:
                qdrant_client.create_collection(
                    collection_name=settings.QDRANT_COLLECTION_NAME,
                    vectors_config=VectorParams(size=384, distance=Distance.COSINE),
                )
                print(f"Created collection '{settings.QDRANT_COLLECTION_NAME}'")
            else:
                print(f"Collection '{settings.QDRANT_COLLECTION_NAME}' already exists")
            print("Qdrant connected successfully")
            return True

        except Exception as e:
            print(f"Qdrant connection attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print("All Qdrant connection attempts failed")
                qdrant_client = None
                embedding_model = None
                return False


# 初期化実行
init_qdrant()


@app.route('/api/chat', methods=['POST'])
@require_tenant_session(tenant_registry)
def chat():
    try:
        data = request.get_json() or {}
        query = data.get('message', '')
        tenant = getattr(g, 'tenant', {})
        tenant_id = tenant.get('id')
        if not tenant_id:
            return jsonify({'error': 'Tenant configuration is invalid'}), 500
        system_prompt = tenant.get('system_prompt')

        context = ""
        context_found = False

        if qdrant_client and embedding_model:
            try:
                query_vector = embedding_model.encode(query).tolist()

                search_filter = Filter(
                    must=[
                        FieldCondition(
                            key="tenant_id",
                            match=MatchValue(value=tenant_id),
                        )
                    ],
                    must_not=[
                        FieldCondition(
                            key="type",
                            match=MatchValue(value="chat"),
                        )
                    ],
                )

                search_result = qdrant_client.search(
                    collection_name=settings.QDRANT_COLLECTION_NAME,
                    query_vector=query_vector,
                    limit=10,
                    query_filter=search_filter,
                )
                print(f"Vector search results: {len(search_result)} candidates found")
                if search_result:
                    context_items = []
                    for i, point in enumerate(search_result):
                        print(
                            f"  Candidate {i+1}: score={point.score:.3f}, title='{point.payload.get('title', 'No title')}'"
                        )
                        if point.score > 0.05:
                            context_items.append(point.payload.get('text', ''))
                            print(
                                f"    -> Added to context (text length: {len(point.payload.get('text', ''))})"
                            )

                    if context_items:
                        context = "\n---\n".join(context_items)
                        context_found = True
                        print(
                            f"Final context items: {len(context_items)}, total context length: {len(context)}"
                        )
                    else:
                        print("No items passed the score threshold")

            except Exception as e:
                print(f"Vector search failed: {e}")

        response = ai_agent.think_and_respond(query, context, system_prompt=system_prompt)

        response_data = {
            'response': response,
            'context_found': context_found,
            'sources_used': len(context.split("\n---\n")) if context_found else 0,
        }
        if os.getenv('FLASK_ENV') == 'development':
            response_data['tenant_id'] = tenant_id

        return jsonify(response_data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/public/init', methods=['POST'])
def public_init():
    host = request.headers.get('Origin', '')
    if host:
        try:
            from urllib.parse import urlparse

            parsed_origin = urlparse(host)
            host = parsed_origin.netloc
        except Exception:
            host = ''

    if not host:
        host = request.host

    host = tenant_registry._normalize_domain(host)
    if not host:
        return jsonify({'ok': False, 'error': 'Invalid host'}), 400

    tenant = tenant_registry.find_by_host(host)
    if not tenant:
        return jsonify({'ok': False})

    tenant_id = tenant.get('id')
    token = issue_session_token(tenant_id, host)
    return jsonify({
        'ok': True,
        'sessionToken': token,
        'tenant': {
            'id': tenant_id,
            'name': tenant.get('name'),
        },
    })


@app.route('/api/add_knowledge', methods=['POST'])
@require_admin_auth
def add_knowledge():
    try:
        data = request.get_json() or {}
        content = data.get('content', '')
        title = data.get('title', '')
        tenant_id = data.get('tenant_id')
        if not tenant_id:
            return jsonify({'error': 'tenant_id is required'}), 400
        if not tenant_registry.get(tenant_id):
            return jsonify({'error': 'Unknown tenant_id'}), 404
        category = data.get('category')
        tags = data.get('tags') if isinstance(data.get('tags'), list) else []

        if qdrant_client and embedding_model:
            try:
                result, status = add_manual_knowledge(
                    content,
                    title,
                    tenant_id,
                    category,
                    tags,
                    qdrant_client,
                    embedding_model,
                )
                return jsonify(result), status
            except Exception as e:
                print(f"Failed to add knowledge to Qdrant: {e}")
                return jsonify({'error': f'知識の追加に失敗しました: {str(e)}'}), 500
        return jsonify({'error': 'Qdrantに接続できません'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/upload_file', methods=['POST'])
@require_admin_auth
def upload_file():
    try:
        tenant_id = request.form.get('tenant_id') or request.form.get('tenantId')
        if not tenant_id:
            return jsonify({'error': 'tenant_id is required'}), 400
        if not tenant_registry.get(tenant_id):
            return jsonify({'error': 'Unknown tenant_id'}), 404
        if 'file' not in request.files:
            return jsonify({'error': 'ファイルが選択されていません'}), 400

        file = request.files['file']
        result, status = handle_file_upload(file, tenant_id, qdrant_client, embedding_model)
        return jsonify(result), status
    except Exception as e:
        return jsonify({'error': f'アップロードエラー: {str(e)}'}), 500


@app.route('/api/fetch_url', methods=['POST'])
@require_admin_auth
def fetch_url():
    try:
        data = request.get_json() or {}
        url = data.get('url', '').strip()
        custom_title = data.get('title', '').strip()
        tenant_id = data.get('tenant_id')
        if not tenant_id:
            return jsonify({'error': 'tenant_id is required'}), 400
        if not tenant_registry.get(tenant_id):
            return jsonify({'error': 'Unknown tenant_id'}), 404

        if not url:
            return jsonify({'error': 'URLが入力されていません'}), 400

        if qdrant_client and embedding_model:
            result, status = handle_url_fetch(
                url,
                custom_title,
                tenant_id,
                qdrant_client,
                embedding_model,
            )
            return jsonify(result), status
        return jsonify({'error': 'ベクトルデータベースに接続できません'}), 500

    except Exception as e:
        return jsonify({'error': f'URL取得エラー: {str(e)}'}), 500


@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
