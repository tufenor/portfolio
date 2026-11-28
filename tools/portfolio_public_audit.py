#!/usr/bin/env python3
"""Read-only audit of published MoneyIA demo pages and their local assets.

Checks only HTTPS pages under tufenor.github.io/portfolio. It does not submit
forms, follow external asset links, or modify the pages being inspected.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import sys
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "data" / "demos.json"
DEFAULT_OUTPUT = ROOT / "data" / "public-demo-audit.json"
ALLOWED_HOST = "tufenor.github.io"
ALLOWED_PREFIX = "/portfolio/"
MAX_PAGE_BYTES = 2_000_000
USER_AGENT = "MoneyIA-PublicDemoAudit/1.0 (+https://github.com/tufenor/portfolio)"


def atomic_write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(payload)
        os.replace(temp_name, path)
    finally:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass


class PageReferences(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title: list[str] = []
        self.references: set[str] = set()
        self.in_title = False

    def handle_starttag(self, tag: str, attrs) -> None:
        values = dict(attrs)
        if tag.lower() == "title":
            self.in_title = True
        if tag.lower() in {"img", "script", "video", "audio", "source", "iframe"}:
            value = values.get("src")
            if value:
                self.references.add(value.strip())
        elif tag.lower() == "video" and values.get("poster"):
            self.references.add(values["poster"].strip())
        elif tag.lower() == "link" and "stylesheet" in str(values.get("rel", "")).lower().split():
            value = values.get("href")
            if value:
                self.references.add(value.strip())

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title.append(data)


def allowed_url(url: str) -> bool:
    parsed = urlsplit(url)
    return parsed.scheme == "https" and parsed.hostname == ALLOWED_HOST and parsed.path.startswith(ALLOWED_PREFIX)


def with_audit_marker(url: str, marker: str) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["moneyia_audit"] = marker
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))


def request_status(url: str, method: str = "HEAD") -> tuple[int | None, bytes, str | None]:
    request = urllib.request.Request(url, method=method, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
    try:
        with urllib.request.urlopen(request, timeout=18) as response:
            body = response.read(MAX_PAGE_BYTES + 1) if method == "GET" else b""
            if len(body) > MAX_PAGE_BYTES:
                return response.status, b"", "response_too_large"
            return response.status, body, None
    except urllib.error.HTTPError as error:
        return error.code, b"", f"http_{error.code}"
    except (OSError, TimeoutError, ValueError) as error:
        return None, b"", type(error).__name__


def check_url(url: str, marker: str) -> dict:
    if not allowed_url(url):
        return {"url": url, "status": None, "error": "url_outside_public_portfolio"}
    checked_url = with_audit_marker(url, marker)
    status, body, error = request_status(checked_url)
    method = "HEAD"
    if status in {400, 403, 405, 501}:
        status, body, error = request_status(checked_url, "GET")
        method = "GET"
    result = {"url": url, "checkedUrl": checked_url, "status": status, "method": method}
    if error:
        result["error"] = error
    if method == "GET" and body:
        parser = PageReferences()
        try:
            parser.feed(body.decode("utf-8-sig", "replace"))
            result["title"] = " ".join(" ".join(parser.title).split())
        except (ValueError, AssertionError):
            result["title"] = ""
    return result


def load_sources(source_path: Path, explicit_urls: list[str]) -> list[dict]:
    records: list[dict] = []
    if source_path.exists():
        loaded = json.loads(source_path.read_text(encoding="utf-8-sig"))
        if not isinstance(loaded, list):
            raise ValueError(f"A fonte precisa ser uma lista JSON: {source_path}")
        for row in loaded:
            if not isinstance(row, dict) or row.get("publicado") is False:
                continue
            url = str(row.get("url", "")).strip()
            if url:
                records.append({"name": str(row.get("negocio") or row.get("n") or row.get("id") or url), "url": url})
    records.extend({"name": url, "url": url} for url in explicit_urls)
    unique: dict[str, dict] = {}
    for row in records:
        unique.setdefault(row["url"].rstrip("/"), row)
    return list(unique.values())


def audit(records: list[dict], marker: str, workers: int) -> dict:
    pages = []
    for row in records:
        page = check_url(row["url"], marker)
        page["name"] = row["name"]
        page["assets"] = []
        if page.get("status") != 200:
            pages.append(page)
            continue

        # Read the document only after a successful HEAD check.
        body_url = page["checkedUrl"]
        status, body, error = request_status(body_url, "GET")
        page["pageFetchStatus"] = status
        if error or status != 200 or not body:
            page["pageFetchError"] = error or "empty_html"
            pages.append(page)
            continue
        parser = PageReferences()
        try:
            parser.feed(body.decode("utf-8-sig", "replace"))
            page["title"] = " ".join(" ".join(parser.title).split())
        except (ValueError, AssertionError):
            parser.references = set()
        assets = []
        for reference in sorted(parser.references):
            if not reference or reference.startswith(("data:", "javascript:", "mailto:", "tel:")):
                continue
            asset_url = urljoin(row["url"].rstrip("/") + "/", reference)
            if not allowed_url(asset_url):
                continue
            assets.append(asset_url)
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(workers, 8))) as pool:
            results = list(pool.map(lambda u: check_url(u, marker), assets))
        page["assets"] = results
        page["assetCount"] = len(results)
        page["assetFailures"] = sum(item.get("status") != 200 for item in results)
        pages.append(page)

    failed_pages = sum(item.get("status") != 200 or item.get("pageFetchStatus") not in (None, 200) for item in pages)
    failed_assets = sum(item.get("assetFailures", 0) for item in pages)
    return {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "source": "public_html_and_same_site_assets",
        "scope": "read_only; https://tufenor.github.io/portfolio only; external assets and browser-only interactions are not evaluated",
        "pageCount": len(pages),
        "assetCount": sum(item.get("assetCount", 0) for item in pages),
        "failedPages": failed_pages,
        "failedAssets": failed_assets,
        "ok": failed_pages == 0 and failed_assets == 0,
        "pages": pages,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="JSON com demos publicadas")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="arquivo JSON de resultado")
    parser.add_argument("--url", action="append", default=[], help="URL pública adicional; pode repetir")
    parser.add_argument("--workers", type=int, default=4, help="concorrência de checagem por página, máximo 8")
    args = parser.parse_args()
    try:
        rows = load_sources(args.source, args.url)
        if not rows:
            raise ValueError("Nenhuma demo publicada encontrada")
        marker = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        result = audit(rows, marker, args.workers)
        result["output"] = str(args.output)
        atomic_write_json(args.output, result)
        print(json.dumps({k: result[k] for k in ("ok", "pageCount", "assetCount", "failedPages", "failedAssets", "checkedAt", "output")}, ensure_ascii=False))
        return 0 if result["ok"] else 1
    except (OSError, json.JSONDecodeError, ValueError, TimeoutError) as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

