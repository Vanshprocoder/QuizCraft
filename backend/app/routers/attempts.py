
from datetime import datetime, timezone
from typing import Annotated
import random

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import require_role
from app.core.supabase_client import get_supabase
from app.models.schemas import AttemptStartRequest


router = APIRouter(prefix="/attempts", tags=["Attempts"])


@router.post("/start")
async def start_attempt(
    payload: AttemptStartRequest,
    user: Annotated[dict, Depends(require_role("student"))],
):
    supabase = get_supabase()
    access_code = payload.access_code.upper().strip()

    # Find the published quiz.
    quiz_response = (
        supabase.table("quizzes")
        .select("*")
        .eq("access_code", access_code)
        .eq("status", "published")
        .maybe_single()
        .execute()
    )

    quiz = quiz_response.data if quiz_response else None

    if not quiz:
        raise HTTPException(
            status_code=404,
            detail="Invalid access code or quiz not published",
        )

    # Resume an existing in-progress attempt if one exists.
    existing_response = (
        supabase.table("attempts")
        .select("*")
        .eq("quiz_id", quiz["id"])
        .eq("student_id", user["id"])
        .eq("status", "in_progress")
        .maybe_single()
        .execute()
    )

    attempt = existing_response.data if existing_response else None

    if not attempt:
        created_response = (
            supabase.table("attempts")
            .insert(
                {
                    "quiz_id": quiz["id"],
                    "student_id": user["id"],
                    "status": "in_progress",
                    "started_at": datetime.now(
                        timezone.utc
                    ).isoformat(),
                    "answers": {},
                }
            )
            .execute()
        )

        created_data = (
            created_response.data if created_response else None
        )

        if not created_data:
            raise HTTPException(
                status_code=500,
                detail="Could not create test attempt",
            )

        attempt = created_data[0]

    # Fetch approved questions. Never send correct answers to the student.
    questions_response = (
        supabase.table("questions")
        .select(
            "id, question_text, question_type, options, "
            "points, difficulty, topic"
        )
        .eq("quiz_id", quiz["id"])
        .eq("is_approved", True)
        .execute()
    )

    questions = (
        questions_response.data if questions_response else []
    ) or []

    if quiz.get("shuffle_questions"):
        random.shuffle(questions)

    return {
        "attempt": attempt,
        "quiz": {
            "id": quiz["id"],
            "title": quiz["title"],
            "description": quiz.get("description"),
            "duration_minutes": quiz.get("duration_minutes"),
            "show_results_immediately": quiz.get(
                "show_results_immediately", True
            ),
        },
        "questions": questions,
    }


