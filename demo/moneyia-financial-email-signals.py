"""Privacy-preserving reconciliation of payment emails in the local inbox."""
from __future__ import annotations

import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path


def _fold(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    return "".join(char for char in text if unicodedata.category(char) != "Mn").lower()


def _amount(text: str) -> tuple[str | None, float | None]:
    match = re.search(r"\bR\$\s*([\d.]+,\d{2}|\d+,\d{2}|\d+\.\d{2})", text, re.I)
    if not match:
        return None, None
    raw = match.group(1)
    normalized = raw.replace(".", "").replace(",", ".") if "," in raw else raw
    try:
        return "BRL", float(Decimal(normalized))
    except InvalidOperation:
        return "BRL", None


def summarize_email_financial_signals(root: Path) -> dict:
    """Summarize explicit email evidence without changing finance.json."""
    path = root / "data" / "email-inbox.json"
    try:
        box = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        box = {}
    rows = box.get("emails", []) if isinstance(box, dict) else []
    if not isinstance(rows, list):
        rows = []

    try:
        as_of = datetime.fromisoformat(str(box.get("scannedAt", "")).replace("Z", "+00:00"))
        scan_date = as_of.date().isoformat()
    except (TypeError, ValueError):
        scan_date = datetime.now(timezone.utc).date().isoformat()

    paid, pending, incoming = [], [], 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        subject = str(row.get("subject", ""))
        snippet = str(row.get("snippet", ""))
        text = _fold(f"{subject} {snippet}")
        source = _fold(row.get("source", row.get("from", "")))
        if row.get("kind") in {"payment_received", "payment_unattributed", "product_sale_signal"}:
            incoming += 1

        due_signal = bool(re.search(
            r"pagamento\s+pendente\s+para|pague\s+para|payment\s+due|payment\s+pending\s+for",
            text,
        ))
        paid_signal = bool(re.search(
            r"voce\s+comprou\s+de|voce\s+pagou|pagamento\s+feito\s+por|you\s+paid|you\s+bought|payment\s+sent",
            text,
        ))
        if not due_signal and not paid_signal:
            continue

        canonical_merchants = {
            "workana": "workana",
            "99freelas": "99freelas",
            "upwork": "upwork",
            "freelancer": "freelancer",
            "paypal": "paypal",
            "mercado pago": "mercado pago",
        }
        merchant = next((name for marker, name in canonical_merchants.items() if marker in text), None)
        merchant_match = re.search(
            r"(?:para|de|to|from)\s+([a-z0-9][a-z0-9 .&_-]{1,60}?)(?=\s+(?:voce|you|pagamento|seu|se precisar|ate|at|como|use|valor|r\$)|$)",
            text,
        ) if merchant is None else None
        merchant = merchant or (re.sub(r"\s+", " ", merchant_match.group(1)).strip(" .-") if merchant_match else "não identificado")
        currency, amount = _amount(text)
        email_ts = str(row.get("emailTs") or row.get("receivedAt") or "")
        # Gmail DOM timestamps are sometimes clock-only. Include the scan date
        # so separate days are never merged into one transaction.
        time_match = re.search(r"\b(\d{1,2}:\d{2})\b", email_ts)
        minute_key = f"{scan_date}T{time_match.group(1)}" if time_match else email_ts
        item = {
            "merchantKey": merchant,
            "amountKey": (currency, amount),
            "minuteKey": minute_key,
            "id": str(row.get("id", "")),
            "amount": amount,
            "currency": currency,
        }
        (pending if due_signal and not paid_signal else paid).append(item)

    # A matching pending notice and approved-payment notice in the same minute
    # describe one transition, not two separate expenses.
    pending_by_key: dict[tuple, list[dict]] = defaultdict(list)
    for item in pending:
        key = (item["merchantKey"], item["amountKey"], item["minuteKey"])
        pending_by_key[key].append(item)
    paired_pending_ids: set[str] = set()
    for item in paid:
        key = (item["merchantKey"], item["amountKey"], item["minuteKey"])
        candidates = pending_by_key.get(key, [])
        if candidates:
            paired_pending_ids.add(candidates.pop(0)["id"])

    gross_paid: dict[str, Decimal] = defaultdict(Decimal)
    amounts_parseable = 0
    for item in paid:
        if item["currency"] and item["amount"] is not None:
            gross_paid[item["currency"]] += Decimal(str(item["amount"]))
            amounts_parseable += 1

    return {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "source": "local_email_inbox",
        "paidOutflowEmailSignals": len(paid),
        "pendingOutflowEmailSignals": len(pending),
        "pendingMatchedToPaidInSameMinute": len(paired_pending_ids),
        "incomingPaymentOrSaleCandidates": incoming,
        "explicitPaidOutflowAmountByCurrency": {
            currency: round(float(amount), 2) for currency, amount in gross_paid.items()
        },
        "paidOutflowAmountsParsed": amounts_parseable,
        "ledgerUpdated": False,
        "note": "E-mails são sinais auxiliares; não atualizam receita nem caixa sem conciliação com a plataforma ou conta.",
    }
