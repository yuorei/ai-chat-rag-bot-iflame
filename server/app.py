from flask import Flask, request, jsonify, g
from flask_cors import CORS
import google.generativeai as genai
from google.api_core.exceptions import DeadlineExceeded, GoogleAPICallError, ResourceExhausted
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from sentence_transformers import SentenceTransformer
import os
from dotenv import load_dotenv
import json
import time
import uuid
from werkzeug.utils import secure_filename
import PyPDF2
import pdfplumber
from docx import Document
from bs4 import BeautifulSoup
import tempfile
import requests
import traceback
from functools import wraps
import jwt
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

load_dotenv()

app = Flask(__name__)
CORS(app)

# アップロード設定
UPLOAD_FOLDER = '/tmp/uploads'
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx', 'md', 'json'}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Gemini API設定
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
GEMINI_MODEL_NAME = os.getenv('GEMINI_MODEL_NAME', 'gemini-2.0-flash-lite')

# Qdrant設定
collection_name = "chat_context"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_TENANT_PATH = os.path.join(BASE_DIR, 'data', 'tenants.json')
# serverコンテナでは data ディレクトリを /app/data にマウントしているため、
# 存在しない場合は上位階層の data も探す
if not os.path.exists(DEFAULT_TENANT_PATH):
    alt_path = os.path.join(os.path.dirname(BASE_DIR), 'data', 'tenants.json')
    if os.path.exists(alt_path):
        DEFAULT_TENANT_PATH = alt_path

TENANT_CONFIG_PATH = os.getenv('TENANT_CONFIG_PATH', DEFAULT_TENANT_PATH)
JWT_SECRET = os.getenv('WIDGET_JWT_SECRET')
if not JWT_SECRET:
    flask_env = os.getenv('FLASK_ENV', 'production')
    if flask_env == 'production':
        raise ValueError("WIDGET_JWT_SECRET must be set in production environment")
    print("[WARN] WIDGET_JWT_SECRET is not set. Falling back to an unsafe development secret.")
    JWT_SECRET = 'dev-change-me'

SESSION_TOKEN_TTL = int(os.getenv('WIDGET_SESSION_TTL_SECONDS', 60 * 60 * 6))
JWT_ALGORITHM = 'HS256'

# 管理エンドポイント用のAPIキー（オプション）
ADMIN_API_KEY = os.getenv('ADMIN_API_KEY')

def init_qdrant():
    global qdrant_client, embedding_model
    max_retries = 5
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            print(f"Attempting to connect to Qdrant (attempt {attempt + 1}/{max_retries})")
            qdrant_client = QdrantClient(host="vectordb", port=6333)
            
            # 接続テスト
            qdrant_client.get_collections()
            
            # 埋め込みモデルの初期化
            embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            
            # コレクションの確認/作成
            collections = qdrant_client.get_collections()
            collection_exists = any(col.name == collection_name for col in collections.collections)
            
            if not collection_exists:
                qdrant_client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(size=384, distance=Distance.COSINE)
                )
                print(f"Created collection '{collection_name}'")
            else:
                print(f"Collection '{collection_name}' already exists")
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

# ファイル処理関数
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def normalize_pdf_text(raw_text: str) -> str:
    """PDFで1文字ごとに改行されるパターンを緩和する"""
    lines = raw_text.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    normalized = []
    short_buffer = []
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if short_buffer:
                normalized.append(''.join(short_buffer))
                short_buffer = []
            normalized.append('')
            continue
        
        if len(stripped) <= 2:
            short_buffer.append(stripped)
        else:
            if short_buffer:
                normalized.append(''.join(short_buffer))
                short_buffer = []
            normalized.append(line.strip())
    
    if short_buffer:
        normalized.append(''.join(short_buffer))
    
    # 連続した空行を1つにまとめる
    cleaned = []
    previous_blank = False
    for line in normalized:
        if not line:
            if not previous_blank:
                cleaned.append('')
            previous_blank = True
        else:
            cleaned.append(line)
            previous_blank = False
    
    return "\n".join(cleaned).strip()

