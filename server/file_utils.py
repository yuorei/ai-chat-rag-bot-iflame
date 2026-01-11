import json
import os
import tempfile
import time
import uuid

import PyPDF2
import pdfplumber
from bs4 import BeautifulSoup
from docx import Document
from qdrant_client.http.models import PointStruct
import requests
from werkzeug.utils import secure_filename

import settings


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in settings.ALLOWED_EXTENSIONS


def normalize_pdf_text(raw_text: str) -> str:
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
    try:
        if file_extension == 'txt' or file_extension == 'md':
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()

        if file_extension == 'json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return json.dumps(data, ensure_ascii=False, indent=2)

        if file_extension == 'pdf':
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

        if file_extension == 'docx':
            doc = Document(file_path)
            text = "".join(paragraph.text + "\n" for paragraph in doc.paragraphs)
            return text

        return None

    except Exception as e:
        print(f"Error extracting text from {file_path}: {e}")
        return None


def fetch_url_content(url):
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')
        for element in soup(['script', 'style', 'nav', 'header', 'footer']):
            element.decompose()

        title = soup.find('title')
        title_text = title.get_text().strip() if title else ""

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


def save_knowledge_to_qdrant(qdrant_client, vector, payload):
    point_id = str(uuid.uuid4())
    point = PointStruct(
        id=point_id,
        vector=vector,
        payload=payload,
    )

    qdrant_client.upsert(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        points=[point],
    )
    return point_id


def handle_file_upload(file_storage, chat_id, qdrant_client, embedding_model):
    original_filename = file_storage.filename
    if original_filename == '':
        return {'error': 'ファイル名が空です'}, 400

    if not allowed_file(original_filename):
        return {'error': '対応していないファイル形式です'}, 400

    filename = secure_filename(original_filename) or original_filename
    _, ext = os.path.splitext(original_filename)
    file_extension = ext.lower().lstrip('.')

    if not file_extension:
        return {'error': 'ファイル拡張子を判別できませんでした'}, 400

    with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_extension}') as temp_file:
        file_storage.save(temp_file.name)
        temp_path = temp_file.name

    try:
        extracted_text = extract_text_from_file(temp_path, file_extension)
        if not extracted_text:
            return {'error': 'ファイルからテキストを抽出できませんでした'}, 400
        if not extracted_text.strip():
            return {'error': 'ファイルにテキストコンテンツが含まれていません'}, 400

        vector = embedding_model.encode(extracted_text).tolist()
        payload = {
            "text": extracted_text,
            "title": filename,
            "source": "file_upload",
            "file_type": file_extension,
            "chat_id": chat_id,
            "type": "knowledge",
            "timestamp": time.time(),
        }

        point_id = save_knowledge_to_qdrant(qdrant_client, vector, payload)

        preview = extracted_text[:500] + ('...' if len(extracted_text) > 500 else '')
        return {
            'success': True,
            'message': f'ファイル "{filename}" が正常にアップロードされました',
            'extracted_length': len(extracted_text),
            'extracted_text': preview,
            'qdrant_point_id': point_id,
        }, 200
    finally:
        try:
            os.unlink(temp_path)
        except Exception:
            pass


def handle_url_fetch(url, title, chat_id, qdrant_client, embedding_model):
    content_data = fetch_url_content(url)
    if not content_data:
        return {'error': 'URLからコンテンツを取得できませんでした'}, 400

    resolved_title = title if title else content_data['title']
    content = content_data['content']

    if not content.strip():
        return {'error': 'URLにテキストコンテンツが含まれていません'}, 400

    vector = embedding_model.encode(content).tolist()
    payload = {
        "text": content,
        "title": resolved_title,
        "source": "url_fetch",
        "url": url,
        "chat_id": chat_id,
        "type": "knowledge",
        "timestamp": time.time(),
    }

    point_id = save_knowledge_to_qdrant(qdrant_client, vector, payload)

    return {
        'success': True,
        'message': f'URL "{resolved_title}" からの情報が正常に保存されました',
        'extracted_length': len(content),
        'qdrant_point_id': point_id,
    }, 200


def add_manual_knowledge(content, title, chat_id, category, tags, qdrant_client, embedding_model):
    knowledge_vector = embedding_model.encode(content).tolist()
    payload = {
        "text": content,
        "title": title,
        "chat_id": chat_id,
        "type": "knowledge",
        "category": category,
        "tags": tags,
        "timestamp": time.time(),
        "source": "manual",
    }

    point_id = save_knowledge_to_qdrant(qdrant_client, knowledge_vector, payload)
    return {'success': True, 'message': '知識が追加されました', 'qdrant_point_id': point_id}, 200
