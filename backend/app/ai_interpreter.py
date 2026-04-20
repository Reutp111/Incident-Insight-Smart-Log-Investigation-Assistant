import json
from openai import OpenAI

SYSTEM_PROMPT = """
You are an AI investigation interpreter for technical support teams.

Your role:
- Explain findings only from the provided analysis payload
- Do not invent facts that are not supported by the payload
- If evidence is insufficient, say so clearly
- Be practical and helpful
- Explain glossary terms when relevant
- Keep answers structured and easy to read

Always answer in this format:

Assessment:
<short answer>

Evidence from the log:
- ...
- ...

Relevant terms:
- ...
- ...

Recommended next steps:
- ...
- ...

Confidence:
<High / Medium / Low>
""".strip()


def get_client() -> OpenAI:
    return OpenAI()


def build_user_prompt(question: str, payload: dict) -> str:
    compact_payload = {
        "filename": payload.get("filename"),
        "summary": payload.get("summary"),
        "investigation": payload.get("investigation"),
        "explained_terms_in_log": payload.get("explained_terms_in_log", []),
        "analysis": {
            "total_events": payload.get("analysis", {}).get("total_events"),
            "error_count": payload.get("analysis", {}).get("error_count"),
            "success_count": payload.get("analysis", {}).get("success_count"),
            "top_errors": payload.get("analysis", {}).get("top_errors", [])[:5],
            "top_ips": payload.get("analysis", {}).get("top_ips", [])[:5],
            "suspicious_ips": payload.get("analysis", {}).get("suspicious_ips", []),
        },
    }

    return f"""
User question:
{question}

Analysis payload:
{json.dumps(compact_payload, ensure_ascii=False, indent=2)}
""".strip()


def ask_investigation_ai(question: str, payload: dict) -> str:
    client = get_client()

    response = client.responses.create(
        model="gpt-5.4",
        input=[
            {
                "role": "system",
                "content": [{"type": "input_text", "text": SYSTEM_PROMPT}],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": build_user_prompt(question, payload)}],
            },
        ],
    )

    return response.output_text.strip()