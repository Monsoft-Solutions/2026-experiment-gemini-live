"""Lightweight async Convex client for server-side use.

Uses the Convex HTTP API (same as the frontend ConvexAPI class).
"""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)


class ConvexClient:
    """Async Convex HTTP API client."""

    def __init__(self, url: str | None = None):
        self.url = (url or os.getenv("CONVEX_URL", "")).rstrip("/")
        if not self.url:
            raise ValueError("CONVEX_URL not configured")

    async def query(self, name: str, args: dict | None = None) -> dict | list | None:
        """Run a Convex query function."""
        return await self._call("query", name, args or {})

    async def mutation(self, name: str, args: dict | None = None):
        """Run a Convex mutation function."""
        return await self._call("mutation", name, args or {})

    async def _call(self, call_type: str, name: str, args: dict):
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.url}/api/{call_type}",
                json={"path": name, "args": args, "format": "json"},
                timeout=10.0,
            )
            if resp.status_code != 200:
                logger.error(f"Convex {call_type} {name} failed: {resp.status_code} {resp.text}")
                return None
            data = resp.json()
            return data.get("value")


# Singleton — lazily initialized
_client: ConvexClient | None = None


def get_convex() -> ConvexClient:
    """Get the global Convex client instance."""
    global _client
    if _client is None:
        _client = ConvexClient()
    return _client
