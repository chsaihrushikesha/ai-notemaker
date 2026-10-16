"""Run AI NoteMaker. Usage: python run.py [web|api|gradio]  (default: web)

'web' serves the FastAPI backend at /api and the modern interactive Web UI at / on port 8000.
"""
from pathlib import Path
import sys

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import config
from app.main import app as api_app

STATIC_DIR = Path(__file__).resolve().parent / "static"


def make_app() -> FastAPI:
    root = FastAPI(title="AI NoteMaker Pro")
    root.mount("/api", api_app)
    if STATIC_DIR.exists():
        root.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
    return root


if __name__ == "__main__":
    mode = sys.argv[1].lower() if len(sys.argv) > 1 else "web"
    if mode == "api":
        uvicorn.run(api_app, host=config.API_HOST, port=config.API_PORT)
    elif mode == "gradio":
        import gradio as gr
        from app.ui import demo

        root = FastAPI()
        root.mount("/api", api_app)
        app = gr.mount_gradio_app(root, demo, path="/")
        uvicorn.run(app, host=config.API_HOST, port=config.API_PORT)
    else:
        uvicorn.run(make_app(), host=config.API_HOST, port=config.API_PORT)
