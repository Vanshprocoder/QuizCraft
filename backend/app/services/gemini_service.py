import json
import re
from typing import Any

import google.generativeai as genai

from app.core.config import get_settings
from app.models.schemas import QuestionType


def _configure() -> None:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    genai.configure(api_key=settings.gemini_api_key)


def _extract_json(text: str) -> Any:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            return json.loads(match.group(1).strip())
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


def generate_questions(
    topic: str,
    subject: str | None,
    difficulty: str,
    question_count: int,
    question_types: list[QuestionType],
) -> list[dict[str, Any]]:
    _configure()
    types_str = ", ".join(t.value for t in question_types)
    subject_part = f" in the subject '{subject}'" if subject else ""

    prompt = f"""
You are an expert assessment designer. Generate exactly {question_count} quiz questions
about "{topic}"{subject_part}.

Constraints:
- Difficulty: {difficulty}
- Allowed question types: {types_str}
- Prefer clear, unambiguous wording suitable for secondary/college students
- For mcq: provide exactly 4 options with keys A, B, C, D and one correct_answer key
- For true_false: options A=True, B=False and correct_answer A or B
- For short_answer: options can be empty; correct_answer is a concise expected answer
- Include a brief explanation and a topic tag

Return ONLY a JSON array with this shape:
[
  {{
    "question_text": "...",
    "question_type": "mcq|true_false|short_answer",
    "options": [{{"key":"A","text":"..."}}, ...],
    "correct_answer": "A",
    "explanation": "...",
    "difficulty": "{difficulty}",
    "points": 1,
    "topic": "{topic}"
  }}
]
"""

    model = genai.GenerativeModel("gemini-3.8-flash")
    response = model.generate_content(prompt)
    raw = response.text or "[]"
    data = _extract_json(raw)
    if not isinstance(data, list):
        raise ValueError("Gemini did not return a question list")

    normalized: list[dict[str, Any]] = []
    for item in data[:question_count]:
        q_type = item.get("question_type", "mcq")
        if q_type not in {t.value for t in QuestionType}:
            q_type = "mcq"
        options = item.get("options") or []
        if q_type == "true_false" and not options:
            options = [{"key": "A", "text": "True"}, {"key": "B", "text": "False"}]
        normalized.append(
            {
                "question_text": str(item.get("question_text", "")).strip(),
                "question_type": q_type,
                "options": options,
                "correct_answer": str(item.get("correct_answer", "")).strip(),
                "explanation": item.get("explanation"),
                "difficulty": item.get("difficulty") or difficulty,
                "points": float(item.get("points") or 1),
                "topic": item.get("topic") or topic,
                "source": "ai",
                "is_approved": False,
            }
        )
    return [q for q in normalized if q["question_text"] and q["correct_answer"]]
