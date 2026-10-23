from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class UserRole(str, Enum):
    teacher = "teacher"
    student = "student"


class QuestionType(str, Enum):
    mcq = "mcq"
    true_false = "true_false"
    short_answer = "short_answer"


class QuizStatus(str, Enum):
    draft = "draft"
    pending_review = "pending_review"
    approved = "approved"
    published = "published"
    archived = "archived"


class QuestionOption(BaseModel):
    key: str
    text: str


class QuestionBase(BaseModel):
    question_text: str
    question_type: QuestionType = QuestionType.mcq
    options: list[QuestionOption] = Field(default_factory=list)
    correct_answer: str
    explanation: Optional[str] = None
    difficulty: str = "medium"
    points: float = 1.0
    topic: Optional[str] = None


class QuestionCreate(QuestionBase):
    pass


class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    question_type: Optional[QuestionType] = None
    options: Optional[list[QuestionOption]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    difficulty: Optional[str] = None
    points: Optional[float] = None
    topic: Optional[str] = None
    is_approved: Optional[bool] = None


class QuestionOut(QuestionBase):
    id: str
    quiz_id: str
    is_approved: bool = False
    source: str = "manual"
    created_at: Optional[datetime] = None


class QuizCreate(BaseModel):
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    duration_minutes: int = 30
    passing_score: float = 40.0
    shuffle_questions: bool = False
    show_results_immediately: bool = True


class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    duration_minutes: Optional[int] = None
    passing_score: Optional[float] = None
    shuffle_questions: Optional[bool] = None
    show_results_immediately: Optional[bool] = None
    status: Optional[QuizStatus] = None


class QuizOut(BaseModel):
    id: str
    teacher_id: str
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    duration_minutes: int
    passing_score: float
    shuffle_questions: bool = False
    show_results_immediately: bool = True
    status: QuizStatus
    access_code: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    question_count: Optional[int] = None


class AIGenerateRequest(BaseModel):
    topic: str
    subject: Optional[str] = None
    difficulty: str = "medium"
    question_count: int = Field(default=5, ge=1, le=30)
    question_types: list[QuestionType] = Field(default_factory=lambda: [QuestionType.mcq])
    quiz_id: Optional[str] = None
    create_quiz_title: Optional[str] = None


class AttemptStartRequest(BaseModel):
    access_code: str


class AnswerSubmission(BaseModel):
    question_id: str
    answer: str


class AttemptSubmitRequest(BaseModel):
    answers: list[AnswerSubmission]


class AttemptOut(BaseModel):
    id: str
    quiz_id: str
    student_id: str
    started_at: datetime
    submitted_at: Optional[datetime] = None
    score: Optional[float] = None
    max_score: Optional[float] = None
    percentage: Optional[float] = None
    status: str
    time_spent_seconds: Optional[int] = None


class AnalyticsSummary(BaseModel):
    total_quizzes: int
    total_attempts: int
    average_score: float
    pass_rate: float
    recent_attempts: list[dict[str, Any]] = Field(default_factory=list)
    score_distribution: list[dict[str, Any]] = Field(default_factory=list)
    topic_performance: list[dict[str, Any]] = Field(default_factory=list)
    student_leaderboard: list[dict[str, Any]] = Field(default_factory=list)


class ProfileOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)
    full_name: str
    role: UserRole = UserRole.student


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1)

