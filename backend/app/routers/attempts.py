from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user, require_role
from app.core.supabase_client import get_supabase
from app.models.schemas import AttemptStartRequest, AttemptSubmitRequest
from app.services.grading_service import grade_attempt

router = APIRouter(prefix="/attempts", tags=["attempts"])


@router.post("/start")
async def start_attempt(
    payload: AttemptStartRequest,
    user: Annotated[dict, Depends(require_role("student"))],
):
    supabase = get_supabase()
    quiz = (
        supabase.table("quizzes")
        .select("*")
        .eq("access_code", payload.access_code.upper().strip())
        .eq("status", "published")
        .maybe_single()
        .execute()
    )
    if not quiz.data:
        raise HTTPException(status_code=404, detail="Invalid access code or quiz not published")

    existing = (
        supabase.table("attempts")
        .select("*")
        .eq("quiz_id", quiz.data["id"])
        .eq("student_id", user["id"])
        .eq("status", "in_progress")
        .maybe_single()
        .execute()
    )
    if existing.data:
        attempt = existing.data
    else:
        created = (
            supabase.table("attempts")
            .insert(
                {
                    "quiz_id": quiz.data["id"],
                    "student_id": user["id"],
                    "status": "in_progress",
                    "started_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .execute()
        )
        attempt = created.data[0]

    questions = (
        supabase.table("questions")
        .select("id, question_text, question_type, options, points, difficulty, topic")
        .eq("quiz_id", quiz.data["id"])
        .eq("is_approved", True)
        .execute()
    )

    q_list = questions.data or []
    if quiz.data.get("shuffle_questions"):
        import random

        random.shuffle(q_list)

    return {
        "attempt": attempt,
        "quiz": {
            "id": quiz.data["id"],
            "title": quiz.data["title"],
            "description": quiz.data.get("description"),
            "duration_minutes": quiz.data["duration_minutes"],
            "show_results_immediately": quiz.data.get("show_results_immediately", True),
        },
        "questions": q_list,
    }


@router.post("/{attempt_id}/submit")
async def submit_attempt(
    attempt_id: str,
    payload: AttemptSubmitRequest,
    user: Annotated[dict, Depends(require_role("student"))],
):
    supabase = get_supabase()
    attempt = supabase.table("attempts").select("*").eq("id", attempt_id).maybe_single().execute()
    if not attempt.data or attempt.data["student_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.data["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Attempt already submitted")

    quiz = supabase.table("quizzes").select("*").eq("id", attempt.data["quiz_id"]).maybe_single().execute()
    if not quiz.data:
        raise HTTPException(status_code=404, detail="Quiz not found")

    started = datetime.fromisoformat(attempt.data["started_at"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    elapsed = int((now - started).total_seconds())
    limit = int(quiz.data["duration_minutes"]) * 60 + 30  # small grace
    if elapsed > limit:
        # Still accept but mark timed out path the same as submit
        pass

    questions = (
        supabase.table("questions")
        .select("*")
        .eq("quiz_id", quiz.data["id"])
        .eq("is_approved", True)
        .execute()
    )
    answer_map = {a.question_id: a.answer for a in payload.answers}
    graded = grade_attempt(questions.data or [], answer_map)

    updated = (
        supabase.table("attempts")
        .update(
            {
                "status": "submitted",
                "submitted_at": now.isoformat(),
                "score": graded["score"],
                "max_score": graded["max_score"],
                "percentage": graded["percentage"],
                "time_spent_seconds": elapsed,
                "answers": answer_map,
            }
        )
        .eq("id", attempt_id)
        .execute()
    )

    detail_rows = [
        {
            "attempt_id": attempt_id,
            **d,
        }
        for d in graded["details"]
    ]
    if detail_rows:
        supabase.table("attempt_answers").insert(detail_rows).execute()

    response: dict[str, Any] = {"attempt": updated.data[0]}
    if quiz.data.get("show_results_immediately", True):
        response["results"] = graded
    return response


@router.get("/me")
async def my_attempts(user: Annotated[dict, Depends(get_current_user)]):
    supabase = get_supabase()
    if user["role"] == "student":
        result = (
            supabase.table("attempts")
            .select("*, quizzes(title, subject, passing_score)")
            .eq("student_id", user["id"])
            .order("started_at", desc=True)
            .execute()
        )
        return result.data or []

    # Teachers: attempts on their quizzes
    quizzes = supabase.table("quizzes").select("id").eq("teacher_id", user["id"]).execute()
    quiz_ids = [q["id"] for q in quizzes.data or []]
    if not quiz_ids:
        return []
    result = (
        supabase.table("attempts")
        .select("*, quizzes(title), profiles:student_id(full_name, email)")
        .in_("quiz_id", quiz_ids)
        .order("started_at", desc=True)
        .execute()
    )
    return result.data or []


@router.get("/{attempt_id}")
async def get_attempt(attempt_id: str, user: Annotated[dict, Depends(get_current_user)]):
    supabase = get_supabase()
    attempt = supabase.table("attempts").select("*").eq("id", attempt_id).maybe_single().execute()
    if not attempt.data:
        raise HTTPException(status_code=404, detail="Attempt not found")

    quiz = supabase.table("quizzes").select("*").eq("id", attempt.data["quiz_id"]).maybe_single().execute()
    if user["role"] == "student" and attempt.data["student_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if user["role"] == "teacher" and (not quiz.data or quiz.data["teacher_id"] != user["id"]):
        raise HTTPException(status_code=403, detail="Forbidden")

    answers = (
        supabase.table("attempt_answers")
        .select("*, questions(question_text, question_type, options, explanation)")
        .eq("attempt_id", attempt_id)
        .execute()
    )
    return {"attempt": attempt.data, "quiz": quiz.data, "answers": answers.data or []}
