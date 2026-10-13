"""Run AI NoteMaker. Usage: python run.py [ui|api|both]  (default: both)

'both' serves the FastAPI backend at /api (docs at /api/docs) and the Gradio UI at / on one port.
"""
import sys

import gradio as gr
import uvicorn
from fastapi import FastAPI

from app import config
from app.main import app as api_app
from app.ui import demo


def make_app() -> FastAPI:
    root = FastAPI()
    root.mount("/api", api_app)
    return gr.mount_gradio_app(root, demo, path="/")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "both"
    if mode == "api":
        uvicorn.run(api_app, host=config.API_HOST, port=config.API_PORT)
    elif mode == "ui":
        demo.launch(server_name=config.API_HOST, server_port=7860)
    else:
        uvicorn.run(make_app(), host=config.API_HOST, port=config.API_PORT)
