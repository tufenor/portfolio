"""Deduplicacao nao destrutiva de registros de oportunidade."""
from __future__ import annotations

import hashlib


def fingerprint(row: dict) -> str:
    for key in ("id", "url", "sourceUrl", "externalId"):
        value = row.get(key)
        if value:
            return str(value).strip().lower()
    stable = "|".join(str(row.get(k, "")).strip().lower() for k in ("title", "source", "platform"))
    return hashlib.sha256(stable.encode("utf-8")).hexdigest()


def deduplicate(rows: list[dict]) -> tuple[list[dict], int]:
    seen, result = set(), []
    for row in rows:
        if not isinstance(row, dict):
            continue
        key = fingerprint(row)
        if key in seen:
            continue
        seen.add(key)
        result.append(row)
    return result, len(rows) - len(result)
