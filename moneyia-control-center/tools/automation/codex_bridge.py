"""Bridge between the local MoneyIA Mesa and the scheduled Codex worker.

The Codex subscription is used by its existing scheduled automation; no API key
or paid API call is required. The local API only exposes pending queue items on
loopback and accepts bounded, idempotent responses.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _request(url: str, payload: dict | None = None, timeout: int = 15) -> dict:
    hostname = (urlparse(url).hostname or "").lower()
    if hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("a ponte Codex só envia dados para a Mesa local")
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        url, data=data,
        headers={"accept": "application/json", "content-type": "application/json"},
        method="POST" if data is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _status_path(root: Path) -> Path:
    return root / "data" / "codex-bridge-status.json"


def _read_status(root: Path) -> dict:
    try:
        value = json.loads(_status_path(root).read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write_status(root: Path, value: dict) -> None:
    path = _status_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def export_pending(root: Path, base: str, limit: int = 30) -> dict:
    limit = max(1, min(30, int(limit)))
    status = _read_status(root)
    payload = _request(f"{base.rstrip('/')}/api/codex-bridge/pending?limit={limit}")
    items = payload.get("items", [])
    if not isinstance(items, list):
        raise ValueError("formato da fila local inválido")
    items = [item for item in items if isinstance(item, dict) and item.get("id") and item.get("prompt")]
    status.update({
        "status": "running" if items else "idle",
        "provider": "codex:gpt-5.6-luna",
        "lastExportAt": _now(),
        "lastImportAt": status.get("lastImportAt"),
        "exportedIds": [item["id"] for item in items],
        "exportedCount": len(items),
        "processed": int(status.get("processed", 0)),
        "lastError": None,
    })
    _write_status(root, status)
    return {"ok": True, "provider": "codex:gpt-5.6-luna", "count": len(items), "items": items}


def import_responses(root: Path, base: str, responses: Any) -> dict:
    if not isinstance(responses, list):
        raise ValueError("a entrada deve ser uma lista JSON de id e response")
    if len(responses) > 30:
        raise ValueError("limite de 30 respostas por ciclo")
    status = _read_status(root)
    allowed = set(status.get("exportedIds", []))
    imported, skipped, failures = [], [], []
    for item in responses:
        if not isinstance(item, dict):
            skipped.append("linha inválida")
            continue
        item_id = str(item.get("id", "")).strip()
        response = str(item.get("response", "")).strip()
        if item_id not in allowed or not response:
            skipped.append(item_id or "id ausente")
            continue
        try:
            result = _request(
                f"{base.rstrip('/')}/api/ia/{quote(item_id, safe='')}/retorno",
                {"retorno": response[:10000], "source": "codex:gpt-5.6-luna"},
            )
            imported.append({"id": item_id, "idempotent": bool(result.get("idempotent"))})
            allowed.discard(item_id)
        except (OSError, urllib.error.URLError, json.JSONDecodeError, ValueError) as exc:
            failures.append({"id": item_id, "error": str(exc)[:160]})
    status.update({
        "status": "error" if failures else ("processed" if imported else "idle"),
        "provider": "codex:gpt-5.6-luna",
        "lastImportAt": _now(),
        "processed": int(status.get("processed", 0)) + sum(not row["idempotent"] for row in imported),
        "lastBatchImported": len(imported),
        "exportedIds": sorted(allowed),
        "lastError": failures or None,
    })
    _write_status(root, status)
    return {"ok": not failures, "imported": imported, "skipped": skipped, "failures": failures, "status": status}
