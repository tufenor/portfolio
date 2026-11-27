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

from automation.supervisor import run_snapshot
from automation.cycle import run_cycle
from automation.codex_bridge import export_pending, import_responses


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
    malformed = sum(not isinstance(row, dict) for row in rows)
    ids = [str(row.get("id", "")).strip() for row in rows if isinstance(row, dict)]
    missing_ids = sum(not row_id for row_id in ids)
    unique = len(set(ids))
    kinds = {}
    for row in rows:
        if isinstance(row, dict):
            kind = str(row.get("kind", "other"))
            kinds[kind] = kinds.get(kind, 0) + 1
    return {
        "ok": malformed == 0 and missing_ids == 0 and unique == len(ids),
        "feedPath": str(feed_path),
        "count": len(rows),
        "uniqueIds": unique,
        "missingIds": missing_ids,
        "malformedRows": malformed,
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
    parser.add_argument("command", choices=("inbox-check", "bridge-check", "supervisor", "cycle", "codex-bridge-export", "codex-bridge-import"))
    parser.add_argument("--base", default="http://127.0.0.1:8899")
    parser.add_argument("--with-email", action="store_true", help="run the local read-only Gmail watcher during cycle")
    parser.add_argument("--prepare-queue", action="store_true", help="prepare up to 30 review packets in the local Mesa; never submits proposals")
    parser.add_argument("--queue-limit", type=int, default=30)
    parser.add_argument("--responses-file", help="JSON temporário local para importar respostas do worker Codex")
    args = parser.parse_args()
    if args.command == "codex-bridge-export":
        payload = export_pending(ROOT, args.base, limit=min(30, max(1, args.queue_limit)))
    elif args.command == "codex-bridge-import":
        try:
            if args.responses_file:
                response_path = Path(args.responses_file)
                if not response_path.is_absolute():
                    response_path = ROOT / response_path
                responses = json.loads(response_path.read_text(encoding="utf-8-sig"))
            else:
                responses = json.load(sys.stdin)
            payload = import_responses(ROOT, args.base, responses)
            if args.responses_file and payload.get("ok"):
                response_path.unlink(missing_ok=True)
        except (json.JSONDecodeError, ValueError) as exc:
            payload = {"ok": False, "error": str(exc)}
    elif args.command == "inbox-check":
        payload = inbox_check()
    elif args.command == "bridge-check":
        payload = bridge_check(args.base)
    elif args.command == "supervisor":
        payload = run_snapshot(ROOT, args.base)
    else:
        payload = run_cycle(ROOT, args.base, with_email=args.with_email,
                            prepare_queue=args.prepare_queue, queue_limit=args.queue_limit)
    print(json.dumps(payload, ensure_ascii=False))
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
