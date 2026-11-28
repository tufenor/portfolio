#!/usr/bin/env python3
"""Collect a bounded, read-only snapshot from public remote-work APIs.

The feed is for MoneyIA's private local discovery dashboard. It never submits
applications. Public listings are discovery signals and are not page-verified.
No paid API keys are used.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "public-feed-opportunities.json"
TIMEOUT_SECONDS = 15
MAX_BYTES = 8_000_000
USER_AGENT = "moneyIA-public-work-discovery/1.1 (read-only; local dashboard)"

SCOPE = re.compile(
    r"\b(web|frontend|front-end|html|css|javascript|typescript|react|ui/ux|ux/ui|ui designer|ux designer|"
    r"product designer|web designer|graphic designer|visual designer|brand designer|figma|landing page|"
    r"automation|qa|quality assurance|test engineer|wordpress|shopify|python|api|no-code|low-code|"
    r"content writer|content reviewer|writer|writing|copywriter|copywriting|social media|community manager|"
    r"video editor|video editing|illustrator|illustration|logo designer|ai trainer|ai training|"
    r"model evaluator|annotator|data labeling|data annotation|prompt engineer|virtual assistant|transcription|translation)\b",
    re.I,
)
CONTRACT = re.compile(
    r"\b(contract|contractor|freelance|freelancer|part[- ]time|temporary|project[- ]based|"
    r"fixed[- ]term|short[- ]term|commission)\b",
    re.I,
)
SOURCES = {
    "remotive": {
        "name": "Remotive",
        "endpoint": "https://remotive.com/api/remote-jobs",
        "source_url": "https://github.com/remotive-com/remote-jobs-api",
        "freshness": "Public API may be delayed up to 24 hours.",
    },
    "jobicy": {
        "name": "Jobicy",
        "endpoint": "https://jobicy.com/api/jobs?" + urlencode({"count": 100}),
        "source_url": "https://jobicy.com/jobs-rss-feed",
        "freshness": "Public API includes jobs from the last 7 days after a publication delay; no paid key used.",
    },
    "himalayas": {
        "name": "Himalayas",
        "endpoint": "https://himalayas.app/jobs/api/search?" + urlencode({
            "worldwide": "true", "employment_type": "Contractor,Part Time,Temporary", "sort": "recent", "page": 1,
        }),
        "source_url": "https://himalayas.app/docs/remote-jobs-api",
        "freshness": "Public search API; responses may be cached for up to an hour or more.",
    },
    "arbeitnow_eu": {
        "name": "Arbeitnow EU",
        "endpoint": "https://www.arbeitnow.com/api/job-board-api?page=1",
        "source_url": "https://www.arbeitnow.com/blog/job-board-api",
        "freshness": "Public first-page API; only remote roles explicitly marked contract/freelance/part-time are retained.",
    },
    "arbeitnow_uk": {
        "name": "Arbeitnow UK",
        "endpoint": "https://www.arbeitnow.co.uk/api/job-board-api?page=1",
        "source_url": "https://www.arbeitnow.com/blog/job-board-api",
        "freshness": "Public UK API; only remote roles explicitly marked contract/freelance/part-time are retained.",
    },
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def fetch_json(url: str) -> dict:
    request = Request(url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
    with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError("response exceeds bounded size")
        if response.status != 200:
            raise ValueError(f"unexpected HTTP {response.status}")
        payload = json.loads(body.decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("response is not a JSON object")
        return payload


def clean_url(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    parts = urlsplit(raw)
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        return ""
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip("/"), "", ""))


def compact(value: object, limit: int = 1200) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str(value or ""))).strip()[:limit]


def _row(source_key: str, external_id: object, title: object, company: object, url: object,
         description: object, employment: object, location: object, published: object = None,
         salary_min: object = None, salary_max: object = None, currency: object = None,
         period: object = None, categories: object = None) -> dict | None:
    source = SOURCES[source_key]
    title_text = str(title or "").strip()
    desc = compact(description)
    employment_text = ", ".join(str(v) for v in employment) if isinstance(employment, list) else str(employment or "")
    category_text = ", ".join(str(v) for v in categories) if isinstance(categories, list) else str(categories or "")
    # Use structured title/category and employment fields. Description text often
    # mentions unrelated technologies or contract terms and created false matches.
    if not title_text or not clean_url(url) or not SCOPE.search(f"{title_text} {category_text}") or not CONTRACT.search(employment_text):
        return None
    salary = None
    budget = None
    if salary_min is not None or salary_max is not None:
        salary = {"min": salary_min, "max": salary_max, "period": period or "unknown"}
        if isinstance(salary_min, str) and salary_max is None:
            budget = salary_min.strip() or None
        else:
            def amount_text(value: object) -> str:
                if value is None:
                    return ""
                try:
                    number = float(value)
                    return f"{number:,.0f}" if number.is_integer() else f"{number:,.2f}"
                except (TypeError, ValueError):
                    return str(value).strip()
            low, high = amount_text(salary_min), amount_text(salary_max)
            range_text = f"{low}–{high}" if low and high else low or high
            denomination = str(currency or "moeda não informada").strip()
            budget = f"{denomination} {range_text} / {period or 'período não informado'}".strip()
    return {
        "id": f"{source_key}-{external_id or clean_url(url)}",
        "title": title_text,
        "company": str(company or "unknown").strip(),
        "platform": source["name"],
        "url": clean_url(url),
        "source": f"{source_key}_public_api",
        "sourceUrl": source["source_url"],
        "sourceKind": "public_feed",
        "verificationState": "public_feed_listed_not_page_verified",
        "fetchedAt": now(),
        "publishedAt": published,
        "budget": budget,
        "salaryRange": salary,
        "currency": currency,
        "payoutStatus": "unknown",
        "aiPolicy": "unknown",
        "contractType": employment_text or "unknown",
        "location": str(location or "unknown"),
        "description": desc,
    }


def parse_remotive(payload: dict) -> list[dict]:
    jobs = payload.get("jobs", [])
    if not isinstance(jobs, list):
        raise ValueError("Remotive response has no jobs array")
    out = []
    for job in jobs:
        if not isinstance(job, dict):
            continue
        row = _row("remotive", job.get("id"), job.get("title"), job.get("company_name"),
                   job.get("url"), job.get("description"), job.get("job_type"),
                   job.get("candidate_required_location"), job.get("publication_date"),
                   job.get("salary"), None, None, "as listed",
                   [job.get("category", ""), *(job.get("tags") or [])])
        if row:
            out.append(row)
    return out


def parse_jobicy(payload: dict) -> list[dict]:
    jobs = payload.get("jobs", [])
    if not isinstance(jobs, list) or payload.get("success") is False:
        raise ValueError("Jobicy response is not successful")
    out = []
    for job in jobs:
        if not isinstance(job, dict):
            continue
        row = _row("jobicy", job.get("id"), job.get("jobTitle"), job.get("companyName"),
                   job.get("url"), job.get("jobDescription") or job.get("jobExcerpt"),
                   job.get("jobType"), job.get("jobGeo"), job.get("pubDate"),
                   job.get("salaryMin"), job.get("salaryMax"), job.get("salaryCurrency"),
                   job.get("salaryPeriod"), job.get("jobIndustry"))
        if row:
            out.append(row)
    return out


def parse_himalayas(payload: dict) -> list[dict]:
    jobs = payload.get("jobs", [])
    if not isinstance(jobs, list):
        raise ValueError("Himalayas response has no jobs array")
    out = []
    for job in jobs:
        if not isinstance(job, dict):
            continue
        row = _row("himalayas", job.get("guid"), job.get("title"), job.get("companyName"),
                   job.get("applicationLink"), job.get("description") or job.get("excerpt"),
                   job.get("employmentType"), ", ".join(job.get("locationRestrictions") or []) or "worldwide",
                   job.get("pubDate"), job.get("minSalary"), job.get("maxSalary"),
                   job.get("currency"), job.get("salaryPeriod"), job.get("categories"))
        if row:
            out.append(row)
    return out


def parse_arbeitnow(payload: dict, source_key: str) -> list[dict]:
    jobs = payload.get("data", [])
    if not isinstance(jobs, list):
        raise ValueError("Arbeitnow response has no data array")
    out = []
    for job in jobs:
        if not isinstance(job, dict) or job.get("remote") is not True:
            continue
        employment = job.get("job_types") or []
        # Keep only explicitly flexible/contract forms; remote alone is not a fit.
        employment_text = ", ".join(str(v) for v in employment) if isinstance(employment, list) else str(employment)
        if not CONTRACT.search(employment_text):
            continue
        row = _row(source_key, job.get("slug"), job.get("title"), job.get("company_name"),
                   job.get("url"), job.get("description"), employment_text,
                   job.get("location"), job.get("created_at"), categories=job.get("tags"))
        if row:
            out.append(row)
    return out


PARSERS = {
    "remotive": parse_remotive,
    "jobicy": parse_jobicy,
    "himalayas": parse_himalayas,
    "arbeitnow_eu": lambda payload: parse_arbeitnow(payload, "arbeitnow_eu"),
    "arbeitnow_uk": lambda payload: parse_arbeitnow(payload, "arbeitnow_uk"),
}


def atomic_write(payload: dict) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if OUTPUT.exists():
        shutil.copy2(OUTPUT, OUTPUT.with_name(OUTPUT.name + ".bak"))
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


def load_previous() -> dict:
    try:
        payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def main() -> int:
    fetched_at = now()
    previous = load_previous()
    previous_rows = previous.get("opportunities", [])
    previous_rows = previous_rows if isinstance(previous_rows, list) else []
    statuses = {}
    fresh_rows: list[dict] = []

    def fetch_source(key: str) -> tuple[dict, list[dict]]:
        source = SOURCES[key]
        raw = fetch_json(source["endpoint"])
        rows = PARSERS[key](raw)
        return ({"status": "ok", "recordsRead": len(raw.get("jobs", raw.get("data", []))),
                 "matches": len(rows), "fetchedAt": fetched_at,
                 "endpoint": source["endpoint"], "freshness": source["freshness"]}, rows)

    # Query the independent public, read-only APIs concurrently.
    with ThreadPoolExecutor(max_workers=min(6, len(SOURCES))) as executor:
        futures = {executor.submit(fetch_source, key): key for key in SOURCES}
        for future in as_completed(futures):
            key = futures[future]
            source = SOURCES[key]
            try:
                source_status, rows = future.result()
                statuses[key] = source_status
                fresh_rows.extend(rows)
            except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError, OSError) as exc:
                statuses[key] = {"status": "failed", "fetchedAt": fetched_at,
                                 "endpoint": source["endpoint"],
                                 "error": f"{type(exc).__name__}: {str(exc)[:180]}"}

    if not any(s.get("status") == "ok" for s in statuses.values()):
        print(json.dumps({"ok": False, "sources": statuses}, ensure_ascii=False), file=sys.stderr)
        return 2

    successful_sources = {key for key, status in statuses.items() if status.get("status") == "ok"}
    rows_by_url: dict[str, dict] = {}
    for row in previous_rows:
        if not isinstance(row, dict):
            continue
        source_key = str(row.get("source", "")).removesuffix("_public_api")
        url = clean_url(row.get("url"))
        if source_key not in successful_sources and url:
            retained = dict(row)
            retained["verificationState"] = "stale_feed_unconfirmed"
            rows_by_url[url] = retained
    for row in fresh_rows:
        rows_by_url[row["url"]] = row

    rows = sorted(rows_by_url.values(), key=lambda row: str(row.get("publishedAt") or row.get("fetchedAt") or ""), reverse=True)
    payload = {
        "schemaVersion": 2,
        "fetchedAt": fetched_at,
        "source": "multi_source_public_apis",
        "sourceUrl": ";".join(source["source_url"] for source in SOURCES.values()),
        "live": False,
        "readOnly": True,
        "privateDashboardOnly": True,
        "recordsAreDiscoverySignals": True,
        "sourceStatuses": statuses,
        "count": len(rows),
        "opportunities": rows,
    }
    atomic_write(payload)
    succeeded = sum(1 for status in statuses.values() if status.get("status") == "ok")
    print(json.dumps({"ok": succeeded > 0, "output": str(OUTPUT), "sourcesOk": succeeded,
                      "sourcesTotal": len(SOURCES), "matches": len(fresh_rows),
                      "deduplicated": len(rows), "status": statuses}, ensure_ascii=False))
    return 0 if succeeded > 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())

