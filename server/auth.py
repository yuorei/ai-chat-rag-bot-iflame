import json
from functools import wraps
from urllib.parse import urlparse

from flask import jsonify, g, request
import sentry_sdk

from domain_registry import DomainRegistry


def _extract_chat_id():
    data = request.get_json(silent=True) or {}
    candidates = (
        data.get('chat_id'),
        data.get('chatId'),
        data.get('tenant_id'),
        data.get('tenantId'),
        data.get('domain'),
        request.args.get('chat_id'),
        request.args.get('chatId'),
        request.args.get('tenant_id'),
        request.args.get('tenantId'),
        request.args.get('domain'),
    )
    for value in candidates:
        if value:
            return str(value).strip()
    return None


def _extract_request_host():
    origin = request.headers.get('Origin', '').strip()
    host = origin
    if origin:
        try:
            parsed = urlparse(origin)
            host = parsed.netloc or parsed.path
        except Exception:
            host = origin
    if not host:
        host = request.host
    return host


def require_admin_auth(fn):
    """認証は一時的に無効化（常に通過）。"""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        return fn(*args, **kwargs)

    return wrapper


def require_domain_session(registry: DomainRegistry):
    """認証は無効化し、chat_id かホスト名からテナントを解決する。"""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            chat_id = _extract_chat_id()
            chat = registry.resolve(chat_id) if chat_id else None

            request_host = None
            if not chat:
                request_host = _extract_request_host()
                if request_host:
                    chat = registry.find_by_host(request_host)

            if not chat:
                # サーバーログとSentryに詳細を出力
                registry_stats = registry.get_stats()
                debug_info = {
                    'provided_chat_id': chat_id,
                    'request_host': request_host,
                    'origin_header': request.headers.get('Origin'),
                    'registry_loaded': registry_stats['loaded'],
                    'registry_chat_count': registry_stats['chat_count'],
                    'registry_last_error': registry_stats['last_error'],
                    'available_chat_ids': registry_stats['available_ids'][:10],
                }
                print(f"[ERROR] Unknown chat - {json.dumps(debug_info, ensure_ascii=False)}")
                sentry_sdk.capture_message(
                    'Unknown chat error',
                    level='error',
                    extras=debug_info
                )
                return jsonify({'error': 'Unknown chat'}), 404

            g.chat = chat
            g.chat_claims = {
                'chat_id': chat.get('id'),
                'host': request_host,
            }
            g.session_token = None
            return fn(*args, **kwargs)

        return wrapper

    return decorator
