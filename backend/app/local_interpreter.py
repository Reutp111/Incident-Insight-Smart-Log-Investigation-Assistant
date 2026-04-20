from typing import Any


def _top_terms(payload: dict, limit: int = 5) -> list[str]:
    repeated = payload.get("investigation", {}).get("repeated_terms", [])
    return [item["term"] for item in repeated[:limit] if item.get("term")]


def _top_ips(payload: dict, limit: int = 5) -> list[str]:
    top_ips = payload.get("investigation", {}).get("entities", {}).get("top_ips", [])
    return [item["value"] for item in top_ips[:limit] if item.get("value")]


def _top_themes(payload: dict, limit: int = 5) -> list[str]:
    themes = payload.get("investigation", {}).get("detected_themes", [])
    return [item["theme"] for item in themes[:limit] if item.get("theme")]


def _explained_terms(payload: dict, limit: int = 5) -> list[dict[str, str]]:
    terms = payload.get("explained_terms_in_log", [])
    return [
        {"term": item.get("term", ""), "meaning": item.get("meaning", "")}
        for item in terms[:limit]
        if item.get("term") and item.get("meaning")
    ]


def _top_lines(payload: dict, limit: int = 3) -> list[dict[str, Any]]:
    lines = payload.get("investigation", {}).get("top_relevant_lines", [])
    return lines[:limit]


def _assessment(payload: dict) -> tuple[str, str]:
    analysis = payload.get("analysis", {})
    investigation = payload.get("investigation", {})

    brute_force = analysis.get("brute_force_candidates", [])
    suspicious_ips = analysis.get("suspicious_ips", [])
    themes = _top_themes(payload, 3)
    repeated_terms = _top_terms(payload, 5)

    if brute_force:
        return (
            "High",
            "The log suggests repeated suspicious activity that may indicate automated or unauthorized access attempts.",
        )

    if suspicious_ips:
        return (
            "Medium",
            "The log shows repeated IP activity that looks unusual and may require investigation.",
        )

    if themes:
        theme_text = ", ".join(themes)
        return (
            "Medium",
            f"The log mainly appears related to: {theme_text}.",
        )

    if repeated_terms:
        term_text = ", ".join(repeated_terms[:3])
        return (
            "Low to Medium",
            f"The log does not show a strong single issue, but repeated indicators were found such as: {term_text}.",
        )

    return (
        "Low",
        "No strong suspicious pattern was detected from the current findings.",
    )


def _build_evidence(payload: dict) -> list[str]:
    evidence = []

    analysis = payload.get("analysis", {})
    error_count = analysis.get("error_count", 0)
    success_count = analysis.get("success_count", 0)

    if error_count:
        evidence.append(f"Failed or error-like events detected: {error_count}.")
    if success_count:
        evidence.append(f"Successful events detected: {success_count}.")

    top_ips = _top_ips(payload, 3)
    if top_ips:
        evidence.append(f"Repeated IP indicators include: {', '.join(top_ips)}.")

    themes = _top_themes(payload, 3)
    if themes:
        evidence.append(f"Detected themes include: {', '.join(themes)}.")

    repeated_terms = _top_terms(payload, 5)
    if repeated_terms:
        evidence.append(f"Repeated terms include: {', '.join(repeated_terms)}.")

    top_lines = _top_lines(payload, 2)
    for idx, line in enumerate(top_lines, start=1):
        msg = line.get("message", "")
        if msg:
            evidence.append(f"Relevant line {idx}: {msg}")

    if not evidence:
        evidence.append("There is limited evidence in the current parsed result.")

    return evidence


def _build_relevant_terms(payload: dict) -> list[str]:
    items = []
    for item in _explained_terms(payload, 5):
        items.append(f'{item["term"]}: {item["meaning"]}')

    if not items:
        items.append("No glossary terms were detected for this log.")

    return items


def _build_next_steps(payload: dict) -> list[str]:
    steps = []
    themes = _top_themes(payload, 3)
    top_ips = _top_ips(payload, 3)
    repeated_terms = _top_terms(payload, 5)

    if top_ips:
        steps.append(f"Review repeated IPs first: {', '.join(top_ips)}.")
    if "vpn" in themes:
        steps.append("Check VPN destination, tunnel establishment, and authentication-related events.")
    if "certificate" in themes:
        steps.append("Check certificate validation, trust, expiry, and SSL inspection events.")
    if "dns" in themes:
        steps.append("Review DNS resolution failures, timeouts, and repeated domains.")
    if "proxy" in themes:
        steps.append("Check filtering decisions, blocked destinations, and proxy-related traffic.")
    if "camera" in themes:
        steps.append("Review device-related traffic such as RTSP, ONVIF, streams, and repeated internal IPs.")

    if repeated_terms and not steps:
        steps.append(f"Investigate the repeated indicators: {', '.join(repeated_terms[:3])}.")
    if not steps:
        steps.append("Review the most relevant lines and correlate them with related infrastructure or application logs.")

    return steps


