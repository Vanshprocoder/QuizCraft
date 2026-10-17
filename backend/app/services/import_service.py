import io
from typing import Any

import pandas as pd


REQUIRED_COLUMNS = {"question_text", "correct_answer"}


def parse_quiz_file(filename: str, content: bytes) -> list[dict[str, Any]]:
    name = filename.lower()
    buffer = io.BytesIO(content)

    if name.endswith(".csv"):
        df = pd.read_csv(buffer)
    elif name.endswith((".xlsx", ".xls")):
        df = pd.read_excel(buffer)
    else:
        raise ValueError("Unsupported file type. Upload CSV or Excel (.xlsx)")

    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    questions: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        question_text = str(row.get("question_text", "")).strip()
        correct_answer = str(row.get("correct_answer", "")).strip()
        if not question_text or not correct_answer or question_text.lower() == "nan":
            continue

        q_type = str(row.get("question_type", "mcq")).strip().lower() or "mcq"
        if q_type not in {"mcq", "true_false", "short_answer"}:
            q_type = "mcq"

        options: list[dict[str, str]] = []
        for key in ("a", "b", "c", "d"):
            col = f"option_{key}"
            alt = key
            value = row.get(col, row.get(alt))
            if pd.notna(value) and str(value).strip():
                options.append({"key": key.upper(), "text": str(value).strip()})

        if q_type == "true_false" and not options:
            options = [{"key": "A", "text": "True"}, {"key": "B", "text": "False"}]

        questions.append(
            {
                "question_text": question_text,
                "question_type": q_type,
                "options": options,
                "correct_answer": correct_answer.upper() if len(correct_answer) == 1 else correct_answer,
                "explanation": None if pd.isna(row.get("explanation")) else str(row.get("explanation")),
                "difficulty": str(row.get("difficulty") or "medium"),
                "points": float(row.get("points") or 1),
                "topic": None if pd.isna(row.get("topic")) else str(row.get("topic")),
                "source": "import",
                "is_approved": False,
            }
        )

    if not questions:
        raise ValueError("No valid questions found in the uploaded file")
    return questions
