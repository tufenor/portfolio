"""Gmail API read-only fallback for the MoneyIA email watcher.

OAuth client and refresh token live under the current Windows user's LocalAppData,
never in the repository. The scheduled cycle never opens an interactive login.
"""
from __future__ import annotations

import json
import os
import base64
import re
from email.utils import parseaddr
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from .storage import atomic_write_json

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
EXPECTED_ACCOUNT = os.environ.get("MONEYIA_GMAIL_ACCOUNT", "").strip().lower()
# Include both marketplaces (acceptances, replies and new jobs) and payment
# processors/banks (payout notices). All results remain read-only signals and
# are not treated as MoneyIA income until matched to a platform transaction.
GMAIL_QUERY = (
    "newer_than:30d {"
    "from:99freelas.com.br from:workana.com from:upwork.com "
    "from:freelancer.com.br from:freelancer.com from:fiverr.com "
    "from:outlier.ai from:utest.com from:dataannotation.tech "
    "from:mercadopago.com.br from:paypal.com from:wise.com "
    "from:payoneer.com from:airtm.com from:stripe.com "
    "from:bancointer.com.br from:inter.co}"
)


def _paths() -> tuple[Path, Path, Path]:
    local = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
    private = local / "MoneyIA"
    credentials = Path(os.environ.get("MONEYIA_GMAIL_CREDENTIALS") or private / "gmail-oauth-client.json")
    token = Path(os.environ.get("MONEYIA_GMAIL_TOKEN") or private / "gmail-readonly-token.json")
    status = Path(__file__).resolve().parents[2] / "data" / "email-watch-status.json"
    return credentials, token, status


def _save_status(payload: dict) -> dict:
    credentials, token, status_path = _paths()
    result = {
        "source": "gmail-api-readonly",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "credentialsConfigured": credentials.is_file(),
        "authorized": token.is_file(),
        **payload,
    }
    atomic_write_json(status_path, result)
    return result


def _imports():
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError as exc:
        raise RuntimeError("gmail_dependencies_missing") from exc
    return Request, Credentials, InstalledAppFlow, build


def authorize() -> dict:
    """Open the one-time browser consent flow, then keep a read-only token locally."""
    credentials_path, token_path, _ = _paths()
    if not EXPECTED_ACCOUNT:
        return _save_status({"status": "expected_account_missing", "action": "set_MONEYIA_GMAIL_ACCOUNT_locally"})
    if not credentials_path.is_file():
        return _save_status({"status": "oauth_client_missing", "action": "place_desktop_oauth_json_in_localappdata"})
    try:
        _, _, InstalledAppFlow, build = _imports()
        config = json.loads(credentials_path.read_text(encoding="utf-8"))
        if "installed" not in config:
            return _save_status({"status": "oauth_client_invalid", "action": "use_google_desktop_app_client"})
        flow = InstalledAppFlow.from_client_secrets_file(str(credentials_path), SCOPES)
        creds = flow.run_local_server(port=0, open_browser=True, access_type="offline", prompt="consent")
        service = build("gmail", "v1", credentials=creds, cache_discovery=False)
        profile = service.users().getProfile(userId="me").execute()
        account = str(profile.get("emailAddress", "")).strip().lower()
        if account != EXPECTED_ACCOUNT:
            return _save_status({"status": "wrong_google_account", "authorizedAccount": account, "expectedAccount": EXPECTED_ACCOUNT})
        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(creds.to_json(), encoding="utf-8")
        return _save_status({"status": "authorized", "authorizedAccount": account, "scope": "gmail.readonly"})
    except RuntimeError as exc:
        return _save_status({"status": str(exc), "action": "install_gmail_requirements"})
    except Exception as exc:  # OAuth and API errors are summarized; tokens and response bodies are never printed.
        return _save_status({"status": "authorization_failed", "errorType": type(exc).__name__})


def _headers(payload: dict) -> dict:
    return {str(row.get("name", "")).lower(): str(row.get("value", "")) for row in payload.get("headers", [])}


def _is_payment_notice(headers: dict) -> bool:
    """Limit body inspection to payment/sale alerts from known processors."""
    sender = parseaddr(str(headers.get("from", "")))[1].lower()
    subject = str(headers.get("subject", "")).lower()
    known_senders = (
        "mercadopago.com.br", "paypal.com", "payhip.com", "wise.com",
        "payoneer.com", "airtm.com", "stripe.com", "bancointer.com.br", "inter.co",
    )
    payment_words = re.compile(r"payment|pagamento|received|recebido|sale|venda|credited|creditado|payout|saque", re.I)
    sender_domain = sender.rsplit("@", 1)[-1] if "@" in sender else ""
    trusted_domain_match = any(
        sender_domain == domain or sender_domain.endswith(f".{domain}")
        for domain in known_senders
    )
    return trusted_domain_match and bool(payment_words.search(subject))


