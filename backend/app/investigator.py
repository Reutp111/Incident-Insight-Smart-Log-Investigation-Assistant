import re
from collections import Counter

IP_PATTERN = re.compile(r"(?:\d{1,3}\.){3}\d{1,3}")
DOMAIN_PATTERN = re.compile(r"\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b")
URL_PATTERN = re.compile(r"https?://[^\s]+")
PORT_PATTERN = re.compile(r"\bport\s+(\d{1,5})\b", re.IGNORECASE)
WORD_PATTERN = re.compile(r"\b[a-zA-Z][a-zA-Z0-9_\-]{2,}\b")

STOP_WORDS = {
    "the", "and", "for", "with", "from", "that", "this", "are", "was", "not",
    "have", "has", "had", "but", "you", "your", "can", "via", "http", "https",
    "www", "com", "net", "org", "local", "general", "request", "response",
    "parse", "monitor", "enabled", "blocked", "allowed", "event", "system",
    "service", "user", "good", "script", "high", "medium", "low",
    "request_general", "http_request_general", "http_monitor_response",
    "ipport_ssl", "ssl_cert", "dns_event",
}

RELATED_TERMS = {
    "vpn": [
        "vpn", "openvpn", "ipsec", "ike", "l2tp", "pptp",
        "wireguard", "forticlient", "anyconnect", "tunnel",
        "remote access", "ssl vpn",
    ],
    "proxy": [
        "proxy", "squid", "gateway", "upstream", "web filter",
        "filtering", "blocked", "access denied", "forbidden",
    ],
    "dns": [
        "dns", "resolve", "resolver", "hostname", "domain",
        "nslookup", "nxdomain", "servfail", "timeout",
    ],
    "authentication": [
        "auth", "authentication", "login", "signin", "password",
        "credential", "token", "denied", "unauthorized", "forbidden",
        "failed password", "invalid user",
    ],
    "camera": [
        "camera", "cctv", "rtsp", "onvif", "hikvision", "dahua",
        "nvr", "dvr", "stream", "video", "surveillance", "port 554",
        "snapshot", "webcam",
    ],
    "timeout": [
        "timeout", "timed out", "connection reset", "reset by peer",
        "unreachable", "refused", "failed to connect", "latency",
    ],
    "certificate": [
        "certificate", "ssl", "tls", "x509", "handshake",
        "expired", "ca", "trust", "verification failed", "ssl_cert",
        "sni", "issuer", "subject",
    ],
}

AUTO_THEMES = {
    "vpn": RELATED_TERMS["vpn"],
    "proxy": RELATED_TERMS["proxy"],
    "dns": RELATED_TERMS["dns"],
    "authentication": RELATED_TERMS["authentication"],
    "camera": RELATED_TERMS["camera"],
    "timeout": RELATED_TERMS["timeout"],
    "certificate": RELATED_TERMS["certificate"],
}

CATEGORY_LABELS = {
    "vpn": "VPN / Remote Access",
    "proxy": "Proxy / Filtering",
    "dns": "DNS / Resolution",
    "authentication": "Authentication / Login",
    "camera": "Camera / Device Traffic",
    "timeout": "Timeout / Connectivity",
    "certificate": "Certificate / SSL",
}


def normalize_keyword(keyword):
    if not keyword:
        return None
    cleaned = keyword.strip().lower()
    return cleaned or None


def expand_terms(keyword):
    if not keyword:
        return []

    if keyword in RELATED_TERMS:
        return RELATED_TERMS[keyword]

    expanded = [keyword]

    for key, terms in RELATED_TERMS.items():
        if keyword == key or keyword in terms:
            expanded.extend(terms)

    return list(dict.fromkeys(expanded))


def build_searchable_text(event):
    parts = [
        str(event.get("message", "")),
        str(event.get("service", "")),
        str(event.get("raw", "")),
    ]

    extra_fields = event.get("extra_fields", {})
    if isinstance(extra_fields, dict):
        parts.extend(str(value) for value in extra_fields.values() if value is not None)

    return " ".join(parts)


def detect_themes(events):
    theme_counter = Counter()

    for event in events:
        msg = build_searchable_text(event).lower()
        for theme, terms in AUTO_THEMES.items():
            if any(term in msg for term in terms):
                theme_counter[theme] += 1

    return [
        {"theme": theme, "count": count}
        for theme, count in theme_counter.most_common(5)
    ]


