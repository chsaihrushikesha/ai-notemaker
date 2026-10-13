"""Document ingestion: turn PDF / DOCX / TXT / MD uploads into clean text."""
import io
import re
from pathlib import Path

SUPPORTED = {".pdf", ".docx", ".txt", ".md"}


def clean_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _read_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n\n".join((page.extract_text() or "") for page in reader.pages)


def _read_docx(data: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs)


def extract_text(filename: str, data: bytes) -> str:
    """Extract text from raw file bytes based on the file extension."""
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED:
        raise ValueError(
            f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(SUPPORTED))}"
        )
    if ext == ".pdf":
        text = _read_pdf(data)
    elif ext == ".docx":
        text = _read_docx(data)
    else:
        text = data.decode("utf-8", errors="ignore")
    text = clean_text(text)
    if len(re.findall(r"[A-Za-z]{3,}", text)) < 20:
        raise ValueError(
            "No readable text found in the file (scanned PDFs need OCR first).Apply OCR using ilovepdf.com"
        )
    return text


def load_path(path: str) -> str:
    p = Path(path)
    return extract_text(p.name, p.read_bytes())