def _payload_contains_mock_marker(payload: dict) -> bool:
    """Inspect transient text MIME parts for a test-fixture marker; never persist body text."""
    stack = [payload] if isinstance(payload, dict) else []
    while stack:
        part = stack.pop()
        if not isinstance(part, dict):
            continue
        mime = str(part.get("mimeType", "")).lower()
        body = part.get("body", {}) if isinstance(part.get("body"), dict) else {}
        data = body.get("data")
        # Bound decoding and skip attachments/non-text MIME parts.
        if mime in {"text/plain", "text/html"} and not part.get("filename") and isinstance(data, str) and len(data) <= 2_000_000:
            try:
                encoded = data.encode("ascii")
                decoded = base64.urlsafe_b64decode(encoded + b"=" * (-len(encoded) % 4))
                text = decoded.decode("utf-8", errors="replace")
                if re.search(r"[?&]mocked\s*=\s*(?:%22|\\\")?true(?:%22|\\\")?(?:[&#\s\"']|$)", text, re.I):
                    return True
            except (ValueError, UnicodeEncodeError):
                continue
        children = part.get("parts", [])
        if isinstance(children, list):
            stack.extend(children)
    return False


def watch(base: str = "http://127.0.0.1:8899") -> dict:
    """Fetch recent marketplace notice headers/snippets and ingest without mailbox mutations."""
    credentials_path, token_path, _ = _paths()
    if not EXPECTED_ACCOUNT:
        return _save_status({"status": "expected_account_missing", "action": "set_MONEYIA_GMAIL_ACCOUNT_locally"})
    if not credentials_path.is_file():
        return _save_status({"status": "oauth_client_missing", "action": "configure_gmail_api_oauth"})
    if not token_path.is_file():
        return _save_status({"status": "oauth_authorization_required", "action": "run_gmail_api_auth_once"})
    try:
        Request, Credentials, _, build = _imports()
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
        if not creds.valid:
            if not (creds.expired and creds.refresh_token):
                return _save_status({"status": "oauth_authorization_required", "action": "reauthorize_gmail_api"})
            creds.refresh(Request())
            token_path.write_text(creds.to_json(), encoding="utf-8")
        service = build("gmail", "v1", credentials=creds, cache_discovery=False)
        profile = service.users().getProfile(userId="me").execute()
        account = str(profile.get("emailAddress", "")).strip().lower()
        if account != EXPECTED_ACCOUNT:
            return _save_status({"status": "wrong_google_account", "authorizedAccount": account, "expectedAccount": EXPECTED_ACCOUNT})

        listed = service.users().messages().list(userId="me", q=GMAIL_QUERY, maxResults=100).execute()
        messages = []
        payment_bodies_inspected = 0
        mock_fixtures_detected = 0
        for item in listed.get("messages", []):
            message = service.users().messages().get(
                userId="me", id=item["id"], format="metadata",
                metadataHeaders=["From", "To", "Subject", "Date"],
            ).execute()
            headers = _headers(message.get("payload", {}))
            test_fixture = False
            test_fixture_check = "not_applicable"
            if _is_payment_notice(headers):
                payment_bodies_inspected += 1
                try:
                    full_message = service.users().messages().get(
                        userId="me", id=item["id"], format="full",
                    ).execute()
                    test_fixture = _payload_contains_mock_marker(full_message.get("payload", {}))
                    test_fixture_check = "detected" if test_fixture else "clear"
                except Exception:
                    # A failed body inspection must not stop the rest of the
                    # read-only mailbox sync; it remains an unverified signal.
                    test_fixture_check = "unavailable"
                mock_fixtures_detected += int(test_fixture)
            try:
                email_ts = datetime.fromtimestamp(int(message.get("internalDate", "0")) / 1000, tz=timezone.utc).isoformat()
            except (ValueError, OSError, OverflowError):
                email_ts = headers.get("date") or None
            msg_id = str(message.get("id", ""))
            messages.append({
                "id": msg_id,
                "thread_id": str(message.get("threadId", "")),
                "from_": headers.get("from", ""),
                "to": [headers.get("to", "")] if headers.get("to") else [],
                "subject": headers.get("subject", ""),
                "snippet": str(message.get("snippet", ""))[:1000],
                "email_ts": email_ts,
                "display_url": f"https://mail.google.com/mail/u/0/#all/{msg_id}",
                "labels": message.get("labelIds", [])[:20],
                "test_fixture": test_fixture,
                "test_fixture_check": test_fixture_check,
            })

        if not messages:
            return _save_status({"status": "ok", "authorizedAccount": account, "messagesRead": 0, "query": GMAIL_QUERY, "lastSuccessAt": datetime.now(timezone.utc).isoformat()})

        payload = json.dumps({"source": "gmail-api-readonly", "emails": messages}, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            f"{base.rstrip('/')}/api/emails/ingest", data=payload,
            headers={"accept": "application/json", "content-type": "application/json"}, method="POST",
        )
        with urllib.request.urlopen(request, timeout=25) as response:
            result = json.loads(response.read().decode("utf-8"))
        return _save_status({
            "status": "ok", "authorizedAccount": account,
            "messagesRead": len(messages), "totalInInbox": result.get("analysis", {}).get("total", 0),
            "createdTasks": len(result.get("createdTasks", [])),
            "paymentBodiesInspected": payment_bodies_inspected,
            "mockFixturesDetected": mock_fixtures_detected,
            "query": GMAIL_QUERY, "lastSuccessAt": datetime.now(timezone.utc).isoformat(),
        })
    except RuntimeError as exc:
        return _save_status({"status": str(exc), "action": "install_gmail_requirements"})
    except urllib.error.HTTPError as exc:
        return _save_status({"status": "ingest_http_error", "httpStatus": exc.code})
    except Exception as exc:  # Avoid dumping OAuth/API exception bodies or secrets into the dashboard.
        return _save_status({"status": "watch_failed", "errorType": type(exc).__name__})
