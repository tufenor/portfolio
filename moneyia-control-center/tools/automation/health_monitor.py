from __future__ import annotations

import json
import urllib.error
import urllib.request


def check_url(url: str, timeout: float = 3.0) -> dict:
    try:
        request = urllib.request.Request(url, headers={"accept": "application/json"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return {"ok": 200 <= response.status < 300, "status": response.status, "json": json.loads(body)}
    except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
        return {"ok": False, "error": str(exc)[:200]}
