from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user, require_role
from app.core.supabase_client import get_supabase
from app.services.analytics_service import build_student_analytics, build_teacher_analytics

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/teacher")
async def teacher_analytics(user: Annotated[dict, Depends(require_role("teacher"))]):
    supabase = get_supabase()
    quizzes = supabase.table("quizzes").select("*").eq("teacher_id", user["id"]).execute()
    quiz_list = quizzes.data or []
    quiz_ids = [q["id"] for q in quiz_list]

    if not quiz_ids:
        return build_teacher_analytics([], [], [])

    attempts = (
        supabase.table("attempts")
        .select("*")
        .in_("quiz_id", quiz_ids)
        .execute()
    )
    attempt_list = attempts.data or []
    student_ids = list({a["student_id"] for a in attempt_list})
    profiles = []
    if student_ids:
        profiles = (
            supabase.table("profiles")
            .select("id, full_name, email")
            .in_("id", student_ids)
            .execute()
            .data
            or []
        )

    return build_teacher_analytics(quiz_list, attempt_list, profiles)


@router.get("/student")
async def student_analytics(user: Annotated[dict, Depends(require_role("student"))]):
    supabase = get_supabase()
    attempts = (
        supabase.table("attempts")
        .select("*")
        .eq("student_id", user["id"])
        .execute()
    )
    attempt_list = attempts.data or []
    quiz_ids = list({a["quiz_id"] for a in attempt_list})
    quizzes = []
    if quiz_ids:
        quizzes = supabase.table("quizzes").select("*").in_("id", quiz_ids).execute().data or []
    return build_student_analytics(attempt_list, quizzes)


@router.get("/quiz/{quiz_id}")
async def quiz_analytics(quiz_id: str, user: Annotated[dict, Depends(get_current_user)]):
    supabase = get_supabase()
    quiz = supabase.table("quizzes").select("*").eq("id", quiz_id).maybe_single().execute()
    if not quiz.data:
        return {"error": "Quiz not found"}

    if user["role"] == "teacher" and quiz.data["teacher_id"] != user["id"]:
        return {"error": "Forbidden"}

    attempts = (
        supabase.table("attempts")
        .select("*")
        .eq("quiz_id", quiz_id)
        .eq("status", "submitted")
        .execute()
    )
    attempt_list = attempts.data or []
    student_ids = list({a["student_id"] for a in attempt_list})
    profiles = []
    if student_ids:
        profiles = (
            supabase.table("profiles").select("id, full_name, email").in_("id", student_ids).execute().data
            or []
        )

    summary = build_teacher_analytics([quiz.data], attempt_list, profiles)

    # Per-question accuracy
    answers = (
        supabase.table("attempt_answers")
        .select("question_id, is_correct")
        .in_("attempt_id", [a["id"] for a in attempt_list] or ["00000000-0000-0000-0000-000000000000"])
        .execute()
    )
    from collections import defaultdict

    stats: dict[str, dict] = defaultdict(lambda: {"correct": 0, "total": 0})
    for row in answers.data or []:
        stats[row["question_id"]]["total"] += 1
        if row["is_correct"]:
            stats[row["question_id"]]["correct"] += 1

    questions = supabase.table("questions").select("id, question_text, topic").eq("quiz_id", quiz_id).execute()
    question_stats = []
    for q in questions.data or []:
        s = stats[q["id"]]
        accuracy = round((s["correct"] / s["total"]) * 100, 2) if s["total"] else 0
        question_stats.append(
            {
                "question_id": q["id"],
                "question_text": q["question_text"],
                "topic": q.get("topic"),
                "accuracy": accuracy,
                "attempts": s["total"],
            }
        )

    summary["question_stats"] = question_stats
    summary["quiz"] = quiz.data
    return summary
