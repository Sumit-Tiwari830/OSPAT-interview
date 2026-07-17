# ─────────────────────────────────────────────────────────────────
# conductor.py
# Single Responsibility: ONLY defines the LangGraph state machine
# for the AI interview conductor using Gemini.
# ─────────────────────────────────────────────────────────────────

import os
import re
import json
from typing import TypedDict, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, END

from prompts import (
    CONDUCTOR_SYSTEM_PROMPT,
    build_greeting_prompt,
    build_monitor_prompt,
    build_wrap_up_prompt,
    build_scorecard_prompt,
    build_qna_prompt,
)

# State Definition
class ConductorState(TypedDict):
    session_id: str
    problem_title: str
    difficulty: str
    language: str
    current_code: str
    final_code: str
    hints_given: int
    time_elapsed_minutes: int
    phase: str
    last_message: str
    scorecard: Optional[dict]
    should_end: bool
    candidate_resume_text: str
    job_description: str
    qna_count: int
    duration_minutes: int
    introduced: bool

from langchain_openai import ChatOpenAI

# Initialize Gemini Model
def get_gemini_model():
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set.")
    return ChatGoogleGenerativeAI(
        google_api_key=gemini_api_key,
        model="gemini-2.0-flash",
        temperature=0.7,
        max_output_tokens=1024
    )

def ask_gemini(prompt: str) -> str:
    model = get_gemini_model()
    messages = [
        SystemMessage(content=CONDUCTOR_SYSTEM_PROMPT),
        HumanMessage(content=prompt)
    ]
    response = model.invoke(messages)
    return response.content.strip()

# Initialize Grok (Groq) Model
def get_grok_model():
    grok_api_key = os.getenv("GROK_API_KEY")
    if not grok_api_key:
        raise ValueError("GROK_API_KEY environment variable is not set.")
    return ChatOpenAI(
        openai_api_key=grok_api_key,
        openai_api_base="https://api.groq.com/openai/v1",
        model_name="llama-3.3-70b-versatile",
        temperature=0.7,
        max_tokens=1024
    )

def ask_grok(prompt: str) -> str:
    model = get_grok_model()
    messages = [
        SystemMessage(content=CONDUCTOR_SYSTEM_PROMPT),
        HumanMessage(content=prompt)
    ]
    response = model.invoke(messages)
    return response.content.strip()

# Unified ask function
def ask_llm(prompt: str, model_provider: str = "gemini") -> str:
    if model_provider == "grok":
        return ask_grok(prompt)
    return ask_gemini(prompt)

# ─── Graph Nodes ──────────────────────────────────────────────────

def greet_node(state: ConductorState) -> ConductorState:
    prompt = build_greeting_prompt(
        problem_title=state.get("problem_title", ""),
        difficulty=state.get("difficulty", ""),
        candidate_resume_text=state.get("candidate_resume_text", ""),
        job_description=state.get("job_description", ""),
        duration_minutes=state.get("duration_minutes", 30)
    )
    message = ask_grok(prompt)

    new_state = state.copy()
    new_state["last_message"] = message
    new_state["phase"] = "intro"
    return new_state

def monitor_node(state: ConductorState) -> ConductorState:
    if state.get("should_end") or state.get("phase") in ["intro", "wrapup", "done"]:
        return state

    duration = state.get("duration_minutes", 30)
    time_elapsed = state.get("time_elapsed_minutes", 0)

    # Auto-transition to Q&A if time is up
    if time_elapsed >= duration:
        prompt = build_monitor_prompt(
            problem_title=state.get("problem_title", ""),
            current_code=state.get("current_code", ""),
            hints_given=state.get("hints_given", 0),
            time_elapsed_minutes=time_elapsed,
            language=state.get("language", "javascript"),
            candidate_resume_text=state.get("candidate_resume_text", ""),
            job_description=state.get("job_description", ""),
            duration_minutes=duration
        )
        message = ask_grok(prompt)

        new_state = state.copy()
        new_state["last_message"] = message
        new_state["phase"] = "qna"
        new_state["final_code"] = state.get("current_code", "")
        return new_state

    prompt = build_monitor_prompt(
        problem_title=state.get("problem_title", ""),
        current_code=state.get("current_code", ""),
        hints_given=state.get("hints_given", 0),
        time_elapsed_minutes=time_elapsed,
        language=state.get("language", "javascript"),
        candidate_resume_text=state.get("candidate_resume_text", ""),
        job_description=state.get("job_description", ""),
        duration_minutes=duration
    )
    message = ask_grok(prompt)

    # Simple hint counting check
    is_hint = bool(re.search(r"hint|think about|consider|try|what if|remember", message, re.IGNORECASE))
    hints = state.get("hints_given", 0)
    if is_hint:
        hints += 1

    new_state = state.copy()
    new_state["last_message"] = message
    new_state["hints_given"] = hints
    return new_state

