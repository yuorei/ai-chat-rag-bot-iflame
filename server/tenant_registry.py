import json
import os
from urllib.parse import urlparse


class TenantRegistry:
    def __init__(self, config_path):
        self.config_path = config_path
        self.tenants = {}
        self.domain_map = {}
        self._last_mtime = None
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
        try:
            self._last_mtime = os.path.getmtime(self.config_path)
        except OSError:
            self._last_mtime = None

    def get(self, tenant_id):
        self._ensure_latest()
        return self.tenants.get(tenant_id)

    def find_by_host(self, host):
        self._ensure_latest()
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
        if value.startswith('.'):  # remove leading dot
            value = value[1:]
        return value or None

    def _ensure_latest(self):
        if not self.config_path:
            return
        try:
            mtime = os.path.getmtime(self.config_path)
        except OSError:
            return
        if self._last_mtime is None or mtime > self._last_mtime:
            self.reload()
