from collections import defaultdict
from typing import Any


def build_teacher_analytics(quizzes: list[dict], attempts: list[dict], profiles: list[dict]) -> dict[str, Any]:
    profile_map = {p["id"]: p for p in profiles}
    total_quizzes = len(quizzes)
    submitted = [a for a in attempts if a.get("status") == "submitted" and a.get("percentage") is not None]
    total_attempts = len(submitted)
    average_score = round(sum(a["percentage"] for a in submitted) / total_attempts, 2) if submitted else 0.0

    quiz_pass = {q["id"]: float(q.get("passing_score") or 40) for q in quizzes}
    passed = sum(1 for a in submitted if a["percentage"] >= quiz_pass.get(a["quiz_id"], 40))
    pass_rate = round((passed / total_attempts) * 100, 2) if total_attempts else 0.0

    buckets = {"0-39": 0, "40-59": 0, "60-79": 0, "80-100": 0}
    for a in submitted:
        p = a["percentage"]
        if p < 40:
            buckets["0-39"] += 1
        elif p < 60:
            buckets["40-59"] += 1
        elif p < 80:
            buckets["60-79"] += 1
        else:
            buckets["80-100"] += 1
    score_distribution = [{"range": k, "count": v} for k, v in buckets.items()]

    student_scores: dict[str, list[float]] = defaultdict(list)
    for a in submitted:
        student_scores[a["student_id"]].append(float(a["percentage"]))

    leaderboard = []
    for sid, scores in student_scores.items():
        profile = profile_map.get(sid, {})
        leaderboard.append(
            {
                "student_id": sid,
                "full_name": profile.get("full_name") or profile.get("email") or sid,
                "attempts": len(scores),
                "average_score": round(sum(scores) / len(scores), 2),
            }
        )
    leaderboard.sort(key=lambda x: x["average_score"], reverse=True)

    recent = sorted(submitted, key=lambda a: a.get("submitted_at") or "", reverse=True)[:10]
    recent_attempts = []
    quiz_title = {q["id"]: q.get("title") for q in quizzes}
    for a in recent:
        profile = profile_map.get(a["student_id"], {})
        recent_attempts.append(
            {
                "attempt_id": a["id"],
                "quiz_title": quiz_title.get(a["quiz_id"], "Quiz"),
                "student_name": profile.get("full_name") or profile.get("email") or a["student_id"],
                "percentage": a["percentage"],
                "submitted_at": a.get("submitted_at"),
            }
        )

    return {
        "total_quizzes": total_quizzes,
        "total_attempts": total_attempts,
        "average_score": average_score,
        "pass_rate": pass_rate,
        "recent_attempts": recent_attempts,
        "score_distribution": score_distribution,
        "topic_performance": [],
        "student_leaderboard": leaderboard[:10],
    }


def build_student_analytics(attempts: list[dict], quizzes: list[dict]) -> dict[str, Any]:
    quiz_map = {q["id"]: q for q in quizzes}
    submitted = [a for a in attempts if a.get("status") == "submitted" and a.get("percentage") is not None]
    average_score = round(sum(a["percentage"] for a in submitted) / len(submitted), 2) if submitted else 0.0
    history = []
    for a in sorted(submitted, key=lambda x: x.get("submitted_at") or "", reverse=True):
        q = quiz_map.get(a["quiz_id"], {})
        history.append(
            {
                "attempt_id": a["id"],
                "quiz_title": q.get("title", "Quiz"),
                "subject": q.get("subject"),
                "percentage": a["percentage"],
                "score": a.get("score"),
                "max_score": a.get("max_score"),
                "submitted_at": a.get("submitted_at"),
                "passed": a["percentage"] >= float(q.get("passing_score") or 40),
            }
        )

    return {
        "total_attempts": len(submitted),
        "average_score": average_score,
        "history": history,
        "score_trend": [
            {"label": h["quiz_title"][:20], "percentage": h["percentage"]} for h in reversed(history[-8:])
        ],
    }
