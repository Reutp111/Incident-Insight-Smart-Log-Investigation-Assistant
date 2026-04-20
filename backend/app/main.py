from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from app.local_interpreter import interpret_question
from app.ai_interpreter import ask_investigation_ai
from app.parser import parse_log_file
from app.analyzer import analyze_events
from app.reporter import build_summary
from app.investigator import investigate_events
from app.glossary import (
    DEFAULT_GLOSSARY,
    parse_glossary_text,
    merge_glossaries,
    detect_explained_terms,
)

app = FastAPI(title="Incident Insight API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_response(
    source_name: str,
    text: str,
    keyword: str | None,
    glossary_text: str | None,
):
    events = parse_log_file(text)
    analysis = analyze_events(events)
    summary = build_summary(analysis)
    investigation = investigate_events(events, keyword)

    custom_glossary = parse_glossary_text(glossary_text)
    merged_glossary = merge_glossaries(DEFAULT_GLOSSARY, custom_glossary)
    explained_terms_in_log = detect_explained_terms(events, merged_glossary)

    return {
        "filename": source_name,
        "total_events": len(events),
        "analysis": analysis,
        "summary": summary,
        "investigation": investigation,
        "explained_terms_in_log": explained_terms_in_log,
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze_log(
    file: UploadFile = File(...),
    keyword: str | None = Form(None),
    glossary_text: str | None = Form(None),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name")

    content = await file.read()
    text = content.decode("utf-8", errors="ignore")

    return build_response(file.filename, text, keyword, glossary_text)


@app.post("/analyze-text")
async def analyze_text(
    text: str = Form(...),
    keyword: str | None = Form(None),
    source_name: str | None = Form(None),
    glossary_text: str | None = Form(None),
):
    cleaned_text = text.strip()
    if not cleaned_text:
        raise HTTPException(status_code=400, detail="Missing text input")

    display_name = source_name.strip() if source_name and source_name.strip() else "Pasted Log"
    return build_response(display_name, cleaned_text, keyword, glossary_text)
@app.post("/ask-ai")
async def ask_ai(
    question: str = Form(...),
    analysis_payload: str = Form(...),
):
    import json

    cleaned_question = question.strip()
    if not cleaned_question:
        raise HTTPException(status_code=400, detail="Missing question")

    try:
        payload = json.loads(analysis_payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid analysis payload")

    answer = interpret_question(cleaned_question, payload)

    return {
        "question": cleaned_question,
        "answer": answer,
    }