import os
from dotenv import load_dotenv


load_dotenv()


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


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_TENANT_PATH = os.path.join(BASE_DIR, 'data', 'tenants.json')

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


ADMIN_API_KEY = os.getenv('ADMIN_API_KEY')
