from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import require_role
from app.core.supabase_client import get_supabase
from app.models.schemas import AIGenerateRequest
from app.services.gemini_service import generate_questions

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/generate")
async def generate_ai_questions(
    payload: AIGenerateRequest,
    user: Annotated[dict, Depends(require_role("teacher"))],
):
    supabase = get_supabase()
    quiz_id = payload.quiz_id

    if not quiz_id:
        title = payload.create_quiz_title or f"AI Quiz: {payload.topic}"
        created = (
            supabase.table("quizzes")
            .insert(
                {
                    "title": title,
                    "description": f"AI-generated quiz on {payload.topic}",
                    "subject": payload.subject,
                    "teacher_id": user["id"],
                    "status": "pending_review",
                    "duration_minutes": max(10, payload.question_count * 2),
                }
            )
            .execute()
        )
        if not created.data:
            raise HTTPException(status_code=500, detail="Failed to create quiz")
        quiz_id = created.data[0]["id"]
    else:
        quiz = supabase.table("quizzes").select("teacher_id").eq("id", quiz_id).maybe_single().execute()
        if not quiz.data or quiz.data["teacher_id"] != user["id"]:
            raise HTTPException(status_code=404, detail="Quiz not found")

    try:
        questions = generate_questions(
            topic=payload.topic,
            subject=payload.subject,
            difficulty=payload.difficulty,
            question_count=payload.question_count,
            question_types=payload.question_types,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {exc}") from exc

    if not questions:
        raise HTTPException(status_code=502, detail="AI returned no usable questions")

    rows = [{**q, "quiz_id": quiz_id} for q in questions]
    inserted = supabase.table("questions").insert(rows).execute()
    supabase.table("quizzes").update({"status": "pending_review"}).eq("id", quiz_id).execute()

    return {
        "quiz_id": quiz_id,
        "generated": len(inserted.data or []),
        "questions": inserted.data,
        "message": "Questions generated. Review and approve before publishing.",
    }