def extract_text_from_file(file_path, file_extension):
    """ファイルからテキストを抽出"""
    try:
        if file_extension == 'txt':
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        
        elif file_extension == 'md':
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        
        elif file_extension == 'json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return json.dumps(data, ensure_ascii=False, indent=2)
        
        elif file_extension == 'pdf':
            text_parts = []
            try:
                with pdfplumber.open(file_path) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text(x_tolerance=1, y_tolerance=1)
                        if page_text:
                            text_parts.append(page_text)
            except Exception as e:
                print(f"pdfplumber failed ({e}), falling back to PyPDF2")
                with open(file_path, 'rb') as f:
                    pdf_reader = PyPDF2.PdfReader(f)
                    for page in pdf_reader.pages:
                        extracted = page.extract_text()
                        if extracted:
                            text_parts.append(extracted)
            
            text = "\n\n".join(text_parts).strip()
            return normalize_pdf_text(text) if text else text
        
        elif file_extension == 'docx':
            doc = Document(file_path)
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            return text
        
        else:
            return None
            
    except Exception as e:
        print(f"Error extracting text from {file_path}: {e}")
        return None

def fetch_url_content(url):
    """URLからコンテンツを取得"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # 不要な要素を除去
        for element in soup(['script', 'style', 'nav', 'header', 'footer']):
            element.decompose()
        
        # タイトル取得
        title = soup.find('title')
        title_text = title.get_text().strip() if title else ""
        
        # メインコンテンツ取得
        content_selectors = ['main', 'article', '.content', '#content', '.post', '.article']
        content = None
        
        for selector in content_selectors:
            content = soup.select_one(selector)
            if content:
                break
        
        if not content:
            content = soup.find('body')
        
        text = content.get_text(separator='\n', strip=True) if content else ""
        
        return {
            'title': title_text,
            'content': text,
            'url': url
        }
        
    except Exception as e:
        print(f"Error fetching URL {url}: {e}")
        return None


class TenantRegistry:
    def __init__(self, config_path):
        self.config_path = config_path
        self.tenants = {}
        self.domain_map = {}
        self.reload()

    def reload(self):
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except FileNotFoundError:
            print(f"[WARN] Tenant config not found at {self.config_path}")
            self.tenants = {}
            self.domain_map = {}
            return
        except json.JSONDecodeError as e:
            print(f"[ERROR] Tenant config is invalid JSON: {e}")
            self.tenants = {}
            self.domain_map = {}
            return

        tenants = {}
        domain_map = {}
        for entry in data.get('tenants', []):
            tenant_id = entry.get('id')
            if not tenant_id:
                continue

            entry['id'] = tenant_id
            entry['allowed_domains'] = entry.get('allowed_domains', [])
            tenants[tenant_id] = entry

            for domain in entry['allowed_domains']:
                normalized = self._normalize_domain(domain)
                if not normalized:
                    continue
                domain_map[normalized] = tenant_id
                if normalized.startswith('www.'):
                    domain_map[normalized[4:]] = tenant_id
                else:
                    domain_map[f"www.{normalized}"] = tenant_id

        self.tenants = tenants
        self.domain_map = domain_map

    def get(self, tenant_id):
        return self.tenants.get(tenant_id)

    def find_by_host(self, host):
        for candidate in self._candidate_domains(host):
            tenant_id = self.domain_map.get(candidate)
            if tenant_id:
                return self.tenants.get(tenant_id)
        return None

    def _candidate_domains(self, host):
        normalized = self._normalize_domain(host)
        if not normalized:
            return []
        candidates = [normalized]
        if normalized.startswith('www.'):
            candidates.append(normalized[4:])
        else:
            candidates.append(f"www.{normalized}")
        return candidates

    def _normalize_domain(self, value):
        if not value:
            return None
        value = value.strip()
        if value.startswith('http://') or value.startswith('https://'):
            parsed = urlparse(value)
            value = parsed.netloc or parsed.path
        value = value.split('/')[0]
        value = value.split(':')[0]
        value = value.lower()
        if value.startswith('.'):
            value = value[1:]
        return value or None


tenant_registry = TenantRegistry(TENANT_CONFIG_PATH)


def issue_session_token(tenant_id, host):
    now = datetime.now(timezone.utc)
    payload = {
        'tenant_id': tenant_id,
        'host': host,
        'session_id': str(uuid.uuid4()),
        'iat': now,
        'exp': now + timedelta(seconds=SESSION_TOKEN_TTL)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    if isinstance(token, bytes):
        return token.decode('utf-8')
    return token


def decode_session_token(token):
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def extract_bearer_token():
    auth_header = request.headers.get('Authorization', '')
    if auth_header.lower().startswith('bearer '):
        return auth_header[7:].strip()
    return request.args.get('token')


def require_admin_auth(fn):
    """管理エンドポイント用の認証デコレータ（オプション）"""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if ADMIN_API_KEY:
            # APIキーが設定されている場合は認証を要求
            provided_key = request.headers.get('X-Admin-API-Key') or request.args.get('admin_api_key')
            if not provided_key or provided_key != ADMIN_API_KEY:
                return jsonify({'error': 'Admin authentication required'}), 401
        # APIキーが設定されていない場合は警告のみ（開発環境用）
        elif os.getenv('FLASK_ENV') == 'production':
            print("[WARN] ADMIN_API_KEY is not set. Admin endpoints are unprotected.")
        return fn(*args, **kwargs)
    return wrapper


def require_tenant_session(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = extract_bearer_token()
        if not token:
            return jsonify({'error': 'Missing session token'}), 401
        try:
            payload = decode_session_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Session expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid session token'}), 401

        tenant_id = payload.get('tenant_id')
        tenant = tenant_registry.get(tenant_id)
        if not tenant:
            return jsonify({'error': 'Unknown tenant'}), 401

        # JWTのhostクレームとリクエスト元を照合
        token_host = payload.get('host', '').strip()
        if token_host:
            # リクエスト元ホストを取得（Originヘッダーまたはrequest.host）
            request_host = request.headers.get('Origin', '')
            if request_host:
                try:
                    parsed_origin = urlparse(request_host)
                    request_host = parsed_origin.netloc
                except:
                    pass
            if not request_host:
                request_host = request.host
            
            # ホストを正規化して比較
            tenant_registry_normalizer = tenant_registry._normalize_domain
            normalized_token_host = tenant_registry_normalizer(token_host)
            normalized_request_host = tenant_registry_normalizer(request_host)
            
            if normalized_token_host and normalized_request_host:
                # www.の有無を考慮して比較
                token_candidates = tenant_registry._candidate_domains(token_host)
                request_candidates = tenant_registry._candidate_domains(request_host)
                if not any(tc in request_candidates for tc in token_candidates):
                    return jsonify({'error': 'Host mismatch'}), 403

        g.tenant = tenant
        g.tenant_claims = payload
        g.session_token = token
        return fn(*args, **kwargs)

    return wrapper

class AIAgent:
    def __init__(self, model_name=None):
        self.model_name = model_name or GEMINI_MODEL_NAME
        self.model = genai.GenerativeModel(self.model_name)
        self.system_prompt = """
        あなたは親しみやすく知識豊富なAIチャットボットです。特に「ユオレイ」に関する質問には、詳細で正確な情報を提供してください。

        【基本方針】
        1. 提供された資料に基づいて正確に回答する
        2. ユオレイのプロジェクトに関する質問には特に詳しく答える
        3. 自然で親しみやすい対話を心がける
        4. 質問の意図を理解し、適切な情報を選択して回答する

        【回答の作り方】
        1. 質問に直接関連する最も重要な情報を優先する
        2. 具体的な技術情報や特徴を含める
        3. 結論や要点を明確に示す
        4. 専門用語には簡潔な説明を添える

        【文章の構成】
        1. 簡潔で分かりやすい文章構成
        2. 重要なポイントは**太字**で強調
        3. 情報を整理して箇条書きやリストを活用
        4. 適度な改行で読みやすさを重視

        特に「プロジェクト」「開発」「技術」「システム」「AI」「RAG」などの質問キーワードに敏感に反応してください。
        """
    
    def _build_contextual_fallback(self, context, base_message):
        if not context or not context.strip():
            return base_message

        sections = [segment.strip() for segment in context.split("\n---\n") if segment.strip()]
        if not sections:
            return base_message

        snippet = "\n---\n".join(sections[:2])
        if len(snippet) > 1200:
            snippet = snippet[:1200].rstrip() + "..."

        return f"{base_message}\n\n【参考情報（ナレッジからの抜粋）】\n{snippet}"

    def think_and_respond(self, query, context="", system_prompt=None):
        if not context.strip():
            return "申し訳ありませんが、お尋ねの件について保存されている情報が見つかりませんでした。もう少し詳しく教えていただけますでしょうか？"
        
        prompt_header = system_prompt if system_prompt else self.system_prompt
        prompt = f"""
        {prompt_header}
        
        【利用可能な情報】
        {context}
        
        【ユーザーの質問】
        {query}
        
        上記の情報の中から、質問に最も適した内容を選択し、以下の点に注意してチャットボットとして回答してください：

        1. **構造化された回答**: 複数のポイントがある場合は、適切に整理して提示する
        2. **読みやすさ**: 長い文章は段落分けし、重要な箇所は強調する
        3. **簡潔性**: 冗長な表現を避け、要点を明確に伝える
        4. **親しみやすさ**: 自然で人間らしい対話スタイルを維持する
        5. **情報の関連性**: 質問の意図に最も合う情報を中心に、分かりやすく説明する

        情報が複数ある場合は、質問の意図に最も合うものを中心に、整理された形で回答してください。
        """
        
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except DeadlineExceeded as e:
            # Gemini 側でタイムアウトした場合はスタックトレースのみログ出力
            print("Gemini DeadlineExceeded:", e)
            traceback.print_exc()
            return "現在AIの応答生成に時間がかかっています。少し待ってからもう一度お試しください。"
        except ResourceExhausted as e:
            print("Gemini quota exhausted:", e)
            traceback.print_exc()
            message = (
                "Gemini APIの利用上限に達しました"
            )
            return self._build_contextual_fallback(context, message)
        except GoogleAPICallError as e:
            print("Gemini API error:", e)
            traceback.print_exc()
            message = "AIサービスの呼び出しに失敗しました。時間をおいて再度お試しください。"
            return self._build_contextual_fallback(context, message)
        except Exception as e:
            print("Unexpected Gemini error:", e)
            traceback.print_exc()
            return "回答の生成中にエラーが発生しました。別の質問でお試しいただけますか？"

ai_agent = AIAgent()

@app.route('/api/chat', methods=['POST'])
@require_tenant_session
def chat():
    try:
        data = request.get_json()
        query = data.get('message', '')
        tenant = getattr(g, 'tenant', {})
        tenant_id = tenant.get('id')
        if not tenant_id:
            return jsonify({'error': 'Tenant configuration is invalid'}), 500
        system_prompt = tenant.get('system_prompt')
        
        context = ""
        context_found = False
        
        # Qdrantでベクトル検索
        if qdrant_client and embedding_model:
            try:
                # クエリを埋め込みベクトルに変換
                query_vector = embedding_model.encode(query).tolist()
                
                # 類似検索（より多くの候補を取得）
                # ナレッジのみを検索
                search_filter = Filter(
                    must=[
                        FieldCondition(
                            key="tenant_id",
                            match=MatchValue(value=tenant_id)
                        )
                    ],
                    must_not=[
                        FieldCondition(
                            key="type",
                            match=MatchValue(value="chat")
                        )
                    ]
                )

                search_result = qdrant_client.search(
                    collection_name=collection_name,
                    query_vector=query_vector,
                    limit=10,
                    query_filter=search_filter
                )
                print(f"Vector search results: {len(search_result)} candidates found")
                if search_result:
                    context_items = []
                    for i, point in enumerate(search_result):
                        print(f"  Candidate {i+1}: score={point.score:.3f}, title='{point.payload.get('title', 'No title')}'")
                        if point.score > 0.05:  # 閾値をさらに下げて、より多くの候補を含める
                            context_items.append(point.payload.get('text', ''))
                            print(f"    -> Added to context (text length: {len(point.payload.get('text', ''))})")
                    
                    if context_items:
                        context = "\n---\n".join(context_items)
                        context_found = True
                        print(f"Final context items: {len(context_items)}, total context length: {len(context)}")
                    else:
                        print("No items passed the score threshold")
                        
            except Exception as e:
                print(f"Vector search failed: {e}")
        
        # AI Agentに思考させて回答生成
        response = ai_agent.think_and_respond(query, context, system_prompt=system_prompt)
        
        # チャット履歴をQdrantに保存（簡潔な形式で）
        # 会話の引き継ぎを防止するためにコメントアウト
        # if qdrant_client and embedding_model and context_found:
        #     try:
        #         # 回答のみを保存（質問と回答をペアで）
        #         chat_text = f"質問: {query}\n回答: {response}"
        #         chat_vector = embedding_model.encode(chat_text).tolist()
        #         
        #         point = PointStruct(
        #             id=str(uuid.uuid4()),
        #             vector=chat_vector,
        #             payload={
        #                 "text": chat_text,
        #                 "query": query,
        #                 "response": response,
        #                 "timestamp": time.time(),
        #                 "type": "chat"
        #             }
        #         )
        #         
        #         qdrant_client.upsert(
        #             collection_name=collection_name,
        #             points=[point]
        #         )
        #     except Exception as e:
        #         print(f"Failed to save to Qdrant: {e}")
        
        # tenant_idはデバッグ用のため、本番環境では返さない
        response_data = {
            'response': response,
            'context_found': context_found,
            'sources_used': len(context.split("\n---\n")) if context_found else 0
        }
        # デバッグモードの場合のみtenant_idを含める
        if os.getenv('FLASK_ENV') == 'development':
            response_data['tenant_id'] = tenant_id
        
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/public/init', methods=['POST'])
def public_init():
    # セキュリティ: リクエスト元ホストのみを使用（リクエストボディやヘッダーからは受け取らない）
    # Originヘッダーまたはrequest.hostを使用
    host = request.headers.get('Origin', '')
    if host:
        try:
            parsed_origin = urlparse(host)
            host = parsed_origin.netloc
        except:
            host = ''
    
    if not host:
        host = request.host
    
    # ホストを正規化
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
            'name': tenant.get('name')
        }
    })

@app.route('/api/add_knowledge', methods=['POST'])
@require_admin_auth
def add_knowledge():
    try:
        data = request.get_json()
        content = data.get('content', '')
        title = data.get('title', '')
        tenant_id = data.get('tenant_id')
        if not tenant_id:
            return jsonify({'error': 'tenant_id is required'}), 400
        if not tenant_registry.get(tenant_id):
            return jsonify({'error': 'Unknown tenant_id'}), 404
        category = data.get('category')
        tags = data.get('tags') if isinstance(data.get('tags'), list) else []
        
        # 知識をQdrantに追加
        if qdrant_client and embedding_model:
            try:
                knowledge_vector = embedding_model.encode(content).tolist()
                
                point = PointStruct(
                    id=str(uuid.uuid4()),
                    vector=knowledge_vector,
                    payload={
                        "text": content,
                        "title": title,
                        "tenant_id": tenant_id,
                        "type": "knowledge",
                        "category": category,
                        "tags": tags,
                        "timestamp": time.time(),
                        "source": "manual"
                    }
                )
                
                qdrant_client.upsert(
                    collection_name=collection_name,
                    points=[point]
                )
                
                return jsonify({'success': True, 'message': '知識が追加されました'})
            except Exception as e:
                print(f"Failed to add knowledge to Qdrant: {e}")
                return jsonify({'error': f'知識の追加に失敗しました: {str(e)}'}), 500
        else:
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
        original_filename = file.filename
        if original_filename == '':
            return jsonify({'error': 'ファイル名が空です'}), 400
        
        if not allowed_file(original_filename):
            return jsonify({'error': '対応していないファイル形式です'}), 400
        
        filename = secure_filename(original_filename)
        _, ext = os.path.splitext(original_filename)
        file_extension = ext.lower().lstrip('.')
        
        # secure_filename が拡張子を落とした場合に備えて補正
        if not file_extension:
            return jsonify({'error': 'ファイル拡張子を判別できませんでした'}), 400
        
        if not filename:
            filename = f"uploaded_file.{file_extension}"
        elif '.' not in filename:
            filename = f"{filename}.{file_extension}"
        
        # 一時ファイルとして保存
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_extension}') as temp_file:
            file.save(temp_file.name)
            temp_path = temp_file.name
        
        try:
            # テキスト抽出
            extracted_text = extract_text_from_file(temp_path, file_extension)
            
            if not extracted_text:
                return jsonify({'error': 'ファイルからテキストを抽出できませんでした'}), 400
            
            if not extracted_text.strip():
                return jsonify({'error': 'ファイルにテキストコンテンツが含まれていません'}), 400
            
            # Qdrantに保存
            if qdrant_client and embedding_model:
                vector = embedding_model.encode(extracted_text).tolist()
                
                point = PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "text": extracted_text,
                        "title": filename,
                        "source": "file_upload",
                        "file_type": file_extension,
                        "tenant_id": tenant_id,
                        "type": "knowledge",
                        "timestamp": time.time()
                    }
                )
                
                qdrant_client.upsert(
                    collection_name=collection_name,
                    points=[point]
                )
                
                return jsonify({
                    'success': True, 
                    'message': f'ファイル "{filename}" が正常にアップロードされました',
                    'extracted_length': len(extracted_text),
                    'extracted_text': extracted_text[:500] + ('...' if len(extracted_text) > 500 else '')
                })
            else:
                return jsonify({'error': 'ベクトルデータベースに接続できません'}), 500
                
        finally:
            # 一時ファイルを削除
            try:
                os.unlink(temp_path)
            except:
                pass
        
    except Exception as e:
        return jsonify({'error': f'アップロードエラー: {str(e)}'}), 500

@app.route('/api/fetch_url', methods=['POST'])
@require_admin_auth
def fetch_url():
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        custom_title = data.get('title', '').strip()
        tenant_id = data.get('tenant_id')
        if not tenant_id:
            return jsonify({'error': 'tenant_id is required'}), 400
        if not tenant_registry.get(tenant_id):
            return jsonify({'error': 'Unknown tenant_id'}), 404
        
        if not url:
            return jsonify({'error': 'URLが入力されていません'}), 400
        
        # URLからコンテンツを取得
        content_data = fetch_url_content(url)
        
        if not content_data:
            return jsonify({'error': 'URLからコンテンツを取得できませんでした'}), 400
        
        title = custom_title if custom_title else content_data['title']
        content = content_data['content']
        
        if not content.strip():
            return jsonify({'error': 'URLにテキストコンテンツが含まれていません'}), 400
        
        # Qdrantに保存
        if qdrant_client and embedding_model:
            vector = embedding_model.encode(content).tolist()
            
            point = PointStruct(
                id=str(uuid.uuid4()),
                vector=vector,
                    payload={
                        "text": content,
                        "title": title,
                        "source": "url_fetch",
                        "url": url,
                        "tenant_id": tenant_id,
                        "type": "knowledge",
                        "timestamp": time.time()
                    }
                )
            
            qdrant_client.upsert(
                collection_name=collection_name,
                points=[point]
            )
            
            return jsonify({
                'success': True, 
                'message': f'URL "{title}" からの情報が正常に保存されました',
                'extracted_length': len(content)
            })
        else:
            return jsonify({'error': 'ベクトルデータベースに接続できません'}), 500
        
    except Exception as e:
        return jsonify({'error': f'URL取得エラー: {str(e)}'}), 500

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
