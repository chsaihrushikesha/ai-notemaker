"""Minimal RAG pipeline: chunk -> TF-IDF index -> cosine-similarity retrieval."""
import re
from dataclasses import dataclass

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from . import config


def _stem(w: str) -> str:
    for suf in ("ing", "ed", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: -len(suf)]
    return w


def analyze(text: str) -> list[str]:
    """Tokenise, drop stop-words, lightly stem, and add bigrams."""
    toks = [_stem(t) for t in re.findall(r"[a-z][a-z\-]+", text.lower())
            if t not in ENGLISH_STOP_WORDS and len(t) > 2]
    return toks + [f"{a} {b}" for a, b in zip(toks, toks[1:])]


@dataclass
class Chunk:
    id: int
    text: str


def chunk_text(text: str, size: int = None, overlap: int = None) -> list[Chunk]:
    """Split text into overlapping chunks, preferring paragraph/sentence boundaries."""
    size = size or config.CHUNK_SIZE
    overlap = config.CHUNK_OVERLAP if overlap is None else overlap
    chunks, start, n = [], 0, len(text)
    while start < n:
        end = min(start + size, n)
        if end < n:
            window = text[start:end]
            cut = max(window.rfind("\n\n"), window.rfind(". "), window.rfind("\n"))
            if cut > size * 0.5:
                end = start + cut + 1
        piece = text[start:end].strip()
        if piece:
            chunks.append(Chunk(len(chunks), piece))
        if end >= n:
            break
        nxt = max(end - overlap, start + 1)
        m = re.search(r"(?<=[.!?])\s+|\n+", text[nxt:end]) or re.search(r"\s+", text[nxt:end])
        start = nxt + m.end() if m else end
    return chunks


class Retriever:
    def __init__(self, chunks: list[Chunk]):
        self.chunks = chunks
        self.vectorizer = TfidfVectorizer(analyzer=analyze)
        self.matrix = self.vectorizer.fit_transform([c.text for c in chunks])

    def search(self, query: str, k: int = None) -> list[tuple[Chunk, float]]:
        k = k or config.TOP_K
        q = self.vectorizer.transform([query])
        scores = cosine_similarity(q, self.matrix).ravel()
        order = scores.argsort()[::-1][:k]
        return [(self.chunks[i], float(scores[i])) for i in order if scores[i] > 0]
