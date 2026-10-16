"""Thin LLM client (OpenAI-compatible chat API) with a graceful offline fallback."""
import json
import logging
import time

from . import config

log = logging.getLogger("AI NoteMaker.llm")


class LLMError(RuntimeError):
    pass


def chat(system: str, user: str, temperature: float = 0.2, max_tokens: int = 2500) -> str:
    """Call the configured chat-completions endpoint and return the text."""
    if not config.llm_enabled():
        raise LLMError("LLM_API_KEY is not set")
    import httpx 

    url = config.LLM_BASE_URL.rstrip("/") + "/chat/completions"
    payload = {
        "model": config.LLM_MODEL,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    headers = {"Authorization": f"Bearer {config.LLM_API_KEY}"}
    for attempt in range(5):
        try:
            r = httpx.post(url, json=payload, headers=headers, timeout=config.LLM_TIMEOUT)
            if r.status_code in (429, 500, 502, 503, 504) and attempt < 4:
                wait = min(float(r.headers.get("retry-after", 0) or 0) or 8 * (attempt + 1), 45)
                log.warning("Rate limited (429); retrying in %.0fs", wait)
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip()
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise LLMError(f"LLM request failed: {exc}") from exc


def chat_json(system: str, user: str, **kw):
    """Ask for JSON and parse it, tolerating ```json fences and wrapping text."""
    import re
    raw = chat(system + "\nRespond with valid JSON only.", user, **kw)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
    m = re.search(r"(\[.*\]|\{.*\})", raw, re.DOTALL)
    if m:
        raw = m.group(1).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMError(f"Model did not return valid JSON: {exc}") from exc
