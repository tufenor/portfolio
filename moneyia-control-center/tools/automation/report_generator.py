"""Relatorio JSON curto para auditoria local."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from .storage import atomic_write_json


def write_report(path: Path, payload: dict) -> None:
    payload = {"generatedAt": datetime.now(timezone.utc).isoformat(), **payload}
    atomic_write_json(path, payload)
