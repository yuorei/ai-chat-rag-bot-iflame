import os
from dotenv import load_dotenv


load_dotenv()


def _get_int_env(name, default):
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
        return value if value > 0 else default
    except ValueError:
        return default


UPLOAD_FOLDER = '/tmp/uploads'
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx', 'md', 'json'}
MAX_FILE_SIZE = 16 * 1024 * 1024

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL_NAME = os.getenv('GEMINI_MODEL_NAME', 'gemini-2.0-flash-lite')


QDRANT_COLLECTION_NAME = "chat_context"
QDRANT_URL = os.getenv('QDRANT_URL')
QDRANT_API_KEY = os.getenv('QDRANT_API_KEY')
QDRANT_HOST = os.getenv('QDRANT_HOST', 'vectordb')
QDRANT_PORT = int(os.getenv('QDRANT_PORT', '6333'))


MGMT_API_BASE_URL = os.getenv('MGMT_API_BASE_URL', '').strip() or None
MGMT_ADMIN_API_KEY = os.getenv('MGMT_ADMIN_API_KEY', '')
MGMT_API_CACHE_TTL = _get_int_env('MGMT_API_CACHE_TTL', 30)
MGMT_API_TIMEOUT_SEC = _get_int_env('MGMT_API_TIMEOUT_SEC', 5)


JWT_SECRET = os.getenv('WIDGET_JWT_SECRET') or 'dev-change-me'

SESSION_TOKEN_TTL = int(os.getenv('WIDGET_SESSION_TTL_SECONDS', 60 * 60 * 6))
JWT_ALGORITHM = 'HS256'


ADMIN_API_KEY = os.getenv('ADMIN_API_KEY')
