#!/usr/bin/env python3
"""Collect a bounded, read-only snapshot from Remotive's public jobs API.

This script never submits applications and writes only data/public-feed-opportunities.json.
Remotive documents a 24-hour delay for this public feed; consumers must not treat it as live.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "public-feed-opportunities.json"
ENDPOINT = "https://remotive.com/api/remote-jobs"
OFFICIAL_SOURCE = "https://github.com/remotive-com/remote-jobs-api"
TIMEOUT_SECONDS = 12
MAX_BYTES = 4_000_000

SCOPE = re.compile(r"\b(web|frontend|front-end|html|css|javascript|typescript|react|ui|ux|landing|automation|qa|quality assurance|test engineer|wordpress)\b", re.I)
CONTRACT = re.compile(r"\b(contract|contractor|freelance|freelancer|temporary|project[- ]based)\b", re.I)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def fetch() -> dict:
    req = Request(ENDPOINT, headers={"Accept": "application/json", "User-Agent": "moneyIA-public-feed/1.0"})
    with urlopen(req, timeout=TIMEOUT_SECONDS) as response:
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("response exceeds bounded size")
        return json.loads(data.decode("utf-8"))


def normalize(job: dict) -> dict | None:
    title = str(job.get("title") or "").strip()
    description = str(job.get("description") or "")
    job_type = str(job.get("job_type") or "")
    haystack = f"{title} {description} {job_type}"
    if not title or not SCOPE.search(haystack) or not CONTRACT.search(haystack):
        return None
    url = str(job.get("url") or "").strip()
    return {
        "id": f"remotive-{job.get('id')}",
        "title": title,
        "platform": "Remotive",
        "url": url,
        "source": "remotive_public_api",
        "sourceUrl": OFFICIAL_SOURCE,
        "sourceKind": "public_feed",
        "verificationState": "public_feed_delayed",
        "fetchedAt": now(),
        "verifiedAt": None,
        "budget": None,
        "currency": None,
        "payoutStatus": "unknown",
        "aiPolicy": "unknown",
        "contractType": job_type or "unknown",
        "location": job.get("candidate_required_location") or "unknown",
        "description": re.sub(r"\s+", " ", description).strip()[:1200],
    }


def atomic_write(payload: dict) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if OUTPUT.exists():
        backup = OUTPUT.with_name(OUTPUT.name + ".bak")
        shutil.copy2(OUTPUT, backup)
    fd, temp_name = tempfile.mkstemp(prefix=".public-feed-", suffix=".json", dir=OUTPUT.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, OUTPUT)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def main() -> int:
    fetched_at = now()
    try:
        raw = fetch()
        jobs = raw.get("jobs", []) if isinstance(raw, dict) else []
        if not isinstance(jobs, list):
            raise ValueError("API response jobs is not a list")
        rows = [row for job in jobs if isinstance(job, dict) for row in [normalize(job)] if row]
        payload = {
            "schemaVersion": 1,
            "fetchedAt": fetched_at,
            "source": "remotive_public_api",
            "sourceUrl": OFFICIAL_SOURCE,
            "endpoint": ENDPOINT,
            "live": False,
            "delayCaveat": "Remotive public API may be delayed by up to 24 hours; this is not a live feed.",
            "readOnly": True,
            "count": len(rows),
            "opportunities": rows,
        }
        atomic_write(payload)
        print(json.dumps({"ok": True, "output": str(OUTPUT), "received": len(jobs), "matched": len(rows), "live": False}))
        return 0
    except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"ok": False, "endpoint": ENDPOINT, "error": str(exc)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
