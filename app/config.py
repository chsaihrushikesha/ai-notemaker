"""Central configuration, read from environment variables (.env supported)."""
import os

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  
    pass


LLM_API_KEY = os.getenv("LLM_API_KEY", "sk-atQL9BAHOu35NyWAQAk0KA")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "60"))

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "900"))      
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "150"))
TOP_K = int(os.getenv("TOP_K", "4"))

API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "8000"))

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "15"))


def llm_enabled() -> bool:
    """True when an API key is configured; otherwise the app uses offline mode."""
    return bool(LLM_API_KEY.strip())
