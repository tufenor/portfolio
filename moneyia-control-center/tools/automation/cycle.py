"""Ciclo local, limitado e idempotente de supervisão do MoneyIA."""
from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from .storage import atomic_write_json, file_lock
from .supervisor import run_snapshot

FEED_MAX_AGE_SECONDS = 6 * 60 * 60
FAILURE_COOLDOWN_SECONDS = 15 * 60


def _collector(root: Path, previous: dict) -> dict:
    feed = root / "data" / "public-feed-opportunities.json"
    script = root / "tools" / "collect_public_opportunities.py"
    if not script.exists():
        return {"status": "unavailable"}
    try:
        fetched = json.loads(feed.read_text(encoding="utf-8")).get("fetchedAt")
        age = time.time() - datetime.fromisoformat(fetched).timestamp() if fetched else float("inf")
    except (OSError, json.JSONDecodeError, TypeError, ValueError, AttributeError):
        age = float("inf")
    old = previous.get("collector", {}) if isinstance(previous, dict) else {}
    try:
        last_attempt = datetime.fromisoformat(str(old.get("lastAttemptAt"))).timestamp()
    except (TypeError, ValueError):
        last_attempt = 0
    if age <= FEED_MAX_AGE_SECONDS:
        return {"status": "fresh_cache", "ageSeconds": round(age)}
    if old.get("status") in {"failed", "failure_cooldown"} and time.time() - last_attempt < FAILURE_COOLDOWN_SECONDS:
        return {"status": "failure_cooldown", "lastAttemptAt": old["lastAttemptAt"],
                "ageSeconds": round(age) if age != float("inf") else None}
    attempted = datetime.now(timezone.utc).isoformat()
    try:
        completed = subprocess.run(
            [sys.executable, str(script)], cwd=root, capture_output=True, text=True,
            timeout=15, check=False,
        )
        if completed.returncode == 0:
            return {"status": "refreshed", "lastAttemptAt": attempted, "output": completed.stdout[-500:]}
        return {"status": "failed", "lastAttemptAt": attempted, "error": completed.stderr[-300:]}
    except subprocess.TimeoutExpired:
        return {"status": "failed", "lastAttemptAt": attempted, "error": "collector timeout"}


def run_cycle(root: Path, base: str = "http://127.0.0.1:8899") -> dict:
    """Run one read-mostly snapshot and persist only the cycle status.

    The lock prevents overlapping scheduled invocations. No proposal, email,
    browser, payment, approval, or external API action is performed here.
    """
    status_path = root / "data" / "automation-cycle-status.json"
    started = datetime.now(timezone.utc).isoformat()
    status = {"ok": False, "startedAt": started, "statusPath": str(status_path)}
    try:
        with file_lock(status_path.with_name("automation-cycle"), timeout=0.2):
            started_clock = time.monotonic()
            previous = {}
            try:
                previous = json.loads(status_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                pass
            snapshot = run_snapshot(root, base)
            collector = _collector(root, previous)
            status.update(
                {
                    "ok": bool(snapshot.get("ok")),
                    "finishedAt": datetime.now(timezone.utc).isoformat(),
                    "durationMs": round((time.monotonic() - started_clock) * 1000),
                    "snapshotOk": bool(snapshot.get("ok")),
                    "moneyiaOk": bool(snapshot.get("moneyia", {}).get("ok")),
                    "jarvisOk": bool(snapshot.get("jarvis", {}).get("ok")),
                    "files": snapshot.get("files", {}),
                    "collector": collector,
                }
            )
            atomic_write_json(status_path, status)
    except TimeoutError:
        status.update({"status": "skipped_locked", "finishedAt": datetime.now(timezone.utc).isoformat()})
        # Do not overwrite an active worker's status.
        return status
    except Exception as exc:  # bounded worker: report and exit, never retry-loop
        status.update({"status": "error", "error": str(exc)[:240], "finishedAt": datetime.now(timezone.utc).isoformat()})
        atomic_write_json(status_path, status)
    return status
