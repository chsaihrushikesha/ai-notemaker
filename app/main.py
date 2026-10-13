"""FastAPI backend for AI NoteMaker."""
import uuid

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from . import config
from .agents import StudySession
from .ingest import extract_text

app = FastAPI(title="AI NoteMaker API", version="1.0.0",
              description="AI lecture-notes summarizer and revision assistant")

SESSIONS: dict[str, StudySession] = {}


class TextIn(BaseModel):
    text: str
    length: str = "medium"


class AskIn(BaseModel):
    session_id: str
    question: str


def _get(session_id: str) -> StudySession:
    if session_id not in SESSIONS:
        raise HTTPException(404, "Unknown session_id. Upload or paste notes first.")
    return SESSIONS[session_id]


def _create(text: str, length: str) -> dict:
    if length not in {"short", "medium", "detailed"}:
        raise HTTPException(422, "length must be short, medium or detailed")
    if len(text.split()) < 20:
        raise HTTPException(422, "Please provide at least ~20 words of notes.")
    session = StudySession(text)
    sid = uuid.uuid4().hex[:12]
    SESSIONS[sid] = session
    return {"session_id": sid, "mode": "llm" if config.llm_enabled() else "offline",
            "words": len(text.split()), **session.study_pack(length)}


@app.get("/health")
def health():
    return {"status": "ok", "mode": "llm" if config.llm_enabled() else "offline"}


@app.post("/analyze/text")
def analyze_text(body: TextIn):
    return _create(body.text, body.length)


@app.post("/analyze/file")
async def analyze_file(file: UploadFile = File(...), length: str = Form("medium")):
    data = await file.read()
    if len(data) > config.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File larger than {config.MAX_UPLOAD_MB} MB")
    try:
        text = extract_text(file.filename or "upload.txt", data)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    return _create(text, length)


@app.post("/ask")
def ask(body: AskIn):
    if not body.question.strip():
        raise HTTPException(422, "Question is empty")
    return _get(body.session_id).ask(body.question)
