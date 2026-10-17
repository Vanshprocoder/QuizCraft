import secrets
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.auth import get_current_user, require_role
from app.core.supabase_client import get_supabase
from app.models.schemas import QuizCreate, QuizOut, QuizUpdate, QuestionCreate, QuestionUpdate
from app.services.import_service import parse_quiz_file

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


def _serialize_quiz(row: dict[str, Any], question_count: int | None = None) -> dict[str, Any]:
    data = dict(row)
    if question_count is not None:
        data["question_count"] = question_count
    return data


@router.get("", response_model=list[QuizOut])
async def list_quizzes(user: Annotated[dict, Depends(get_current_user)]):
    supabase = get_supabase()
    if user["role"] == "teacher":
        result = (
            supabase.table("quizzes")
            .select("*")
            .eq("teacher_id", user["id"])
            .order("created_at", desc=True)
            .execute()
        )
    else:
        result = (
            supabase.table("quizzes")
            .select("*")
            .eq("status", "published")
            .order("published_at", desc=True)
            .execute()
        )

    quizzes = result.data or []
    enriched = []
    for q in quizzes:
        count_resp = (
            supabase.table("questions").select("id", count="exact").eq("quiz_id", q["id"]).execute()
        )
        enriched.append(_serialize_quiz(q, count_resp.count or 0))
    return enriched


@router.post("", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
async def create_quiz(
    payload: QuizCreate,
    user: Annotated[dict, Depends(require_role("teacher"))],
):
    supabase = get_supabase()
    row = {
        **payload.model_dump(),
        "teacher_id": user["id"],
        "status": "draft",
    }
    result = supabase.table("quizzes").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create quiz")
    return _serialize_quiz(result.data[0], 0)


@router.get("/{quiz_id}")
async def get_quiz(quiz_id: str, user: Annotated[dict, Depends(get_current_user)]):
    supabase = get_supabase()
    quiz = supabase.table("quizzes").select("*").eq("id", quiz_id).maybe_single().execute()
    if not quiz.data:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if user["role"] == "teacher" and quiz.data["teacher_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your quiz")
    if user["role"] == "student" and quiz.data["status"] != "published":
        raise HTTPException(status_code=403, detail="Quiz is not published")

    questions_query = supabase.table("questions").select("*").eq("quiz_id", quiz_id).order("created_at")
    if user["role"] == "student":
        # Hide answers during assessment fetch via dedicated attempt endpoint; still hide here
        questions_query = questions_query.eq("is_approved", True)
    questions = questions_query.execute()

    data = _serialize_quiz(quiz.data, len(questions.data or []))
    q_list = questions.data or []
    if user["role"] == "student":
        for q in q_list:
            q.pop("correct_answer", None)
            q.pop("explanation", None)
    data["questions"] = q_list
    return data


@router.patch("/{quiz_id}", response_model=QuizOut)
async def update_quiz(
    quiz_id: str,
    payload: QuizUpdate,
    user: Annotated[dict, Depends(require_role("teacher"))],
):
    supabase = get_supabase()
    existing = supabase.table("quizzes").select("*").eq("id", quiz_id).maybe_single().execute()
    if not existing.data or existing.data["teacher_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Quiz not found")

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    result = supabase.table("quizzes").update(updates).eq("id", quiz_id).execute()
    return _serialize_quiz(result.data[0])


@router.post("/{quiz_id}/publish")
async def publish_quiz(quiz_id: str, user: Annotated[dict, Depends(require_role("teacher"))]):
    supabase = get_supabase()
    existing = supabase.table("quizzes").select("*").eq("id", quiz_id).maybe_single().execute()
    if not existing.data or existing.data["teacher_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Quiz not found")

    approved = (
        supabase.table("questions")
        .select("id", count="exact")
        .eq("quiz_id", quiz_id)
        .eq("is_approved", True)
        .execute()
    )
    if not approved.count:
        raise HTTPException(status_code=400, detail="Approve at least one question before publishing")

    access_code = secrets.token_hex(3).upper()
    result = (
        supabase.table("quizzes")
        .update(
            {
                "status": "published",
                "access_code": access_code,
                "published_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", quiz_id)
        .execute()
    )
    return result.data[0]


@router.post("/{quiz_id}/questions", status_code=status.HTTP_201_CREATED)
async def add_question(
    quiz_id: str,
    payload: QuestionCreate,
    user: Annotated[dict, Depends(require_role("teacher"))],
):
    supabase = get_supabase()
    quiz = supabase.table("quizzes").select("id, teacher_id").eq("id", quiz_id).maybe_single().execute()
    if not quiz.data or quiz.data["teacher_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Quiz not found")

    row = {
        **payload.model_dump(),
        "quiz_id": quiz_id,
        "options": [o.model_dump() if hasattr(o, "model_dump") else o for o in payload.options],
        "source": "manual",
        "is_approved": False,
    }
    result = supabase.table("questions").insert(row).execute()
    return result.data[0]


@router.patch("/{quiz_id}/questions/{question_id}")
async def update_question(
    quiz_id: str,
    question_id: str,
    payload: QuestionUpdate,
    user: Annotated[dict, Depends(require_role("teacher"))],
):
    supabase = get_supabase()
    quiz = supabase.table("quizzes").select("teacher_id").eq("id", quiz_id).maybe_single().execute()
    if not quiz.data or quiz.data["teacher_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Quiz not found")

    updates = payload.model_dump(exclude_unset=True)
    if "options" in updates and updates["options"] is not None:
        updates["options"] = [o if isinstance(o, dict) else o for o in updates["options"]]
    result = (
        supabase.table("questions")
        .update(updates)
        .eq("id", question_id)
        .eq("quiz_id", quiz_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Question not found")
    return result.data[0]


@router.post("/{quiz_id}/questions/approve-all")
async def approve_all_questions(quiz_id: str, user: Annotated[dict, Depends(require_role("teacher"))]):
    supabase = get_supabase()
    quiz = supabase.table("quizzes").select("teacher_id").eq("id", quiz_id).maybe_single().execute()
    if not quiz.data or quiz.data["teacher_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Quiz not found")

    result = (
        supabase.table("questions")
        .update({"is_approved": True})
        .eq("quiz_id", quiz_id)
        .execute()
    )
    supabase.table("quizzes").update({"status": "approved"}).eq("id", quiz_id).execute()
    return {"approved": len(result.data or [])}


@router.post("/{quiz_id}/import")
async def import_questions(
    quiz_id: str,
    user: Annotated[dict, Depends(require_role("teacher"))],
    file: UploadFile = File(...),
):
    supabase = get_supabase()
    quiz = supabase.table("quizzes").select("teacher_id").eq("id", quiz_id).maybe_single().execute()
    if not quiz.data or quiz.data["teacher_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Quiz not found")

    content = await file.read()
    try:
        questions = parse_quiz_file(file.filename or "upload.csv", content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    rows = [{**q, "quiz_id": quiz_id} for q in questions]
    result = supabase.table("questions").insert(rows).execute()
    return {"imported": len(result.data or []), "questions": result.data}
