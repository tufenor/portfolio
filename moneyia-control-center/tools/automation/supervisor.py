"""Snapshot operacional seguro: APIs locais, dados e filas."""
from __future__ import annotations

import json
from pathlib import Path

from .health_monitor import check_url
from .opportunity_deduplicator import deduplicate
from .report_generator import write_report


def run_snapshot(root: Path, base: str = "http://127.0.0.1:8899") -> dict:
    data = root / "data"
    result = {"moneyia": check_url(f"{base.rstrip('/')}/api/health"), "jarvis": check_url("http://127.0.0.1:8080/api/saude"), "files": {}}
    for name in ("inbox-feed.json", "aprovacoes.json", "tarefas.json", "radar-opportunities.json"):
        path = data / name
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(value, list):
                raise ValueError("esperado um array JSON")
            rows = value
            malformed = sum(not isinstance(row, dict) for row in rows)
            unique, duplicates = deduplicate(rows)
            result["files"][name] = {"ok": malformed == 0, "count": len(rows), "unique": len(unique), "duplicates": duplicates, "malformed": malformed}
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            result["files"][name] = {"ok": False, "error": str(exc)}
    result["ok"] = bool(result["moneyia"].get("ok")) and all(v.get("ok") for v in result["files"].values())
    write_report(root / "data" / "automation-status.json", result)
    return result