@router.post("/{attempt_id}/submit")
async def submit_attempt(
    attempt_id: str,
    payload: dict,
    user: Annotated[dict, Depends(require_role("student"))],
):
    supabase = get_supabase()

    # Verify ownership and ensure the attempt has not already been submitted.
    attempt_response = (
        supabase.table("attempts")
        .select("*")
        .eq("id", attempt_id)
        .eq("student_id", user["id"])
        .maybe_single()
        .execute()
    )

    attempt = attempt_response.data if attempt_response else None

    if not attempt:
        raise HTTPException(
            status_code=404,
            detail="Attempt not found",
        )

    if attempt.get("status") != "in_progress":
        raise HTTPException(
            status_code=400,
            detail="This attempt has already been submitted",
        )

    # Fetch the quiz questions and correct answers for server-side grading.
    questions_response = (
        supabase.table("questions")
        .select(
            "id, question_text, question_type, correct_answer, "
            "points, is_approved"
        )
        .eq("quiz_id", attempt["quiz_id"])
        .eq("is_approved", True)
        .execute()
    )

    questions = (
        questions_response.data if questions_response else []
    ) or []

    if not questions:
        raise HTTPException(
            status_code=400,
            detail="No approved questions found for this quiz",
        )

    # Accept either {"answers": {"question-id": "answer"}}
    # or {"answers": [{"question_id": "...", "answer": "..."}]}.
    submitted_answers = payload.get("answers", {})

    if isinstance(submitted_answers, dict):
        answers_by_id = {
            str(question_id): answer
            for question_id, answer in submitted_answers.items()
        }
    elif isinstance(submitted_answers, list):
        answers_by_id = {
            str(item["question_id"]): item.get("answer")
            for item in submitted_answers
            if isinstance(item, dict) and item.get("question_id")
        }
    else:
        raise HTTPException(
            status_code=422,
            detail="Answers must be a dictionary or list",
        )

    earned_total = 0.0
    possible_total = 0.0
    answer_rows = []
    saved_answers = {}

    for question in questions:
        question_id = str(question["id"])
        correct_answer = question.get("correct_answer")
        submitted = answers_by_id.get(question_id)
        points = float(question.get("points") or 1)

        # This comparison assumes the submitted answer and correct answer
        # use the same text representation.
        is_correct = (
            submitted is not None
            and correct_answer is not None
            and str(submitted).strip().casefold()
            == str(correct_answer).strip().casefold()
        )

        points_earned = points if is_correct else 0.0

        earned_total += points_earned
        possible_total += points

        answer_text = (
            str(submitted) if submitted is not None else None
        )

        saved_answers[question_id] = answer_text

        answer_rows.append(
            {
                "attempt_id": attempt_id,
                "question_id": question["id"],
                "student_answer": answer_text,
                "correct_answer": (
                    str(correct_answer)
                    if correct_answer is not None
                    else None
                ),
                "is_correct": is_correct,
                "points_earned": points_earned,
                "points_possible": points,
            }
        )

    percentage = (
        round(earned_total / possible_total * 100, 2)
        if possible_total > 0
        else 0.0
    )

    # Clear any answer rows left by an earlier failed submission attempt.
    supabase.table("attempt_answers").delete().eq(
        "attempt_id", attempt_id
    ).execute()

    # Store answers using the real attempt_answers column names.
    if answer_rows:
        supabase.table("attempt_answers").insert(
            answer_rows
        ).execute()

    # Update using the actual attempts table columns.
    updated_response = (
        supabase.table("attempts")
        .update(
            {
                "status": "submitted",
                "submitted_at": datetime.now(
                    timezone.utc
                ).isoformat(),
                "score": earned_total,
                "max_score": possible_total,
                "percentage": percentage,
                "answers": saved_answers,
            }
        )
        .eq("id", attempt_id)
        .eq("student_id", user["id"])
        .eq("status", "in_progress")
        .execute()
    )

    if not updated_response or not updated_response.data:
        raise HTTPException(
            status_code=500,
            detail=(
                "Answers were processed, but the attempt status "
                "could not be confirmed as saved"
            ),
        )

    return {
        "message": "Test submitted successfully",
        "attempt_id": attempt_id,
        "score": earned_total,
        "max_score": possible_total,
        "percentage": percentage,
    }


@router.get("/me")
async def my_attempts(
    user: Annotated[dict, Depends(require_role("student"))],
):
    supabase = get_supabase()

    response = (
        supabase.table("attempts")
        .select("*, quizzes(title, description)")
        .eq("student_id", user["id"])
        .order("started_at", desc=True)
        .execute()
    )

    return {
        "attempts": (response.data if response else []) or []
    }


@router.get("/{attempt_id}")
async def get_attempt(
    attempt_id: str,
    user: Annotated[dict, Depends(require_role("student"))],
):
    supabase = get_supabase()

    response = (
        supabase.table("attempts")
        .select("*, quizzes(title, description)")
        .eq("id", attempt_id)
        .eq("student_id", user["id"])
        .maybe_single()
        .execute()
    )

    attempt = response.data if response else None

    if not attempt:
        raise HTTPException(
            status_code=404,
            detail="Attempt not found",
        )

    answers_response = (
        supabase.table("attempt_answers")
        .select("*")
        .eq("attempt_id", attempt_id)
        .execute()
    )

    answers = (
        answers_response.data if answers_response else []
    ) or []

    # Only reveal correct answers and scores after submission.
    if attempt.get("status") != "submitted":
        answers = [
            {
                "question_id": item.get("question_id"),
                "student_answer": item.get("student_answer"),
            }
            for item in answers
        ]

    return {
        "attempt": attempt,
        "answers": answers,
    }
