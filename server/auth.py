import os
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import jsonify, g, request

from tenant_registry import TenantRegistry
import settings


def issue_session_token(tenant_id, host):
    now = datetime.now(timezone.utc)
    payload = {
        'tenant_id': tenant_id,
        'host': host,
        'session_id': str(uuid.uuid4()),
        'iat': now,
        'exp': now + timedelta(seconds=settings.SESSION_TOKEN_TTL)
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    if isinstance(token, bytes):
        return token.decode('utf-8')
    return token


def decode_session_token(token):
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def extract_bearer_token():
    auth_header = request.headers.get('Authorization', '')
    if auth_header.lower().startswith('bearer '):
        return auth_header[7:].strip()
    return request.args.get('token')


def require_admin_auth(fn):
    """管理エンドポイント用の認証デコレータ（オプション）"""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        if settings.ADMIN_API_KEY:
            provided_key = request.headers.get('X-Admin-API-Key') or request.args.get('admin_api_key')
            if not provided_key or provided_key != settings.ADMIN_API_KEY:
                return jsonify({'error': 'Admin authentication required'}), 401
        elif os.getenv('FLASK_ENV') == 'production':
            print("[WARN] ADMIN_API_KEY is not set. Admin endpoints are unprotected.")
        return fn(*args, **kwargs)

    return wrapper


def require_tenant_session(tenant_registry: TenantRegistry):
    def decorator(fn):
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

            token_host = payload.get('host', '').strip()
            if token_host:
                request_host = request.headers.get('Origin', '')
                if request_host:
                    try:
                        from urllib.parse import urlparse

                        parsed_origin = urlparse(request_host)
                        request_host = parsed_origin.netloc
                    except Exception:
                        pass
                if not request_host:
                    request_host = request.host

                normalized_token_host = tenant_registry._normalize_domain(token_host)
                normalized_request_host = tenant_registry._normalize_domain(request_host)

                if normalized_token_host and normalized_request_host:
                    token_candidates = tenant_registry._candidate_domains(token_host)
                    request_candidates = tenant_registry._candidate_domains(request_host)
                    if not any(tc in request_candidates for tc in token_candidates):
                        return jsonify({'error': 'Host mismatch'}), 403

            g.tenant = tenant
            g.tenant_claims = payload
            g.session_token = token
            return fn(*args, **kwargs)

        return wrapper

    return decorator
