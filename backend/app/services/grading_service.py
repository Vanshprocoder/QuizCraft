from typing import Any


def normalize_answer(value: str | None) -> str:
    return (value or "").strip().lower()


def grade_answer(question: dict[str, Any], student_answer: str) -> tuple[bool, float]:
    points = float(question.get("points") or 1)
    correct = normalize_answer(question.get("correct_answer"))
    given = normalize_answer(student_answer)

    q_type = question.get("question_type")
    if q_type in ("mcq", "true_false"):
        is_correct = given == correct
    else:
        # short answer: exact match after normalization; allow minor whitespace differences
        is_correct = given == correct or given.replace(" ", "") == correct.replace(" ", "")

    return is_correct, points if is_correct else 0.0


def grade_attempt(questions: list[dict[str, Any]], answers: dict[str, str]) -> dict[str, Any]:
    details: list[dict[str, Any]] = []
    score = 0.0
    max_score = 0.0

    for q in questions:
        qid = q["id"]
        max_score += float(q.get("points") or 1)
        student_ans = answers.get(qid, "")
        is_correct, earned = grade_answer(q, student_ans)
        score += earned
        details.append(
            {
                "question_id": qid,
                "student_answer": student_ans,
                "correct_answer": q.get("correct_answer"),
                "is_correct": is_correct,
                "points_earned": earned,
                "points_possible": float(q.get("points") or 1),
            }
        )

    percentage = round((score / max_score) * 100, 2) if max_score else 0.0
    return {
        "score": round(score, 2),
        "max_score": round(max_score, 2),
        "percentage": percentage,
        "details": details,
    }
