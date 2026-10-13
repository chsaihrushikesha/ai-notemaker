# AI NoteMaker - AI Lecture Notes Summarizer & Revision Assistant

> Capstone project built with **Nexus AI** concepts: LLMs, Prompt Engineering, RAG, AI Agents, FastAPI and Gradio.

## 1. Problem Statement

Students spend significant time reading lengthy lecture notes and documents to identify the key concepts, summaries, and important points they need for revision.

## 2. Project Overview

AI NoteMaker turns long lecture notes (PDF, DOCX, TXT, MD or pasted text) into a ready-to-revise **study pack** in seconds:

1. a concise summary (short / medium / detailed),
2. a list of key concepts with one-line definitions,
3. revision questions with answers, and
4. a chat interface that answers questions **only from the uploaded notes** (RAG), with the source passages shown.

A small team of specialised agents does the work, coordinated by a `StudySession` orchestrator:

```
                +--------------------+
 PDF/DOCX/TXT ->|  Ingestion         |-> clean text
                +--------------------+
                          |
                          v
                +--------------------+        +---------------------------+
                |  StudySession      |------->| Summarizer Agent          |
                |  (orchestrator)    |------->| Key-Concept Agent         |
                |                    |------->| Revision (Q&A) Agent      |
                |                    |------->| RAG Question-Answer Agent |
                +--------------------+        +---------------------------+
                          |                              |
                 chunk + TF-IDF index              LLM (OpenAI-compatible)
                  (retrieve top-k)                or offline fallback mode
                          |
              +-----------+-----------+
              |                       |
        FastAPI backend          Gradio web UI
```

## 3. Key Features

- **Multi-format upload** - PDF, DOCX, TXT, Markdown, or paste text.
- **Adjustable summaries** - short, medium or detailed; long documents use a map-reduce summarisation strategy.
- **Key concepts extraction** - term + definition pairs taken from the notes.
- **Auto-generated revision questions** with hidden answers (click to reveal).
- **Chat with your notes (RAG)** - answers grounded in retrieved chunks, with source chunks and similarity scores shown; says "not found" instead of guessing.
- **Works with or without an API key** - every agent has an offline fallback (extractive summary, pattern-based concepts, TF-IDF Q&A), and also falls back automatically if an LLM call fails.
- **REST API** with interactive Swagger docs, plus a Gradio UI.
- **Input validation & friendly errors** - unsupported file types, empty/scanned PDFs, oversized files, unknown sessions.

## 4. Technologies Used

| Area | Technology |
|---|---|
| Language | Python 3.10+ |
| LLM access | Any OpenAI-compatible chat API (configure Nexus AI / OpenAI / Groq / Ollama via env vars) |
| Prompt engineering | Role-based system prompts, grounded-answer constraints, JSON-only output prompts, map-reduce summarisation |
| RAG | Overlapping sentence-aware chunking, stemmed TF-IDF (scikit-learn), cosine-similarity retrieval |
| Agents | Summarizer, Key-Concept, Revision and QA agents + `StudySession` orchestrator |
| Backend | FastAPI, Uvicorn, Pydantic |
| Frontend | Gradio |
| Document parsing | pypdf, python-docx |
| Testing | pytest, FastAPI TestClient |

## 5. Setup and Installation

```bash
git clone <your-repo-url>
cd AI NoteMaker

python -m venv .venv
source .venv/bin/activate        

pip install -r requirements.txt
```

### Configure the LLM (optional)

```bash
cp .env.example .env             
```

Edit `.env`:

```
LLM_API_KEY=your-key
LLM_BASE_URL=https://<your-openai-compatible-endpoint>/v1   # e.g. the Nexus AI endpoint
LLM_MODEL=<model-name>
```

If `LLM_API_KEY` is left empty, the app runs in **offline mode** (no external calls, simpler but fully functional output).

## 6. How to Run the Application

```bash
python run.py            
python run.py ui         
python run.py api        
```

When running `python run.py`:

- Web UI: **http://127.0.0.1:8000/**
- API docs (Swagger): **http://127.0.0.1:8000/api/docs**

**Using the UI:** open the *Study Pack* tab -> upload a file (try `samples/sample_notes.txt`) or paste notes -> choose summary length -> **Analyse notes**. Then open *Ask your notes* and ask questions such as "What is overfitting?".

### API quick reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Status and mode (`llm` / `offline`) |
| POST | `/api/analyze/text` | JSON `{"text": "...", "length": "short\|medium\|detailed"}` -> study pack + `session_id` |
| POST | `/api/analyze/file` | Multipart upload (`file`, optional `length`) -> study pack + `session_id` |
| POST | `/api/ask` | JSON `{"session_id": "...", "question": "..."}` -> answer + sources |

```bash
curl -X POST http://127.0.0.1:8000/api/analyze/text \
  -H "Content-Type: application/json" \
  -d '{"text": "<paste at least 20 words of notes>", "length": "short"}'
```

### Run the tests

```bash
pytest -q
```

## 7. Screenshots and Demo Video

> Add your own captures to `docs/screenshots/` and your video link below before submitting.

| Study pack | Chat with notes |
|---|---|
| ![Study pack](docs/screenshots/study_pack.png) | ![Chat](docs/screenshots/chat.png) |

**Demo video (2-5 min):** `<paste YouTube / Google Drive link here>`

## 8. Project Structure

```
AI NoteMaker/
├── app/
│   ├── agents.py     # Summarizer, Concept, Revision, QA agents + orchestrator
│   ├── rag.py        # chunking + TF-IDF retriever
│   ├── ingest.py     # PDF / DOCX / TXT extraction
│   ├── llm.py        # OpenAI-compatible client
│   ├── main.py       # FastAPI backend
│   ├── ui.py         # Gradio interface
│   └── config.py     # environment configuration
├── samples/sample_notes.txt
├── tests/test_app.py
├── docs/DEMO_SCRIPT.md
├── run.py
├── requirements.txt
└── .env.example
```

## 9. Limitations and Future Work

- Scanned (image-only) PDFs need OCR; a multimodal/vision step is a natural extension.
- Sessions are stored in memory and reset when the server restarts.
- Retrieval is keyword-based TF-IDF; swapping in embedding-based vector search would improve semantic matching.
- Planned: export study packs to PDF/Anki, multi-document sessions.