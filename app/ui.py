"""Gradio front-end. Talks to the same agent layer as the FastAPI backend."""
import gradio as gr

from . import config
from .agents import StudySession
from .ingest import load_path

_state: dict[str, StudySession] = {}


def _fmt_concepts(items):
    return "\n".join(f"**{i+1}. {c['term']}** - {c['definition']}" for i, c in enumerate(items)) or "-"


def _fmt_questions(items):
    return "\n\n".join(
        f"**Q{i+1}. {q['question']}**\n\n<details><summary>Show answer</summary>{q['answer']}</details>"
        for i, q in enumerate(items)
    ) or "-"


def analyze(file, pasted, length):
    try:
        if file is not None:
            text = load_path(file if isinstance(file, str) else file.name)
        else:
            text = (pasted or "").strip()
        if len(text.split()) < 20:
            return "Please upload a file or paste at least ~20 words.", "", "", "Not analysed yet."
        sess = StudySession(text)
        _state["current"] = sess
        pack = sess.study_pack(length)
        mode = "LLM mode" if config.llm_enabled() else "Offline mode (no API key set)"
        return (pack["summary"], _fmt_concepts(pack["key_concepts"]),
                _fmt_questions(pack["revision_questions"]),
                f"Done - {len(text.split())} words analysed. [{mode}]")
    except Exception as exc: 
        return "", "", "", f"Error: {exc}"


def ask(question, history):
    sess = _state.get("current")
    if not sess:
        return "Analyse some notes first (Study Pack tab)."
    res = sess.ask(question)
    src = "\n".join(f"- (chunk {s['chunk']}, score {s['score']})" for s in res["sources"])
    return f"{res['answer']}\n\n**Sources**\n{src}" if src else res["answer"]


def build() -> gr.Blocks:
    with gr.Blocks(title="AI NoteMaker") as demo:
        gr.Markdown("# AI NoteMaker\nUpload lecture notes and get a summary, key concepts, "
                    "revision questions - and chat with your notes.")
        with gr.Tab("Study Pack"):
            with gr.Row():
                with gr.Column():
                    f = gr.File(label="Upload PDF / DOCX / TXT / MD",
                                file_types=[".pdf", ".docx", ".txt", ".md"])
                    t = gr.Textbox(label="...or paste notes", lines=8)
                    ln = gr.Radio(["short", "medium", "detailed"], value="medium",
                                  label="Summary length")
                    btn = gr.Button("Analyse notes", variant="primary")
                    status = gr.Markdown("Not analysed yet.")
                with gr.Column():
                    s = gr.Markdown()
                    gr.Markdown("### Key concepts")
                    c = gr.Markdown()
                    gr.Markdown("### Revision questions")
                    q = gr.Markdown()
            btn.click(analyze, [f, t, ln], [s, c, q, status])
        with gr.Tab("Ask your notes"):
            gr.ChatInterface(ask, description="Answers come only from your uploaded notes (RAG).")
    return demo


demo = build()
