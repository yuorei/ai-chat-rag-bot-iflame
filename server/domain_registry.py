import time
from urllib.parse import urlparse

import requests


class DomainRegistry:
    """
    management-server-hono の API から chat_profiles を取得する。
    """

    def __init__(self, base_url: str, admin_api_key: str = "", cache_ttl: int = 30, timeout: int = 5):
        self.base_url = base_url.rstrip("/")
        self.admin_api_key = admin_api_key or ""
        self.cache_ttl = cache_ttl
        self.timeout = timeout
        self.chats = {}
        self.host_map = {}
        self.id_map = {}
        self._expires_at = 0.0
        self._last_error = None
        self._loaded_successfully = False
        self.reload()

    def reload(self):
        api_url = f"{self.base_url}/api/chats"
        has_api_key = bool(self.admin_api_key)
        try:
            headers = {}
            if self.admin_api_key:
                headers["X-Admin-API-Key"] = self.admin_api_key
            res = requests.get(api_url, headers=headers, timeout=self.timeout)

            if not res.ok:
                error_body = res.text[:500]
                error_msg = f"API returned {res.status_code}: {error_body}"
                print(f"[ERROR] DomainRegistry reload failed - url={api_url}, has_api_key={has_api_key}, status={res.status_code}, body={error_body}")
                self._last_error = error_msg
                self._expires_at = time.time() + self.cache_ttl / 2
                return

            payload = res.json()
            rows = payload.get("chats", [])
            print(f"[INFO] DomainRegistry reload success - loaded {len(rows)} chats from {api_url}")
            self._last_error = None
            self._loaded_successfully = True
        except Exception as e:
            error_msg = f"{type(e).__name__}: {e}"
            print(f"[ERROR] DomainRegistry reload exception - url={api_url}, has_api_key={has_api_key}, error={error_msg}")
            self._last_error = error_msg
            self._expires_at = time.time() + self.cache_ttl / 2
            return

        chats = {}
        host_map = {}
        id_map = {}
        for row in rows:
            chat_id = row.get("id")
            if not chat_id:
                continue
            target_type = row.get("target_type") or "web"
            display_name = row.get("display_name") or ""
            system_prompt = row.get("system_prompt") or ""
            targets = row.get("targets")
            if isinstance(targets, str):
                targets = [targets]
            if not isinstance(targets, list):
                targets = []
            if not targets:
                fallback_target = row.get("target") or ""
                targets = [fallback_target] if fallback_target else []

            base_target = targets[0] if targets else row.get("target") or ""
            entry = {
                "id": chat_id,
                "target": base_target,
                "target_type": target_type,
                "display_name": display_name,
                "system_prompt": system_prompt,
            }
            chats[chat_id] = entry
            id_map[chat_id] = entry

            if target_type != "web":
                continue

            for target in targets:
                canonical = self._normalize_domain(target or "")
                if not canonical:
                    continue
                mapped = {**entry, "target": canonical}
                host_map[canonical] = mapped
                host_map[f"www.{canonical}"] = mapped

        self.chats = chats
        self.host_map = host_map
        self.id_map = id_map
        self._expires_at = time.time() + self.cache_ttl

    def resolve(self, key: str):
        """chat_id もしくは target(web) から解決"""
        self._ensure_latest()
        if not key:
            return None
        if key in self.id_map:
            return self.id_map[key]
        normalized = self._normalize_domain(key)
        if normalized and normalized in self.host_map:
            return self.host_map.get(normalized)
        return None

    def find_by_host(self, host: str):
        self._ensure_latest()
        normalized = self._normalize_domain(host)
        if not normalized:
            return None
        return self.host_map.get(normalized)

    def _ensure_latest(self):
        if time.time() >= self._expires_at:
            self.reload()

    def get_stats(self):
        """デバッグ用の統計情報を返す"""
        return {
            'loaded': self._loaded_successfully,
            'chat_count': len(self.id_map),
            'host_count': len(self.host_map),
            'last_error': self._last_error,
            'available_ids': list(self.id_map.keys()),
            'available_hosts': list(self.host_map.keys()),
            'api_url': self.base_url,
            'has_api_key': bool(self.admin_api_key),
        }

    def _normalize_domain(self, value: str):
        if not value:
            return None
        value = value.strip().lower()
        if value.startswith("http://") or value.startswith("https://"):
            parsed = urlparse(value)
            value = parsed.netloc or parsed.path
        value = value.split("/")[0]
        value = value.split(":")[0]
        if value.startswith("www."):
            value = value[4:]
        if value.startswith("."):
            value = value[1:]
        return value or None