def _format_response(assessment: str, summary: str, evidence: list[str], terms: list[str], next_steps: list[str]) -> str:
    return "\n".join(
        [
            "Assessment:",
            f"{summary}",
            "",
            "Evidence from the log:",
            *[f"- {item}" for item in evidence],
            "",
            "Relevant terms:",
            *[f"- {item}" for item in terms],
            "",
            "Recommended next steps:",
            *[f"- {item}" for item in next_steps],
            "",
            "Confidence:",
            assessment,
        ]
    )


def explain_main_issue(payload: dict) -> str:
    assessment, summary = _assessment(payload)
    evidence = _build_evidence(payload)
    terms = _build_relevant_terms(payload)
    next_steps = _build_next_steps(payload)
    return _format_response(assessment, summary, evidence, terms, next_steps)


def suggest_next_checks(payload: dict) -> str:
    assessment, summary = _assessment(payload)
    evidence = _build_evidence(payload)[:4]
    terms = _build_relevant_terms(payload)[:3]
    next_steps = _build_next_steps(payload)
    return _format_response(assessment, summary, evidence, terms, next_steps)


def explain_for_non_technical_user(payload: dict) -> str:
    assessment, summary = _assessment(payload)

    simple_summary = (
        "The system reviewed the uploaded log and tried to identify repeated patterns, unusual activity, and possible problem areas."
    )

    evidence = [
        summary,
        "The tool looked for repeated addresses, repeated keywords, and common technical themes.",
    ]

    top_ips = _top_ips(payload, 2)
    if top_ips:
        evidence.append(f"Some network addresses appeared more than once: {', '.join(top_ips)}.")

    repeated_terms = _top_terms(payload, 3)
    if repeated_terms:
        evidence.append(f"Some repeated indicators were found: {', '.join(repeated_terms)}.")

    terms = ["This explanation is simplified for a non-technical reader."]
    next_steps = [
        "Share the findings with a technical support or IT team member.",
        "Review the repeated addresses, repeated terms, and highlighted lines.",
        "If needed, investigate the related service or destination shown in the log.",
    ]

    return _format_response(assessment, simple_summary, evidence, terms, next_steps)


def write_case_notes(payload: dict) -> str:
    themes = _top_themes(payload, 3)
    ips = _top_ips(payload, 3)
    repeated_terms = _top_terms(payload, 5)

    notes = []
    notes.append("Case Notes:")
    notes.append("- Log was analyzed using automated pattern detection.")
    if themes:
        notes.append(f"- Main detected themes: {', '.join(themes)}.")
    if ips:
        notes.append(f"- Repeated IPs observed: {', '.join(ips)}.")
    if repeated_terms:
        notes.append(f"- Repeated indicators: {', '.join(repeated_terms)}.")

    top_lines = _top_lines(payload, 2)
    for idx, line in enumerate(top_lines, start=1):
        msg = line.get("message", "")
        if msg:
            notes.append(f"- Relevant line {idx}: {msg}")

    notes.append("- Recommended to review highlighted indicators and correlate with related system/application logs.")

    return "\n".join(notes)


def answer_custom_question(question: str, payload: dict) -> str:
    q = question.lower()

    if "non-technical" in q or "simple" in q or "easy" in q:
        return explain_for_non_technical_user(payload)

    if "case note" in q or "ticket" in q or "summary for support" in q:
        return write_case_notes(payload)

    if "next" in q or "check" in q or "what should i do" in q:
        return suggest_next_checks(payload)

    return explain_main_issue(payload)


def interpret_question(question: str, payload: dict) -> str:
    q = question.strip().lower()

    if q == "explain the main issue in this log.":
        return explain_main_issue(payload)

    if q == "suggest the next checks i should perform.":
        return suggest_next_checks(payload)

    if q == "explain this log for a non-technical user.":
        return explain_for_non_technical_user(payload)

    if q == "write short support case notes for this log.":
        return write_case_notes(payload)

    return answer_custom_question(question, payload)