# Demo video script (target: ~3 minutes)

Record with any screen recorder (OBS, Windows Game Bar `Win+G`, Loom). Upload to YouTube (unlisted) or Google Drive (anyone-with-link) and paste the link in README section 7.

**0:00 - Intro (20s)** Name, team, problem statement: students waste time reading long notes to find what to revise.

**0:20 - Architecture (30s)** Show the diagram in the README: ingestion -> orchestrator -> 4 agents -> LLM/RAG -> FastAPI + Gradio.

**0:50 - Study pack (60s)** Run `python run.py`, open http://127.0.0.1:8000. Upload `samples/sample_notes.txt`, pick "medium", click *Analyse notes*. Point out the summary, key concepts, and click a revision answer to reveal it.

**1:50 - Chat with notes / RAG (45s)** Open *Ask your notes*. Ask "What is overfitting?" and "How are neural networks trained?" and show the sources. Ask something unrelated ("Who won the world cup?") to show it says it cannot find it in the notes.

**2:35 - API (20s)** Open http://127.0.0.1:8000/api/docs, run `POST /analyze/text` once.

**2:55 - Wrap-up (15s)** Mention offline fallback, tests, and future work (OCR, vector search).

Take the two README screenshots from steps 3 and 4: save as `docs/screenshots/study_pack.png` and `docs/screenshots/chat.png`.
