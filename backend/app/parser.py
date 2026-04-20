import csv
import io
import re
from datetime import datetime

SYSLOG_PATTERN = re.compile(
    r"^(?P<timestamp>[A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+"
    r"(?P<host>[\w\-.]+)\s+"
    r"(?P<service>[\w\-/\[\]0-9]+):\s+"
    r"(?P<message>.*)$"
)


def parse_log_file(text: str):
    """
    Supports:
    1. Classic syslog lines
    2. Tab-separated log lines (Rimon / security gateway style)
    """
    text = text.strip()
    if not text:
        return []

    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        return []

    if looks_like_tsv_log(lines):
        return parse_tsv_logs(lines)

    return parse_syslog_lines(lines)


def looks_like_tsv_log(lines: list[str]) -> bool:
    sample = lines[:5]
    tab_rich_lines = 0

    for line in sample:
        if line.count("\t") >= 5:
            tab_rich_lines += 1

    return tab_rich_lines >= 2


def parse_syslog_lines(lines: list[str]):
    events = []
    current_year = datetime.now().year

    for line in lines:
        match = SYSLOG_PATTERN.match(line.strip())
        if not match:
            continue

        data = match.groupdict()

        try:
            ts = datetime.strptime(
                f"{data['timestamp']} {current_year}",
                "%b %d %H:%M:%S %Y",
            )
            timestamp = ts.isoformat()
        except ValueError:
            timestamp = None

        events.append(
            {
                "timestamp": timestamp,
                "host": data["host"],
                "service": data["service"],
                "message": data["message"],
                "raw": line,
                "extra_fields": {},
            }
        )

    return events


def parse_tsv_logs(lines: list[str]):
    """
    Parses tab-separated security/product logs.

    Expected general shape:
    time    action  reason  policy  session  src_ip  event_type  protocol  score  destination  referrer  category  user_agent  country
    """
    events = []

    reader = csv.reader(io.StringIO("\n".join(lines)), delimiter="\t")

    for row in reader:
        if not row:
            continue

        # normalize row length
        row = [cell.strip() for cell in row]

        if len(row) < 6:
            continue

        # Safe positional mapping for common Rimon-like TSV logs
        time_value = row[0] if len(row) > 0 else ""
        action = row[1] if len(row) > 1 else ""
        reason = row[2] if len(row) > 2 else ""
        policy = row[3] if len(row) > 3 else ""
        session_id = row[4] if len(row) > 4 else ""
        src_ip = row[5] if len(row) > 5 else ""
        event_type = row[6] if len(row) > 6 else ""
        protocol = row[7] if len(row) > 7 else ""
        score = row[8] if len(row) > 8 else ""
        destination = row[9] if len(row) > 9 else ""
        referrer = row[10] if len(row) > 10 else ""
        category = row[11] if len(row) > 11 else ""
        user_agent = row[12] if len(row) > 12 else ""
        country = row[13] if len(row) > 13 else ""

        service = event_type or protocol or "tabular_log"

        # Build a searchable message for analyzers/investigators
        message_parts = [
            action,
            reason,
            policy,
            src_ip,
            event_type,
            protocol,
            score,
            destination,
            referrer,
            category,
            user_agent,
            country,
        ]
        message = " | ".join(part for part in message_parts if part and part != "NA")

        # keep timestamp simple for now
        timestamp = normalize_time_only(time_value)

        events.append(
            {
                "timestamp": timestamp,
                "host": src_ip or None,
                "service": service,
                "message": message,
                "raw": "\t".join(row),
                "extra_fields": {
                    "time": time_value,
                    "action": action,
                    "reason": reason,
                    "policy": policy,
                    "session_id": session_id,
                    "src_ip": src_ip,
                    "event_type": event_type,
                    "protocol": protocol,
                    "score": score,
                    "destination": destination,
                    "referrer": referrer,
                    "category": category,
                    "user_agent": user_agent,
                    "country": country,
                },
            }
        )

    return events


def normalize_time_only(value: str):
    """
    If only HH:MM:SS exists, attach today's date so timeline still works.
    """
    if not value:
        return None

    try:
        today = datetime.now().strftime("%Y-%m-%d")
        ts = datetime.strptime(f"{today} {value}", "%Y-%m-%d %H:%M:%S")
        return ts.isoformat()
    except ValueError:
        return None