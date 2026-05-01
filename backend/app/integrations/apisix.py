from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.modules.chains.models import Chain


@dataclass(frozen=True)
class ApisixConfig:
    admin_url: str
    admin_key: str
    route_prefix: str = "/rpc"


def _get_config() -> ApisixConfig:
    return ApisixConfig(
        admin_url=settings.apisix_admin_url.rstrip("/"),
        admin_key=settings.apisix_admin_key,
    )


def _build_upstream(chain: Chain) -> dict:
    parsed = urlparse(chain.rpc_target_url)
    if not parsed.scheme or not parsed.hostname:
        raise ValueError("rpc_target_url must include scheme and host")

    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    return {
        "type": "roundrobin",
        "scheme": parsed.scheme,
        "pass_host": "node",
        "tls": {"verify": False},
        "nodes": {f"{parsed.hostname}:{port}": 1},
    }


def _build_proxy_rewrite(chain: Chain, route_prefix: str) -> dict | None:
    parsed = urlparse(chain.rpc_target_url)
    base_path = parsed.path.rstrip("/")
    prefix = route_prefix.rstrip("/")
    if base_path:
        return {
            "regex_uri": [rf"^{prefix}/{chain.code}/?(.*)", f"{base_path}/$1"],
        }
    return {
        "regex_uri": [rf"^{prefix}/{chain.code}/?(.*)", r"/$1"],
    }


async def upsert_chain_route(chain: Chain) -> None:
    config = _get_config()
    route_id = f"chain-{chain.code}"
    route_prefix = config.route_prefix.rstrip("/")
    route_uri = f"{route_prefix}/{chain.code}/*"
    proxy_rewrite = _build_proxy_rewrite(chain, route_prefix)

    payload = {
        "name": f"chain-{chain.code}",
        "uri": route_uri,
        "methods": ["GET", "POST"],
        "status": 1,
        "plugins": {
            "key-auth": {},
            "proxy-rewrite": proxy_rewrite,
        },
        "upstream": _build_upstream(chain),
    }
    if settings.apisix_usage_sink_url and settings.apisix_usage_sink_token:
        payload["plugins"]["http-logger"] = {
            "uri": settings.apisix_usage_sink_url,
            "timeout": 3,
            "auth_header": settings.apisix_usage_sink_token,
            "log_format": {
                "consumer_name": "$consumer_name",
                "route_id": "$route_id",
                "status": "$status",
                "request_id": "$request_id",
                "time": "$time_iso8601",
            },
        }

    headers = {"X-API-KEY": config.admin_key}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.put(f"{config.admin_url}/apisix/admin/routes/{route_id}", json=payload, headers=headers)
        resp.raise_for_status()


async def delete_chain_route(chain: Chain) -> None:
    config = _get_config()
    route_id = f"chain-{chain.code}"
    headers = {"X-API-KEY": config.admin_key}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.delete(f"{config.admin_url}/apisix/admin/routes/{route_id}", headers=headers)
        if resp.status_code in {404, 410}:
            return
        resp.raise_for_status()


async def chain_route_exists(code: str) -> bool:
    config = _get_config()
    route_id = f"chain-{code}"
    headers = {"X-API-KEY": config.admin_key}
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(f"{config.admin_url}/apisix/admin/routes/{route_id}", headers=headers)
        if resp.status_code == 404:
            return False
        resp.raise_for_status()
        return True


def _consumer_username(api_key_id: str) -> str:
    return f"key-{api_key_id}"


async def upsert_consumer_api_key(
    api_key_id: str,
    plain_key: str,
    quota_total: int | None = None,
    quota_window_seconds: int | None = None,
) -> None:
    config = _get_config()
    username = _consumer_username(api_key_id)
    plugins: dict = {
        "key-auth": {
            "key": plain_key,
        }
    }
    if quota_total is not None and quota_total > 0 and quota_window_seconds is not None:
        plugins["limit-count"] = {
            "count": quota_total,
            "time_window": quota_window_seconds,
            "rejected_code": 429,
            "key_type": "var",
            "key": "consumer_name",
            "show_limit_quota_header": True,
        }

    payload = {
        "username": username,
        "plugins": plugins,
    }
    headers = {"X-API-KEY": config.admin_key}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.put(
            f"{config.admin_url}/apisix/admin/consumers/{username}",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()


async def delete_consumer(api_key_id: str) -> None:
    config = _get_config()
    username = _consumer_username(api_key_id)
    headers = {"X-API-KEY": config.admin_key}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.delete(
            f"{config.admin_url}/apisix/admin/consumers/{username}",
            headers=headers,
        )
        if resp.status_code in {404, 410}:
            return
        resp.raise_for_status()
