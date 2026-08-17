# ─────────────────────────────────────────────────────────────────
# main.py
# Single Responsibility: FastAPI entrypoint, maps HTTP endpoints
# to review and conductor functions.
# ─────────────────────────────────────────────────────────────────

import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from dotenv import load_dotenv

# Load env variables (GROK_API_KEY, GEMINI_API_KEY)
load_dotenv()

from review import run_code_review
from conductor import run_conductor_step

app = FastAPI(title="OSPAT AI Microservice", version="1.0.0")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Models for Validation ───────────────────────────────

class ReviewRequest(BaseModel):
    problem_title: str
    difficulty: str
    description: str
    constraints: List[str]
    candidate_code: str
    language: str

class ResumeRequest(BaseModel):
    resume_text: str
    model: Optional[str] = "gemini"

class ChatRequest(BaseModel):
    session_id: str
    candidate_message: str
    current_code: str
    language: str
    problem_title: str
    difficulty: str
    phase: Optional[str] = "coding"
    candidate_resume_text: Optional[str] = ""
    job_description: Optional[str] = ""
    qna_count: Optional[int] = 0
    duration_minutes: Optional[int] = 30

class ConductorStateModel(BaseModel):
    session_id: str
    problem_title: str
    difficulty: str
    language: str = "javascript"
    current_code: str = ""
    final_code: str = ""
    hints_given: int = 0
    time_elapsed_minutes: int = 0
    phase: str = "intro"
    last_message: str = ""
    scorecard: Optional[dict] = None
    should_end: bool = False
    candidate_resume_text: str = ""
    job_description: str = ""
    qna_count: int = 0
    duration_minutes: int = 30

class AtsAnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str
    company_name: Optional[str] = ""
    model: Optional[str] = "gemini"

class AtsChatRequest(BaseModel):
    resume_text: str
    job_description: str
    user_message: str
    chat_history: List[dict] = []
    model: Optional[str] = "gemini"

class TtsRequest(BaseModel):
    text: str

# ─── HTTP Endpoints ───────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "AI microservice is running"}

