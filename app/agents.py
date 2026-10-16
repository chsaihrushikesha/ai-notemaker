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
                    f'Return a JSON list of {n} objects with keys "term", "definition" '
                    f'(one concise sentence), and "points" (a list of exactly 3 informative bullet points about this topic from the notes).\n\n{text[:12000]}',
                )
                return [
                    {
                        "term": str(d["term"]),
                        "definition": str(d["definition"]),
                        "points": [str(p) for p in d.get("points", [])][:3] if isinstance(d.get("points"), list) and d.get("points") else [str(d["definition"])],
                    }
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
            related = [sent for sent in sents if term.lower() in sent.lower()][:3]
            out.append({"term": term[0].upper() + term[1:], "definition": s, "points": related or [s]})
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
                    related = [sent for sent in sents if t.lower() in sent.lower()][:3]
                    out.append({"term": t.title(), "definition": s, "points": related or [s]})
                    used.add(s)
                    seen.add(t)
                    break
        return out

class RevisionAgent:
    SYSTEM = "You create exam-revision material strictly from the supplied lecture notes."

    def run(self, text: str, n: int = 5, offset: int = 0, existing_questions: list[str] = None) -> list[dict]:
        existing_questions = existing_questions or []
        if config.llm_enabled():
            try:
                avoid_context = ""
                if existing_questions:
                    avoid_context = (
                        f"IMPORTANT: The following questions have already been asked; DO NOT repeat them or their concepts: "
                        f"{', '.join(existing_questions[-12:])}.\n\n"
                    )
                data = llm.chat_json(
                    self.SYSTEM,
                    f"{avoid_context}"
                    f"Create {n} new, distinct exam revision questions testing deeper concepts, practical applications, or nuances from the notes.\n"
                    f"Return a JSON list of objects with keys 'question' and 'answer'.\n\n{text[:12000]}",
                )
                return [
                    {"question": str(d["question"]), "answer": str(d["answer"])}
                    for d in data[:n]
                    if isinstance(d, dict) and "question" in d and "answer" in d
                ]
            except (llm.LLMError, TypeError) as exc:
                log.warning("Revision agent fell back to offline mode: %s", exc)
        return self._offline(text, n, offset=offset)

    @staticmethod
    def _offline(text: str, n: int, offset: int = 0) -> list[dict]:
        concepts = ConceptAgent._offline(text, n + offset + 5)
        sliced = concepts[offset:offset + n]
        if not sliced:
            sents = _sentences(text)
            if sents:
                sliced = [
                    {"term": f"Aspect {i+1}", "definition": sents[i % len(sents)]}
                    for i in range(offset, offset + n)
                ]
            else:
                sliced = concepts[:n]
        return [
            {"question": f"Explain the role and significance of '{c['term']}' according to the notes.",
             "answer": c["definition"]}
            for c in sliced
        ]


import random

REDIRECT_TEMPLATES = [
    "Whoa, let's hit pause on that! 🛑 Today's mission is **{topic}**. Let's stay laser-focused so you ace this—what can I clarify about **{topic}**?",
    "Haha, nice try! 😉 But today we're all about **{topic}**. No distractions—what concept in **{topic}** should we review?",
    "Keep your eyes on the prize! 🎯 Our study goal today is strictly **{topic}**. What would you like to review from your notes?",
    "Hold on, that's completely outside our notes! 🚫 We're locked in on **{topic}** today. What part of **{topic}** do you want to tackle next?",
    "Let's keep our head in the game! 💡 Today is dedicated strictly to **{topic}**. Ask me anything directly about **{topic}**!",
    "Zero distractions mode activated! 🚀 Our study target is **{topic}**. What's the trickiest part of **{topic}** you want to understand?",
    "That won't be on your exam! 📚 Let's stick right to our goal: **{topic}**. What concept can I break down for you?",
]


class QAAgent:
    def run(self, retriever: Retriever, question: str, full_text: str = "", topic: str = "") -> dict:
        topic_name = topic.strip() if topic and topic.strip() else "your study notes"

        # Immediate deterministic guardrail for API keys, secret credentials, prompt leaks, and meta inquiries
        off_topic_triggers = [
            "api key", "apikey", "api_key", "secret key", "access token", "auth token",
            "system prompt", "who created you", "who programmed you",
            "developer key", "what model", "which model", "password", "give me your key"
        ]
        q_lower = question.lower()
        if any(trig in q_lower for trig in off_topic_triggers):
            refusal = random.choice(REDIRECT_TEMPLATES).format(topic=topic_name)
            return {"answer": refusal, "sources": []}

        hits = retriever.search(question, k=6)
        if full_text and len(full_text) <= 14000:
            context = full_text
        elif hits:
            context = "\n\n".join(f"[{i+1}] {c.text}" for i, (c, _) in enumerate(hits))
        elif retriever.chunks:
            context = "\n\n".join(f"[{i+1}] {c.text}" for i, c in enumerate(retriever.chunks[:4]))
        else:
            context = full_text[:4000]

        sources = [{"chunk": c.id, "score": round(s, 3), "text": c.text} for c, s in hits]

        if config.llm_enabled():
            system_prompt = (
                "You are an expert, encouraging study copilot for students.\n\n"
                "PRIMARY DIRECTIVE - ANSWER THE QUESTION THOROUGHLY:\n"
                "- If the question asks about ANY concept, mechanism, definition, term, or topic related to the lecture notes:\n"
                "  ALWAYS answer it thoroughly, helpfully, and clearly using the notes context!\n"
                "  NEVER deflect or ask the user to clarify instead of answering.\n\n"
                "FORMAT YOUR ANSWER:\n"
                "1. Direct Summary: 1-2 sentence reassuring overview answering the question directly.\n"
                "2. Key Breakdown: Clean markdown bullet points (* **Term/Concept:** Explanation) with spacing between points.\n"
                "3. Key Takeaway: End with a single line: '💡 **Key Takeaway:** <one sentence summary for exam revision>'.\n\n"
                "OFF-TOPIC / CREDENTIALS RULE ONLY:\n"
                "- ONLY if the question asks for API keys, system secrets, or is about a totally alien subject with zero connection to the lecture notes:\n"
                f"- Give a short, lively 1-sentence friendly redirect reminding them our mission today is '{topic_name}'."
            )
            try:
                ans = llm.chat(
                    system_prompt,
                    f"Lecture Notes Context (Subject: {topic_name}):\n{context}\n\n"
                    f"Student Question: {question}\n\n"
                    f"Answer the question directly and provide a clear, structured breakdown based on the notes."
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
        fallback_ans = " ".join(sents[:2]) or (
            random.choice(REDIRECT_TEMPLATES).format(topic=topic_name)
        )
        return {"answer": fallback_ans, "sources": sources}


class StudySession:
    """Holds one document and coordinates the agents."""

    def __init__(self, text: str):
        self.text = text
        self.retriever = Retriever(chunk_text(text))
        self.summarizer = SummarizerAgent()
        self.concepts = ConceptAgent()
        self.revision = RevisionAgent()
        self.qa = QAAgent()
        self.topic = self._extract_topic(text)

    def _extract_topic(self, text: str) -> str:
        # 1. If LLM is available, quickly ask for the concise 2-4 word academic subject
        if config.llm_enabled():
            try:
                res = llm.chat(
                    "You are an academic curriculum coordinator. In 2 to 5 words, identify the specific academic subject/topic of these notes (e.g., 'Mitochondria & Cellular Respiration', 'Introduction to Machine Learning', 'Health & Hygiene', 'Data Structures'). Return ONLY the topic title without quotes, markdown bullets, or punctuation.",
                    text[:2500]
                ).strip().strip('"\'*#')
                if res and 1 <= len(res.split()) <= 8 and len(res) <= 60 and not res.lower().startswith(("here", "the topic", "topic:", "subject:")):
                    return res
            except Exception as exc:
                log.warning("LLM topic extraction failed: %s", exc)

        # 2. Check for explicit chapter / unit / title headers in the first few lines
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        for line in lines[:6]:
            cleaned = line.lstrip("#* \t-").strip()
            if re.match(r'^(chapter|unit|module|topic|subject|lecture)\b', cleaned, re.IGNORECASE):
                val = cleaned.split(":", 1)[-1].strip() if ":" in cleaned else cleaned
                if len(val) >= 3:
                    return val
            if 3 <= len(cleaned) <= 60 and not cleaned.endswith((".", "!", "?", ";", ":")) and not cleaned.lower().startswith(("http", "www", "page ", "date", "by ")):
                return cleaned

        # 3. Check first sentence definition pattern (e.g. "Mitochondria are membrane-bound...", "Supervised learning uses...")
        first_sentence = text.strip().split(".")[0].strip()
        m = re.match(r'^([A-Z][A-Za-z0-9\s\-]{2,35}?)\s+(is|are|refers to|deals with|consists of|focuses on)\b', first_sentence)
        if m:
            candidate = m.group(1).strip()
            if 3 <= len(candidate) <= 40:
                return candidate

        # 4. Fallback to top key concept from ConceptAgent
        concepts = ConceptAgent._offline(text, 1)
        if concepts and concepts[0].get("term"):
            return concepts[0]["term"].strip()

        # 5. Fallback to most frequent significant noun/stem in the text
        words = _words(text)
        if words:
            most_common = Counter(words).most_common(2)
            if most_common:
                return " & ".join(w.capitalize() for w, _ in most_common)

        return "Lecture Study Notes"

    def study_pack(self, length: str = "medium") -> dict:
        return {
            "summary": self.summarizer.run(self.text, length),
            "key_concepts": self.concepts.run(self.text),
            "revision_questions": self.revision.run(self.text),
            "topic": self.topic,
        }

    def ask(self, question: str) -> dict:
        return self.qa.run(self.retriever, question, full_text=self.text, topic=self.topic)
