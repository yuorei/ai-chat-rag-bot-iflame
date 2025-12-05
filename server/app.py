from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from google.api_core.exceptions import DeadlineExceeded, GoogleAPICallError
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer
import os
from dotenv import load_dotenv
import json
import time
import uuid
from werkzeug.utils import secure_filename
import PyPDF2
from docx import Document
from bs4 import BeautifulSoup
import tempfile
import requests
import traceback

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

# Qdrant設定
collection_name = "chat_context"

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
            text = ""
            with open(file_path, 'rb') as f:
                pdf_reader = PyPDF2.PdfReader(f)
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
            return text
        
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

class AIAgent:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-2.0-flash-lite')
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
    
    def think_and_respond(self, query, context=""):
        if not context.strip():
            return "申し訳ありませんが、お尋ねの件について保存されている情報が見つかりませんでした。もう少し詳しく教えていただけますでしょうか？"
        
        prompt = f"""
        {self.system_prompt}
        
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
        except GoogleAPICallError as e:
            print("Gemini API error:", e)
            traceback.print_exc()
            return "AIサービスの呼び出しに失敗しました。時間をおいて再度お試しください。"
        except Exception as e:
            print("Unexpected Gemini error:", e)
            traceback.print_exc()
            return "回答の生成中にエラーが発生しました。別の質問でお試しいただけますか？"

ai_agent = AIAgent()

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        query = data.get('message', '')
        
        context = ""
        context_found = False
        
        # Qdrantでベクトル検索
        if qdrant_client and embedding_model:
            try:
                # クエリを埋め込みベクトルに変換
                query_vector = embedding_model.encode(query).tolist()
                
                # 類似検索（より多くの候補を取得）
                # ナレッジのみを検索
                from qdrant_client.http.models import Filter, FieldCondition, MatchValue
                search_result = qdrant_client.search(
                    collection_name=collection_name,
                    query_vector=query_vector,
                    limit=10,
                    query_filter=Filter(
                        must_not=[
                            FieldCondition(
                                key="type",
                                match=MatchValue(value="chat")
                            )
                        ]
                    )
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
        response = ai_agent.think_and_respond(query, context)
        
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
        
        return jsonify({
            'response': response,
            'context_found': context_found,
            'sources_used': len(context.split("\n---\n")) if context_found else 0
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/add_knowledge', methods=['POST'])
def add_knowledge():
    try:
        data = request.get_json()
        content = data.get('content', '')
        title = data.get('title', '')
        
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
                        "timestamp": time.time(),
                        "type": "knowledge"
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
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'ファイルが選択されていません'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'ファイル名が空です'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': '対応していないファイル形式です'}), 400
        
        filename = secure_filename(file.filename)
        file_extension = filename.rsplit('.', 1)[1].lower()
        
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
def fetch_url():
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        custom_title = data.get('title', '').strip()
        
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
