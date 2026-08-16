# ─────────────────────────────────────────────────────────────────
# Hugging Face Spaces — OSPAT AI Service
# app.py (entry point HF Spaces expects)
# ─────────────────────────────────────────────────────────────────
# HF Spaces auto-runs this file. We just import and launch main.py's app.
import uvicorn
from main import app  # noqa: F401

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=7860, reload=False)
