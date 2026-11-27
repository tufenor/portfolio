"""Exemplo sanitizado de notificador sequencial de etapas humanas.

Consulta uma fila local, abre só a etapa mais antiga e grava um marcador
sanitizado. Não envia formulários nem marca uma etapa como concluída.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
import webbrowser
from datetime import datetime, timezone
from pathlib import Path


def notify_next(base: str, state_file: Path) -> dict:
    request = urllib.request.Request(
        f"{base.rstrip('/')}/api/browser/gates?status=pending",
        headers={"accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            gates = json.loads(response.read().decode("utf-8"))
    except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
        return {"status": "unavailable", "error": str(exc)[:120]}
    if not isinstance(gates, list):
        return {"status": "invalid_response"}

    gates = sorted(
        (gate for gate in gates if isinstance(gate, dict) and gate.get("id") and gate.get("url")),
        key=lambda gate: str(gate.get("createdAt") or ""),
    )
    previous = {}
    try:
        previous = json.loads(state_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        pass
    if not gates:
        state = {"activeGateId": None, "status": "clear"}
        _save(state_file, state)
        return state

    gate = gates[0]
    if previous.get("activeGateId") == gate["id"]:
        return {"status": "already_notified", "activeGateId": gate["id"]}
    opened = webbrowser.open(str(gate["url"]), new=2, autoraise=True)
    state = {
        "activeGateId": str(gate["id"]),
        "platform": str(gate.get("platform") or "portal"),
        "type": str(gate.get("type") or "human_step"),
        "status": "opened" if opened else "open_failed",
        "notifiedAt": datetime.now(timezone.utc).isoformat(),
    }
    if sys.platform == "win32":
        try:
            import winsound
            winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)
        except (ImportError, RuntimeError):
            pass
    _save(state_file, state)
    return state


def _save(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    print(json.dumps(notify_next("http://127.0.0.1:8899", root / "data" / "gate-state.json"), ensure_ascii=False))
