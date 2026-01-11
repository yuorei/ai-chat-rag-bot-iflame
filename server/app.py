import json
import os
import time

import sentry_sdk
from flask import Flask, jsonify, g, request
from flask_cors import CORS
from sentry_sdk.integrations.flask import FlaskIntegration
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, FieldCondition, Filter, MatchValue, PayloadSchemaType, PointIdsList, PointStruct, VectorParams
from sentence_transformers import SentenceTransformer

import settings
from ai_agent import AIAgent
from auth import require_admin_auth, require_domain_session
from domain_registry import DomainRegistry
from file_utils import add_manual_knowledge, handle_file_upload, handle_url_fetch


# Initialize Sentry error tracking
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        integrations=[FlaskIntegration()],
        traces_sample_rate=0,
        profiles_sample_rate=0,
        send_default_pii=True,
        enable_logs=True,
    )

app = Flask(__name__)
CORS(app)


@app.before_request
def sentry_set_context():
    """Attach request context to Sentry for better error debugging."""
    if settings.SENTRY_DSN:
        sentry_sdk.set_context("request", {
            "url": request.url,
            "method": request.method,
            "origin": request.headers.get('Origin', ''),
        })


qdrant_client = None
embedding_model = None
if not settings.MGMT_API_BASE_URL:
    raise ValueError("MGMT_API_BASE_URL must be set to use the management API registry")
domain_registry = DomainRegistry(
    settings.MGMT_API_BASE_URL,
    settings.MGMT_ADMIN_API_KEY,
    cache_ttl=settings.MGMT_API_CACHE_TTL,
    timeout=settings.MGMT_API_TIMEOUT_SEC,
)
ai_agent = AIAgent()