def extract_entities(events):
    ip_counter = Counter()
    domain_counter = Counter()
    url_counter = Counter()
    port_counter = Counter()
    service_counter = Counter()

    for event in events:
        searchable = build_searchable_text(event)
        service = event.get("service")

        if service:
            service_counter[service] += 1

        for ip in IP_PATTERN.findall(searchable):
            ip_counter[ip] += 1

        for domain in DOMAIN_PATTERN.findall(searchable):
            if not IP_PATTERN.fullmatch(domain):
                domain_counter[domain] += 1

        for url in URL_PATTERN.findall(searchable):
            url_counter[url] += 1

        for port in PORT_PATTERN.findall(searchable):
            port_counter[port] += 1

    return {
        "top_ips": [{"value": ip, "count": count} for ip, count in ip_counter.most_common(8)],
        "top_domains": [{"value": d, "count": count} for d, count in domain_counter.most_common(8)],
        "top_urls": [{"value": u, "count": count} for u, count in url_counter.most_common(8)],
        "top_ports": [{"value": p, "count": count} for p, count in port_counter.most_common(8)],
        "top_services": [{"value": s, "count": count} for s, count in service_counter.most_common(8)],
    }


def extract_repeated_terms(events):
    counter = Counter()

    for event in events:
        searchable = build_searchable_text(event).lower()
        words = WORD_PATTERN.findall(searchable)

        for word in words:
            if word in STOP_WORDS:
                continue
            if word.isdigit():
                continue
            if len(word) < 3:
                continue
            counter[word] += 1

    return [
        {"term": term, "count": count}
        for term, count in counter.most_common(12)
        if count >= 2
    ]


def build_issue_categories(events, repeated_terms, entities):
    category_scores = {}
    category_reasons = {}

    repeated_term_set = {item["term"] for item in repeated_terms}
    repeated_ips = {item["value"] for item in entities["top_ips"] if item["count"] >= 2}

    for category, terms in AUTO_THEMES.items():
        score = 0
        reasons = []

        for event in events:
            text = build_searchable_text(event).lower()
            matched_terms = [term for term in terms if term in text]
            if matched_terms:
                score += len(matched_terms)
                for term in matched_terms[:3]:
                    reason = f'matched term "{term}"'
                    if reason not in reasons:
                        reasons.append(reason)

        for term in terms:
            if term in repeated_term_set:
                score += 2
                reason = f'repeated indicator "{term}"'
                if reason not in reasons:
                    reasons.append(reason)

        if category == "authentication" and repeated_ips:
            score += 1
            reasons.append("repeated IP activity appears alongside login-related indicators")

        if score > 0:
            category_scores[category] = score
            category_reasons[category] = reasons[:4]

    ranked = sorted(category_scores.items(), key=lambda item: item[1], reverse=True)

    output = []
    for category, score in ranked:
        confidence = "Low"
        if score >= 8:
            confidence = "High"
        elif score >= 4:
            confidence = "Medium"

        output.append(
            {
                "category": category,
                "label": CATEGORY_LABELS.get(category, category.title()),
                "score": score,
                "confidence": confidence,
                "reasons": category_reasons.get(category, []),
            }
        )

    return output[:6]


def suggest_keywords(issue_categories, repeated_terms):
    suggestions = []
    seen = set()

    for category in issue_categories[:3]:
        category_key = category["category"]
        for term in RELATED_TERMS.get(category_key, [])[:4]:
            if term not in seen:
                suggestions.append(term)
                seen.add(term)

    for item in repeated_terms[:6]:
        term = item["term"]
        if term not in seen:
            suggestions.append(term)
            seen.add(term)

    return suggestions[:10]


def auto_score_event(event, repeated_terms, repeated_ips):
    searchable = build_searchable_text(event)
    searchable_lower = searchable.lower()
    score = 0
    matched_terms = []
    why_flagged = []

    for item in repeated_terms[:10]:
        term = item["term"]
        if term in searchable_lower:
            score += 2
            matched_terms.append(term)
            why_flagged.append(f'repeated term "{term}"')

    for item in repeated_ips[:10]:
        ip = item["value"]
        if ip in searchable:
            score += 3
            matched_terms.append(ip)
            why_flagged.append(f'repeated IP "{ip}"')

    suspicious_keywords = [
        "failed", "denied", "blocked", "timeout", "refused",
        "certificate", "ssl", "vpn", "proxy", "camera", "dns",
        "rtsp", "onvif", "authentication", "login",
    ]

    for word in suspicious_keywords:
        if word in searchable_lower and word not in matched_terms:
            score += 2
            matched_terms.append(word)
            why_flagged.append(f'contains indicator "{word}"')

    return score, matched_terms[:8], list(dict.fromkeys(why_flagged))[:5]


