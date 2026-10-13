"""Specialised agents + an orchestrator.

Each agent has an LLM path and a deterministic offline fallback, so the app
still works (in a simpler form) with no API key or if the LLM call fails.
"""
import logging
import re
from collections import Counter

from . import config, llm
from .rag import Retriever, chunk_text

log = logging.getLogger("AI NoteMaker.agents")

STOP = set(
    "the a an and or of to in is are was were be been for on with as by at from that this "
    "it its which can will not but if then so such into their there these those than also "
    "have has had may more most other some any each used using use one two".split()
)


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [p.strip() for p in parts if len(p.strip().split()) >= 5]


def _stem(w: str) -> str:
    for suf in ("ing", "ed", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: -len(suf)]
    return w


def _words(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-zA-Z][a-zA-Z\-]{2,}", text.lower()) if w not in STOP]


class SummarizerAgent:
    SYSTEM = (
        "You are an expert study assistant. Summarise lecture notes accurately for a "
        "student revising before an exam. Use only the supplied text."
    )

    def run(self, text: str, length: str = "medium") -> str:
        target = {"short": "3-4 bullet points", "medium": "6-8 bullet points",
                  "detailed": "10-14 bullet points grouped under short headings"}[length]
        if config.llm_enabled():
            try:
                parts = [c.text for c in chunk_text(text, size=6000, overlap=0)]
                if len(parts) > 1:  # map-reduce for long documents
                    partial = [
                        llm.chat(self.SYSTEM, f"Summarise this section in 5 bullets:\n\n{p}")
                        for p in parts[:8]
                    ]
                    text = "\n".join(partial)
                return llm.chat(self.SYSTEM, f"Write {target} summarising:\n\n{text}")
            except llm.LLMError as exc:
                log.warning("Summariser fell back to offline mode: %s", exc)
        return self._offline(text, length)

    @staticmethod
    def _offline(text: str, length: str) -> str:
        n = {"short": 3, "medium": 6, "detailed": 12}[length]
        sents = _sentences(text)
        if not sents:
            return "Not enough text to summarise."
        freq = Counter(_words(text))
        scored = []
        for i, s in enumerate(sents):
            ws = _words(s)
            score = sum(freq[w] for w in ws) / (len(ws) + 1)
            scored.append((score, i, s))
        top = sorted(sorted(scored, reverse=True)[:n], key=lambda t: t[1])
        return "\n".join(f"- {s}" for _, _, s in top)


class ConceptAgent:
    SYSTEM = "You extract the key concepts a student must remember from lecture notes."

    def run(self, text: str, n: int = 8) -> list[dict]:
        if config.llm_enabled():
            try:
                data = llm.chat_json(
                    self.SYSTEM,
                    f'Return a JSON list of {n} objects with keys "term" and "definition" '
                    f"(one-sentence definition from the text).\n\n{text[:12000]}",
                )
                return [
                    {"term": str(d["term"]), "definition": str(d["definition"])}
                    for d in data[:n]
                    if isinstance(d, dict) and "term" in d and "definition" in d
                ]
            except (llm.LLMError, TypeError) as exc:
                log.warning("Concept agent fell back to offline mode: %s", exc)
        return self._offline(text, n)

    DEF_RE = re.compile(
        r"^(?:An?|The)?\s*([A-Za-z][A-Za-z\-]*(?: [A-Za-z][A-Za-z\-]*){0,3}?) "
        r"(?:is|are|refers to|measures|predicts|uses|works with|happens when|consists? of|"
        r"groups|compresses|means|describes)\b"
    )

    @staticmethod
    def _offline(text: str, n: int) -> list[dict]:
        sents = _sentences(text)
        out, seen = [], set()
        for s in sents:
            m = ConceptAgent.DEF_RE.match(s)
            if not m:
                continue
            term = m.group(1).strip()
            if term.lower() in STOP or len(term) < 4 or term.lower() in seen:
                continue
            seen.add(term.lower())
            out.append({"term": term[0].upper() + term[1:], "definition": s})
            if len(out) >= n:
                return out
        # Pass 2: most frequent remaining words
        used = {d["definition"] for d in out}
        for t, _ in Counter(_words(text)).most_common(80):
            if len(out) >= n:
                break
            if t in seen:
                continue
            for s in sents:
                if re.search(rf"\b{re.escape(t)}\b", s, re.I) and s not in used:
                    out.append({"term": t.title(), "definition": s})
                    used.add(s)
                    seen.add(t)
                    break
        return out

