import requests
import json

r = requests.post(
    "http://localhost:8000/ats/analyze",
    json={
        "resume_text": "John Doe Software Engineer Python React",
        "job_description": "Software Development Engineer",
        "company_name": "Test"
    }
)
print("Status:", r.status_code)
print("Response:", r.text[:1000])