def keyword_score_event(event, keyword, terms):
    searchable = build_searchable_text(event).lower()
    score = 0
    matched_terms = []
    why_flagged = []

    if keyword and keyword in searchable:
        score += 3
        matched_terms.append(keyword)
        why_flagged.append(f'exact keyword match "{keyword}"')

    for term in terms:
        if term in searchable and term not in matched_terms:
            score += 2
            matched_terms.append(term)
            why_flagged.append(f'related term match "{term}"')

    return score, matched_terms[:8], list(dict.fromkeys(why_flagged))[:5]


def build_investigation_summary(
    keyword,
    matched_count,
    matched_term_counter,
    themes,
    entities,
    repeated_terms,
    issue_categories,
):
    lines = []

    if keyword:
        if matched_count > 0:
            lines.append(
                f'The uploaded log contains {matched_count} line(s) related to "{keyword}" or closely related terms.'
            )
        else:
            lines.append(
                f'No direct matches were found for "{keyword}", but the automatic analysis still detected useful patterns.'
            )
    else:
        if themes:
            theme_names = ", ".join(item["theme"] for item in themes[:3])
            lines.append(f"Automatically detected main themes: {theme_names}.")
        else:
            lines.append("No strong theme was automatically detected from the uploaded log.")

    if issue_categories:
        top_categories = ", ".join(item["label"] for item in issue_categories[:3])
        lines.append(f"Most likely issue categories: {top_categories}.")

    if repeated_terms:
        top_terms = ", ".join(item["term"] for item in repeated_terms[:5])
        lines.append(f"Repeated terms detected in the log include: {top_terms}.")

    if entities["top_ips"]:
        repeated_ip_candidates = [item for item in entities["top_ips"] if item["count"] >= 2]
        if repeated_ip_candidates:
            ip_text = ", ".join(item["value"] for item in repeated_ip_candidates[:3])
            lines.append(f"Repeated IP addresses detected: {ip_text}.")

    if matched_term_counter:
        top_terms = ", ".join(term for term, _ in matched_term_counter.most_common(5))
        lines.append(f"Most relevant matched indicators: {top_terms}.")

    lines.append(
        "Review the most relevant lines first, then validate the findings against related infrastructure or application logs."
    )

    return lines


def investigate_events(events, keyword=None):
    keyword = normalize_keyword(keyword)
    expanded_terms = expand_terms(keyword)
    themes = detect_themes(events)
    entities = extract_entities(events)
    repeated_terms = extract_repeated_terms(events)
    issue_categories = build_issue_categories(events, repeated_terms, entities)
    suggested_keywords = suggest_keywords(issue_categories, repeated_terms)

    matched_lines = []
    matched_term_counter = Counter()

    if keyword:
        for event in events:
            score, matched_terms, why_flagged = keyword_score_event(event, keyword, expanded_terms)
            if score > 0:
                matched_lines.append({
                    "timestamp": event.get("timestamp"),
                    "service": event.get("service"),
                    "message": event.get("message"),
                    "score": score,
                    "matched_terms": matched_terms,
                    "why_flagged": why_flagged,
                })
                matched_term_counter.update(matched_terms)
    else:
        repeated_ips = [item for item in entities["top_ips"] if item["count"] >= 2]

        for event in events:
            score, matched_terms, why_flagged = auto_score_event(event, repeated_terms, repeated_ips)
            if score > 0:
                matched_lines.append({
                    "timestamp": event.get("timestamp"),
                    "service": event.get("service"),
                    "message": event.get("message"),
                    "score": score,
                    "matched_terms": matched_terms,
                    "why_flagged": why_flagged,
                })
                matched_term_counter.update(matched_terms)

    matched_lines.sort(key=lambda item: item["score"], reverse=True)

    summary = build_investigation_summary(
        keyword=keyword,
        matched_count=len(matched_lines),
        matched_term_counter=matched_term_counter,
        themes=themes,
        entities=entities,
        repeated_terms=repeated_terms,
        issue_categories=issue_categories,
    )

    return {
        "keyword": keyword,
        "expanded_terms": expanded_terms,
        "matched_lines_count": len(matched_lines),
        "matched_terms": dict(matched_term_counter),
        "top_relevant_lines": matched_lines[:12],
        "detected_themes": themes,
        "entities": entities,
        "repeated_terms": repeated_terms,
        "issue_categories": issue_categories,
        "suggested_keywords": suggested_keywords,
        "investigation_summary": summary,
    }