import re
from collections import Counter, defaultdict

IP_PATTERN = re.compile(r"(?:\d{1,3}\.){3}\d{1,3}")


def analyze_events(events):
    total = len(events)

    error_keywords = ["error", "failed", "invalid", "refused", "denied"]
    success_keywords = ["accepted", "success", "opened", "connected"]

    error_events = []
    success_events = []
    error_messages = Counter()
    ip_counter = Counter()
    timeline = defaultdict(int)

    for event in events:
        message = event.get("message", "")
        message_lower = message.lower()

        if any(word in message_lower for word in error_keywords):
            error_events.append(event)
            error_messages[message] += 1

        if any(word in message_lower for word in success_keywords):
            success_events.append(event)

        ip_match = IP_PATTERN.search(message)
        if ip_match:
            ip_counter[ip_match.group()] += 1

        timestamp = event.get("timestamp")
        if timestamp:
            hour = timestamp[:13]
            timeline[hour] += 1

    suspicious_ips = [
        {"ip": ip, "count": count}
        for ip, count in ip_counter.most_common()
        if count >= 5
    ]

    brute_force_candidates = [
        item for item in suspicious_ips if item["count"] >= 8
    ]

    return {
        "total_events": total,
        "error_count": len(error_events),
        "success_count": len(success_events),
        "top_errors": error_messages.most_common(10),
        "top_ips": ip_counter.most_common(10),
        "suspicious_ips": suspicious_ips,
        "brute_force_candidates": brute_force_candidates,
        "timeline": [
            {"hour": hour, "count": count}
            for hour, count in sorted(timeline.items())
        ],
    }