from typing import Dict, List


DEFAULT_GLOSSARY = {
    "חסום": "The action was blocked by policy or security logic.",
    "מאופשר": "The action was allowed.",
    "monitor": "Traffic was observed or monitored, but not necessarily blocked.",
    "parse": "A parsing or processing event, not necessarily a block decision.",
    "ssl_cert": "An event related to SSL certificate inspection or validation.",
    "ipport_ssl": "SSL-related traffic identified by IP address and port.",
    "http_request_general": "A general web request event.",
    "http_monitor_response": "A monitored HTTP/HTTPS response event.",
}


def parse_glossary_text(glossary_text: str | None) -> Dict[str, str]:
    """
    Accepts lines in formats like:
    term = explanation
    term: explanation
    """
    if not glossary_text:
        return {}

    glossary: Dict[str, str] = {}

    for raw_line in glossary_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if "=" in line:
            term, meaning = line.split("=", 1)
        elif ":" in line:
            term, meaning = line.split(":", 1)
        else:
            continue

        term = term.strip()
        meaning = meaning.strip()

        if term and meaning:
            glossary[term] = meaning

    return glossary


def merge_glossaries(default_glossary: Dict[str, str], custom_glossary: Dict[str, str]) -> Dict[str, str]:
    merged = dict(default_glossary)
    merged.update(custom_glossary)
    return merged


def detect_explained_terms(events: list[dict], glossary: Dict[str, str]) -> List[dict]:
    """
    Returns only glossary terms that actually appear in the current log/events.
    """
    if not events or not glossary:
        return []

    searchable_text_parts = []

    for event in events:
        searchable_text_parts.append(str(event.get("message", "")))
        searchable_text_parts.append(str(event.get("service", "")))
        searchable_text_parts.append(str(event.get("raw", "")))

        extra_fields = event.get("extra_fields", {})
        if isinstance(extra_fields, dict):
            searchable_text_parts.extend(str(value) for value in extra_fields.values() if value is not None)

    searchable_text = "\n".join(searchable_text_parts).lower()

    found_terms = []
    seen = set()

    for term, meaning in glossary.items():
        if term.lower() in searchable_text and term not in seen:
            found_terms.append(
                {
                    "term": term,
                    "meaning": meaning,
                }
            )
            seen.add(term)

    return found_terms