import os
import sys
from pathlib import Path

os.environ["LLM_API_KEY"] = ""  # force offline mode for deterministic tests
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app.agents import StudySession  # noqa: E402
from app.ingest import extract_text  # noqa: E402
from app.main import app  # noqa: E402
from app.rag import chunk_text  # noqa: E402

NOTES = (Path(__file__).parent.parent / "samples" / "sample_notes.txt").read_text()
client = TestClient(app)


def test_chunking_covers_text():
    chunks = chunk_text(NOTES, size=300, overlap=50)
    assert len(chunks) > 3
    assert all(c.text for c in chunks)


def test_extract_txt_and_reject_bad_type():
    assert "Machine learning" in extract_text("a.txt", NOTES.encode())
    try:
        extract_text("a.exe", b"x")
        assert False
    except ValueError:
        pass


def test_study_pack_offline():
    pack = StudySession(NOTES).study_pack("short")
    assert len(pack["summary"].splitlines()) == 3
    assert pack["key_concepts"] and pack["revision_questions"]


def test_rag_retrieval_finds_relevant_chunk():
    ans = StudySession(NOTES).ask("What is overfitting?")
    assert "overfit" in ans["answer"].lower()
    assert ans["sources"]


def test_api_flow():
    assert client.get("/health").json()["status"] == "ok"
    r = client.post("/analyze/text", json={"text": NOTES})
    assert r.status_code == 200
    sid = r.json()["session_id"]
    a = client.post("/ask", json={"session_id": sid, "question": "Define recall"})
    assert a.status_code == 200 and "recall" in a.json()["answer"].lower()
    f = client.post("/analyze/file", files={"file": ("n.txt", NOTES.encode())})
    assert f.status_code == 200


def test_api_errors():
    assert client.post("/analyze/text", json={"text": "too short"}).status_code == 422
    assert client.post("/ask", json={"session_id": "nope", "question": "hi"}).status_code == 404