def _ensure_payload_indexes(client):
    """Ensure required payload indexes exist on the collection."""
    required_indexes = ["chat_id", "type"]
    try:
        info = client.get_collection(settings.QDRANT_COLLECTION_NAME)
        existing_indexes = set(info.payload_schema.keys()) if info.payload_schema else set()
        for field in required_indexes:
            if field not in existing_indexes:
                client.create_payload_index(
                    collection_name=settings.QDRANT_COLLECTION_NAME,
                    field_name=field,
                    field_schema=PayloadSchemaType.KEYWORD,
                )
                print(f"Created missing index for '{field}' field")
    except Exception as e:
        print(f"Warning: Failed to ensure payload indexes: {e}")


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

                # Create payload indexes for filtering
                qdrant_client.create_payload_index(
                    collection_name=settings.QDRANT_COLLECTION_NAME,
                    field_name="chat_id",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
                print("Created index for 'chat_id' field")

                qdrant_client.create_payload_index(
                    collection_name=settings.QDRANT_COLLECTION_NAME,
                    field_name="type",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
                print("Created index for 'type' field")
            else:
                print(f"Collection '{settings.QDRANT_COLLECTION_NAME}' already exists")
                # Ensure payload indexes exist for existing collection
                _ensure_payload_indexes(qdrant_client)
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
@require_domain_session(domain_registry)
def chat():
    try:
        data = request.get_json() or {}
        query = data.get('message', '')
        chat_entry = getattr(g, 'chat', {})
        chat_id = chat_entry.get('id')
        if not chat_id:
            return jsonify({'error': 'Chat configuration is invalid'}), 500
        system_prompt = chat_entry.get('system_prompt')

        # === デバッグログ: クライアントからのリクエスト ===
        request_log = {
            "severity": "INFO",
            "log_type": "chat_request",
            "message": query,
            "chat_id": chat_id,
        }
        print(json.dumps(request_log, ensure_ascii=False), flush=True)

        context = ""
        context_found = False

        # ベクター検索を実行
        if qdrant_client and embedding_model:
            try:
                query_vector = embedding_model.encode(query).tolist()

                search_filter = Filter(
                    must=[
                        FieldCondition(
                            key="chat_id",
                            match=MatchValue(value=chat_id),
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

        # === デバッグログ: LLMに渡す値 ===
        llm_input_log = {
            "severity": "INFO",
            "log_type": "llm_input",
            "query": query,
            "system_prompt_preview": system_prompt[:300] if system_prompt else None,
            "system_prompt_length": len(system_prompt) if system_prompt else 0,
            "context_found": context_found,
            "context_length": len(context),
            "context_preview": context[:500] if context else None
        }
        print(json.dumps(llm_input_log, ensure_ascii=False), flush=True)

        response = ai_agent.think_and_respond(query, context, system_prompt=system_prompt)

        response_data = {
            'response': response,
            'context_found': context_found,
            'sources_used': len(context.split("\n---\n")) if context_found else 0,
        }
        if os.getenv('FLASK_ENV') == 'development':
            response_data['chat_id'] = chat_id

        return jsonify(response_data)

    except Exception as e:
        if settings.SENTRY_DSN:
            sentry_sdk.set_context("chat", {
                "chat_id": chat_id if 'chat_id' in dir() else None,
                "query": query if 'query' in dir() else None,
                "context_found": context_found if 'context_found' in dir() else None,
            })
            sentry_sdk.capture_exception(e)
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

    host = domain_registry._normalize_domain(host)
    if not host:
        return jsonify({'ok': False, 'error': 'Invalid host'}), 400

    chat_entry = domain_registry.find_by_host(host)
    if not chat_entry:
        return jsonify({'ok': False})

    chat_id = chat_entry.get('id')
    return jsonify({
        'ok': True,
        'chatId': chat_id,
        'chat_id': chat_id,
        'chat': {
            'id': chat_id,
            'display_name': chat_entry.get('display_name'),
        }
    })


@app.route('/api/add_knowledge', methods=['POST'])
@require_admin_auth
def add_knowledge():
    try:
        data = request.get_json() or {}
        content = data.get('content', '')
        title = data.get('title', '')
        chat_id = data.get('chat_id') or data.get('domain')
        if not chat_id:
            return jsonify({'error': 'chat_id is required'}), 400
        if not domain_registry.resolve(chat_id):
            return jsonify({'error': 'Unknown chat_id'}), 404
        category = data.get('category')
        tags = data.get('tags') if isinstance(data.get('tags'), list) else []

        if qdrant_client and embedding_model:
            try:
                result, status = add_manual_knowledge(
                    content,
                    title,
                    chat_id,
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
        chat_id = request.form.get('chat_id') or request.form.get('tenant_id') or request.form.get('tenantId')
        if not chat_id:
            return jsonify({'error': 'chat_id is required'}), 400
        if not domain_registry.resolve(chat_id):
            return jsonify({'error': 'Unknown chat_id'}), 404
        if 'file' not in request.files:
            return jsonify({'error': 'ファイルが選択されていません'}), 400

        file = request.files['file']
        result, status = handle_file_upload(file, chat_id, qdrant_client, embedding_model)
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
        chat_id = data.get('chat_id') or data.get('tenant_id')
        if not chat_id:
            return jsonify({'error': 'chat_id is required'}), 400
        if not domain_registry.resolve(chat_id):
            return jsonify({'error': 'Unknown chat_id'}), 404

        if not url:
            return jsonify({'error': 'URLが入力されていません'}), 400

        if qdrant_client and embedding_model:
            result, status = handle_url_fetch(
                url,
                custom_title,
                chat_id,
                qdrant_client,
                embedding_model,
            )
            return jsonify(result), status
        return jsonify({'error': 'ベクトルデータベースに接続できません'}), 500

    except Exception as e:
        return jsonify({'error': f'URL取得エラー: {str(e)}'}), 500


@app.route('/api/knowledge/<point_id>', methods=['GET'])
@require_admin_auth
def get_knowledge(point_id):
    """Retrieve a single knowledge point from Qdrant by ID."""
    if not qdrant_client:
        return jsonify({'error': 'Qdrant not available'}), 500

    try:
        points = qdrant_client.retrieve(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            ids=[point_id],
            with_payload=True,
            with_vectors=False
        )
        if not points:
            return jsonify({'error': 'Knowledge not found'}), 404

        point = points[0]
        return jsonify({
            'id': point_id,
            'title': point.payload.get('title', ''),
            'text': point.payload.get('text', ''),
            'type': point.payload.get('type', ''),
            'source': point.payload.get('source', ''),
            'chat_id': point.payload.get('chat_id', ''),
            'timestamp': point.payload.get('timestamp', ''),
            'category': point.payload.get('category', ''),
            'tags': point.payload.get('tags', []),
        })
    except Exception as e:
        print(f"Failed to retrieve knowledge: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/knowledge/<point_id>', methods=['PUT'])
@require_admin_auth
def update_knowledge(point_id):
    """Update a knowledge point's title and/or text."""
    data = request.get_json() or {}
    new_title = data.get('title')
    new_text = data.get('text')
    chat_id = data.get('chat_id')

    if not chat_id:
        return jsonify({'error': 'chat_id is required'}), 400
    if not domain_registry.resolve(chat_id):
        return jsonify({'error': 'Unknown chat_id'}), 404

    if not qdrant_client or not embedding_model:
        return jsonify({'error': 'Qdrant not available'}), 500

    try:
        # Retrieve existing point
        points = qdrant_client.retrieve(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            ids=[point_id],
            with_payload=True,
            with_vectors=True
        )
        if not points:
            return jsonify({'error': 'Knowledge not found'}), 404

        point = points[0]
        current_payload = point.payload

        # Verify ownership
        if current_payload.get('chat_id') != chat_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Update payload
        updated_payload = {**current_payload}
        if new_title is not None:
            updated_payload['title'] = new_title

        # If text changed, re-compute vector
        current_text = current_payload.get('text', '')
        if new_text is not None and new_text != current_text:
            updated_payload['text'] = new_text
            new_vector = embedding_model.encode(new_text).tolist()
        else:
            new_vector = point.vector

        updated_payload['timestamp'] = time.time()

        # Upsert with same ID
        updated_point = PointStruct(
            id=point_id,
            vector=new_vector,
            payload=updated_payload,
        )
        qdrant_client.upsert(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            points=[updated_point],
        )

        return jsonify({
            'success': True,
            'message': 'Knowledge updated',
            'id': point_id
        })
    except Exception as e:
        print(f"Failed to update knowledge: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/knowledge/<point_id>', methods=['DELETE'])
@require_admin_auth
def delete_knowledge(point_id):
    """Delete a knowledge point from Qdrant."""
    chat_id = request.args.get('chat_id')

    if not chat_id:
        return jsonify({'error': 'chat_id is required'}), 400
    if not domain_registry.resolve(chat_id):
        return jsonify({'error': 'Unknown chat_id'}), 404

    if not qdrant_client:
        return jsonify({'error': 'Qdrant not available'}), 500

    try:
        # Verify ownership first
        points = qdrant_client.retrieve(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            ids=[point_id],
            with_payload=True,
            with_vectors=False
        )
        if not points:
            return jsonify({'error': 'Knowledge not found'}), 404

        if points[0].payload.get('chat_id') != chat_id:
            return jsonify({'error': 'Unauthorized'}), 403

        qdrant_client.delete(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            points_selector=PointIdsList(points=[point_id])
        )
        return jsonify({'success': True, 'deleted': True})
    except Exception as e:
        print(f"Failed to delete knowledge: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