@app.post("/review")
def create_review(req: ReviewRequest):
    try:
        review_data = run_code_review(
            problem_title=req.problem_title,
            difficulty=req.difficulty,
            description=req.description,
            constraints=req.constraints,
            candidate_code=req.candidate_code,
            language=req.language
        )
        return {"review": review_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/conductor/step")
def step_conductor(state: ConductorStateModel):
    try:
        input_dict = state.dict()
        output_dict = run_conductor_step(input_dict)
        return {"state": output_dict}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/conductor/chat")
def chat_conductor(req: ChatRequest):
    try:
        from conductor import ask_grok
        
        if req.phase == "intro":
            from prompts import build_introduction_ack_prompt
            prompt = build_introduction_ack_prompt(
                problem_title=req.problem_title,
                difficulty=req.difficulty,
                candidate_message=req.candidate_message
            )
            reply = ask_grok(prompt)
            return {
                "message": reply,
                "phase": "coding",
                "qna_count": 0
            }
        
        if req.phase == "qna":
            current_qna = req.qna_count or 0
            resume_context = f"\nCandidate's Resume:\n{req.candidate_resume_text}\n" if req.candidate_resume_text else ""
            jd_context = f"\nTarget Job Description:\n{req.job_description}\n" if req.job_description else ""
            
            if current_qna <= 1:
                # Transition from Q1 answer → ask Q2 (resume/project focused)
                new_qna_count = 2
                new_phase = "qna"
                prompt = f"""You are a senior technical interviewer conducting a live interview. The candidate completed their coding solution for "{req.problem_title}".
Final Code:
```{req.language}
{req.current_code}
```
{resume_context}{jd_context}

The candidate just answered your first follow-up question (about their coding approach) with:
"{req.candidate_message}"

Acknowledge their answer thoughtfully — reference something specific they said and offer a brief insight or follow-up thought. Then transition naturally to your SECOND follow-up question (Question 2 of 3).

This question should focus on a specific PROJECT, SKILL, or EXPERIENCE from their resume. For example: "I noticed on your resume you worked on [specific project] — can you tell me about a technical challenge you faced there?" or "You mentioned experience with [technology] — how has that shaped your problem-solving approach?"

Your response should be 4-6 sentences. Sound like a real interviewer having a genuine conversation. Ask a single clear question."""

            elif current_qna == 2:
                # Transition from Q2 answer → ask Q3 (JD scenario focused)
                new_qna_count = 3
                new_phase = "qna"
                prompt = f"""You are a senior technical interviewer conducting a live interview. The candidate completed their coding solution for "{req.problem_title}".
Final Code:
```{req.language}
{req.current_code}
```
{resume_context}{jd_context}

The candidate just answered your second follow-up question (about a resume project/skill) with:
"{req.candidate_message}"

Acknowledge their answer with genuine interest — mention something insightful about what they shared. Then transition to your THIRD and final follow-up question (Question 3 of 3).

This question should be a SCENARIO-BASED question tied to a specific requirement or responsibility from the Job Description. For example: "The role mentions [specific requirement] — can you walk me through how you would approach that?" or "If you were tasked with [scenario from JD], what would your first steps be?"

Your response should be 4-6 sentences. Sound like a real interviewer who is wrapping up the Q&A with a thoughtful final question. Ask a single clear question."""

            else:
                # Q3 answered → transition to wrapup
                new_qna_count = current_qna
                new_phase = "wrapup"
                prompt = f"""You are a senior technical interviewer wrapping up the Q&A portion of a live interview.

The candidate just answered your third and final follow-up question with:
"{req.candidate_message}"

Acknowledge their answer warmly and specifically. Then let them know you've reached the end of the Q&A portion and that you'll now put together their evaluation summary. Thank them for their thoughtful responses throughout the discussion.

Your response should be 3-4 sentences. Sound genuinely appreciative and professional — like a real interviewer who enjoyed the conversation."""

            reply = ask_grok(prompt)
            return {
                "message": reply,
                "phase": new_phase,
                "qna_count": new_qna_count
            }
            
        prompt = f"""You are a senior technical interviewer conducting a live coding interview. The candidate is working on "{req.problem_title}" ({req.difficulty}).
Candidate's current code ({req.language}):
```{req.language}
{req.current_code}
```
The candidate typed this message to you:
"{req.candidate_message}"

Respond to their query as their technical interviewer. Be helpful, supportive, and conversational — speak in 4-6 sentences like a real interviewer would. Offer guidance without revealing the solution. If they're asking a clarifying question, answer it clearly. If they're sharing their thought process, engage with it and provide encouragement or gentle redirection as needed."""
        reply = ask_grok(prompt)
        return {
            "message": reply,
            "phase": "coding",
            "qna_count": 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/resume/summarize")
def summarize_resume(req: ResumeRequest):
    try:
        from conductor import ask_llm
        prompt = f"""You are an expert technical recruiter. Analyze the candidate's resume text below and generate a concise summary (3-4 bullet points) detailing their core technical skills, experience levels, and primary strengths. Keep it professional, objective, and formatting as markdown bullets.

Resume Text:
\"\"\"
{req.resume_text}
\"\"\""""
        summary = ask_llm(prompt, model_provider=req.model)
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ats/analyze")
def analyze_ats(req: AtsAnalyzeRequest):
    try:
        from conductor import ask_llm
        company_info = f" at {req.company_name}" if req.company_name else ""
        prompt = f"""You are an expert ATS (Applicant Tracking System) recruiter scanner. 
Analyze the candidate's resume against the Job Description for a role{company_info}.

Resume Text:
\"\"\"
{req.resume_text}
\"\"\"

Job Description:
\"\"\"
{req.job_description}
\"\"\"

Evaluate the match and return a JSON object with the following fields:
- "score": An integer match percentage between 0 and 100
- "matchedKeywords": List of matching skills/keywords found in both
- "missingKeywords": List of critical skills/requirements from the Job Description that are missing from the resume
- "recommendations": List of 3-5 specific, actionable tips to improve the resume for this job
- "feedback": A brief paragraph summarizing their overall alignment and strengths

Your response MUST be a single raw JSON block, with no additional text or explanations. Do not wrap the JSON in Markdown code fences.
"""
        response_text = ask_llm(prompt, model_provider=req.model)
        clean_text = response_text.replace("```json", "").replace("```", "").strip()
        import json
        result = json.loads(clean_text)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to analyze ATS: {str(e)}")

@app.post("/ats/chat")
def chat_ats(req: AtsChatRequest):
    try:
        from conductor import ask_llm
        
        history_context = ""
        for msg in req.chat_history:
            role = "Candidate" if msg.get("sender") == "candidate" else "AI Recruiter"
            history_context += f"{role}: {msg.get('message')}\n"

        prompt = f"""You are an expert ATS recruitment advisor. You analyzed the user's resume against the target Job Description.
Resume:
\"\"\"
{req.resume_text}
\"\"\"

Job Description:
\"\"\"
{req.job_description}
\"\"\"

Previous Chat History:
{history_context}

User's follow-up message:
"{req.user_message}"

Respond to their query with highly actionable, professional, and supportive advice to optimize their resume. Keep it concise (3-4 sentences max)."""
        reply = ask_llm(prompt, model_provider=req.model)
        return {"message": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to chat ATS: {str(e)}")

@app.post("/tts")
def text_to_speech(req: TtsRequest):
    try:
        from gtts import gTTS
        from fastapi.responses import StreamingResponse
        import io
        
        # Clean text for cleaner voice output (remove markdown tags)
        clean_text = req.text.replace("*", "").replace("`", "").replace("#", "")
        
        # Generate speech in-memory using gTTS
        tts = gTTS(text=clean_text, lang='en', tld='com')
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        
        return StreamingResponse(fp, media_type="audio/mp3")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate speech: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # HF Spaces uses port 7860 by default; local dev uses 8000
    port = int(os.getenv("AI_SERVICE_PORT", os.getenv("PORT", 8000)))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