class RevisionAgent:
    SYSTEM = "You create exam-revision material strictly from the supplied lecture notes."

    def run(self, text: str, n: int = 5) -> list[dict]:
        if config.llm_enabled():
            try:
                data = llm.chat_json(
                    self.SYSTEM,
                    f'Create {n} revision questions. Return a JSON list of objects with keys '
                    f'"question" and "answer".\n\n{text[:12000]}',
                )
                return [
                    {"question": str(d["question"]), "answer": str(d["answer"])}
                    for d in data[:n]
                    if isinstance(d, dict) and "question" in d and "answer" in d
                ]
            except (llm.LLMError, TypeError) as exc:
                log.warning("Revision agent fell back to offline mode: %s", exc)
        return self._offline(text, n)

    @staticmethod
    def _offline(text: str, n: int) -> list[dict]:
        concepts = ConceptAgent._offline(text, n)
        return [
            {"question": f"Explain the concept of '{c['term']}' from the notes.",
             "answer": c["definition"]}
            for c in concepts
        ]


class QAAgent:
    SYSTEM = (
        "Answer the student's question using ONLY the provided context excerpts. "
        "If the answer is not in the context, say you could not find it in the notes."
    )

    def run(self, retriever: Retriever, question: str) -> dict:
        hits = retriever.search(question)
        if not hits:
            return {"answer": "I could not find that in the uploaded notes.", "sources": []}
        context = "\n\n".join(f"[{i+1}] {c.text}" for i, (c, _) in enumerate(hits))
        sources = [{"chunk": c.id, "score": round(s, 3), "text": c.text} for c, s in hits]
        if config.llm_enabled():
            try:
                ans = llm.chat(
                    self.SYSTEM, f"Context:\n{context}\n\nQuestion: {question}\n"
                    "Cite excerpts like [1]."
                )
                return {"answer": ans, "sources": sources}
            except llm.LLMError as exc:
                log.warning("QA agent fell back to offline mode: %s", exc)
        q_stems = {_stem(w) for w in _words(question)}
        pool = [sent for c, _ in hits for sent in _sentences(c.text)]
        pool = list(dict.fromkeys(pool))  # de-duplicate overlapping chunks, keep order

        def score(sent: str) -> float:
            stems = {_stem(w) for w in _words(sent)}
            first = _words(sent)[:1]
            bonus = 0.5 if first and _stem(first[0]) in q_stems else 0.0  # subject match
            return len(q_stems & stems) + bonus

        sents = sorted(pool, key=lambda t: -score(t))
        return {"answer": " ".join(sents[:2]) or hits[0][0].text[:300], "sources": sources}

class StudySession:
    """Holds one document and coordinates the agents."""

    def __init__(self, text: str):
        self.text = text
        self.retriever = Retriever(chunk_text(text))
        self.summarizer = SummarizerAgent()
        self.concepts = ConceptAgent()
        self.revision = RevisionAgent()
        self.qa = QAAgent()

    def study_pack(self, length: str = "medium") -> dict:
        return {
            "summary": self.summarizer.run(self.text, length),
            "key_concepts": self.concepts.run(self.text),
            "revision_questions": self.revision.run(self.text),
        }

    def ask(self, question: str) -> dict:
        return self.qa.run(self.retriever, question)