def qna_node(state: ConductorState) -> ConductorState:
    prompt = build_qna_prompt(
        problem_title=state.get("problem_title", ""),
        candidate_resume_text=state.get("candidate_resume_text", ""),
        job_description=state.get("job_description", ""),
        final_code=state.get("final_code") or state.get("current_code", ""),
        language=state.get("language", "javascript"),
        qna_count=state.get("qna_count", 0)
    )
    message = ask_grok(prompt)

    new_state = state.copy()
    new_state["last_message"] = message
    new_state["qna_count"] = state.get("qna_count", 0) + 1
    new_state["phase"] = "qna"
    return new_state

def wrapup_node(state: ConductorState) -> ConductorState:
    prompt = build_wrap_up_prompt(
        problem_title=state.get("problem_title", ""),
        final_code=state.get("final_code") or state.get("current_code", ""),
        language=state.get("language", "javascript")
    )
    message = ask_grok(prompt)

    new_state = state.copy()
    new_state["last_message"] = message
    new_state["phase"] = "closing"
    return new_state

def closing_node(state: ConductorState) -> ConductorState:
    """Generate a warm closing message before moving to scorecard generation."""
    closing_prompt = f"""You just finished wrapping up a technical interview with a candidate.
You already thanked them and summarized their performance in the previous message.

Now deliver a brief, warm, human closing — the kind of thing a real interviewer says as they're about to end the call or meeting. This should be 2-3 sentences max.

For example: "It was genuinely great meeting you today. I'll have your detailed evaluation ready shortly, and you should hear back from the team soon. Best of luck with everything — I have a feeling you'll do great."

Be authentic and kind. This is the last thing the candidate hears from you."""

    message = ask_grok(closing_prompt)

    new_state = state.copy()
    new_state["last_message"] = message
    new_state["phase"] = "scorecard"
    return new_state

def scorecard_node(state: ConductorState) -> ConductorState:
    prompt = build_scorecard_prompt(
        problem_title=state.get("problem_title", ""),
        difficulty=state.get("difficulty", ""),
        final_code=state.get("final_code") or state.get("current_code", ""),
        language=state.get("language", "javascript"),
        hints_given=state.get("hints_given", 0),
        candidate_resume_text=state.get("candidate_resume_text", ""),
        job_description=state.get("job_description", "")
    )

    raw = ask_grok(prompt)
    json_text = raw.replace("```json", "").replace("```", "").strip()

    try:
        scorecard = json.loads(json_text)
    except Exception as e:
        print(f"[Conductor] Scorecard JSON parse error: {e}. Raw: {raw}")
        scorecard = {"error": "Could not parse scorecard", "raw": raw[:500]}

    new_state = state.copy()
    new_state["scorecard"] = scorecard
    new_state["phase"] = "done"
    new_state["should_end"] = True
    return new_state

# ─── Router & Graph Compilation ───────────────────────────────────

def route_from_monitor(state: ConductorState):
    if state.get("should_end") or state.get("phase") in ["intro", "done"]:
        return END
    if state.get("phase") == "qna":
        return "qna_node"
    if state.get("phase") == "wrapup":
        return "wrapup_node"
    return "monitor_node"

def build_graph():
    builder = StateGraph(ConductorState)
    builder.add_node("greet_node", greet_node)
    builder.add_node("monitor_node", monitor_node)
    builder.add_node("qna_node", qna_node)
    builder.add_node("wrapup_node", wrapup_node)
    builder.add_node("closing_node", closing_node)
    builder.add_node("scorecard_node", scorecard_node)

    builder.set_entry_point("greet_node")
    builder.add_edge("greet_node", "monitor_node")
    builder.add_conditional_edges(
        "monitor_node",
        route_from_monitor,
        {
            "monitor_node": "monitor_node",
            "qna_node": "qna_node",
            "wrapup_node": "wrapup_node",
            END: END
        }
    )
    builder.add_edge("qna_node", "monitor_node")
    builder.add_edge("wrapup_node", "closing_node")
    builder.add_edge("closing_node", "scorecard_node")
    builder.add_edge("scorecard_node", END)

    return builder.compile()

# Compiled graph singleton
conductor_graph = build_graph()

def run_conductor_step(state: dict) -> dict:
    # Run the graph and return the updated state dict
    return conductor_graph.invoke(state)
