#!/usr/bin/env python3
"""Rotinas locais de apoio ao MoneyIA.

Não envia propostas nem acessa credenciais. Serve como verificador redundante
para o JARVIS: consulta a API local, valida o feed de e-mail e produz JSON
curto para supervisão ou agendamento no Windows.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def get_json(url: str, timeout: float = 4.0):
    request = urllib.request.Request(url, headers={"accept": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def inbox_check() -> dict:
    feed_path = DATA / "inbox-feed.json"
    try:
        rows = json.loads(feed_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        rows = []
    rows = rows if isinstance(rows, list) else []
    ids = [str(row.get("id", "")) for row in rows if isinstance(row, dict)]
    unique = len(set(ids))
    kinds = {}
    for row in rows:
        if isinstance(row, dict):
            kind = str(row.get("kind", "other"))
            kinds[kind] = kinds.get(kind, 0) + 1
    return {
        "ok": unique == len(ids),
        "feedPath": str(feed_path),
        "count": len(rows),
        "uniqueIds": unique,
        "kinds": kinds,
    }


def bridge_check(base: str) -> dict:
    result = {"base": base, "moneyia": None, "jarvis": None}
    for key, url in (("moneyia", f"{base.rstrip('/')}/api/health"),
                     ("jarvis", "http://127.0.0.1:8080/api/saude")):
        try:
            payload = get_json(url)
            result[key] = {"ok": bool(payload.get("ok", True)), "status": "online"}
        except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
            result[key] = {"ok": False, "status": "offline", "error": str(exc)[:160]}
    result["ok"] = bool(result["moneyia"] and result["moneyia"]["ok"])
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("inbox-check", "bridge-check"))
    parser.add_argument("--base", default="http://127.0.0.1:8899")
    args = parser.parse_args()
    payload = inbox_check() if args.command == "inbox-check" else bridge_check(args.base)
    print(json.dumps(payload, ensure_ascii=False))
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
