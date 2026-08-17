# ─────────────────────────────────────────────────────────────────
# review.py
# Single Responsibility: ONLY handles the code review LLM call.
# Uses Grok (x.ai), Groq (groq.com), or Gemini (fallback) to get structured feedback.
# ─────────────────────────────────────────────────────────────────

import os
import json
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from prompts import CODE_REVIEW_SYSTEM_PROMPT, build_code_review_human_prompt

def run_code_review(
    problem_title: str,
    difficulty: str,
    description: str,
    constraints: list,
    candidate_code: str,
    language: str
) -> dict:
    grok_api_key = os.getenv("GROK_API_KEY")
    gemini_api_key = os.getenv("GEMINI_API_KEY")

    human_prompt = build_code_review_human_prompt(
        problem_title=problem_title,
        difficulty=difficulty,
        description=description,
        constraints=constraints,
        candidate_code=candidate_code,
        language=language
    )

    messages = [
        SystemMessage(content=CODE_REVIEW_SYSTEM_PROMPT),
        HumanMessage(content=human_prompt)
    ]

    raw_text = ""
    success = False

    # 1. Try Grok (x.ai) or Groq depending on the key format
    if grok_api_key:
        try:
            if grok_api_key.startswith("gsk_"):
                # It is a GROQ API key! Use Groq endpoint
                print("[Review] Detected Groq API key (starts with gsk_). Using Groq endpoint...")
                model = ChatOpenAI(
                    api_key=grok_api_key,
                    model="llama-3.3-70b-versatile",
                    openai_api_base="https://api.groq.com/openai/v1",
                    temperature=0.2,
                    max_tokens=1024
                )
            else:
                # Standard Grok API key
                print("[Review] Using standard Grok (x.ai) endpoint...")
                model = ChatOpenAI(
                    api_key=grok_api_key,
                    model="groq/compound",
                    openai_api_base="https://api.groq.com/openai/v1",
                    temperature=0.2,
                    max_tokens=1024
                )
            
            response = model.invoke(messages)
            raw_text = response.content.strip()
            success = True
        except Exception as e:
            print(f"[Review] Grok/Groq call failed: {e}. Falling back to Gemini...")

    # 2. Fallback to Gemini if Grok/Groq failed or key is missing
    if not success and gemini_api_key:
        try:
            print("[Review] Invoking Gemini model for code review...")
            model = ChatGoogleGenerativeAI(
                google_api_key=gemini_api_key,
                model="gemini-2.5-flash",
                temperature=0.2,
                max_output_tokens=1024
            )
            response = model.invoke(messages)
            raw_text = response.content.strip()
            success = True
        except Exception as e:
            print(f"[Review] Gemini fallback call failed: {e}")

    if not success:
        raise ValueError("All review LLM providers failed or API keys are missing.")

    # Strip code fences if the model wraps JSON
    json_text = raw_text.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(json_text)
    except Exception as e:
        print(f"[Review] Failed to parse JSON: {e}. Raw response: {raw_text}")
        return {
            "score": 5,
            "timeComplexity": "Unknown",
            "spaceComplexity": "Unknown",
            "correctness": "Could not analyze automatically.",
            "edgeCasesMissed": [],
            "codeQuality": "Analysis unavailable.",
            "suggestion": "Please review manually.",
            "overallFeedback": raw_text[:300]
        }
