# QuizCraft

AI-powered quiz generation and student performance analytics system.

**Stack:** React (Vite) · FastAPI · Supabase (PostgreSQL + Auth) · Google Gemini

## Features

- AI question generation with Gemini (teacher review before publish)
- Manual questions and CSV/Excel import
- Quiz publication with access codes
- Timed student assessments with auto-submit
- Automatic grading for MCQ / true-false / short answer
- Teacher dashboards and performance charts
- Student result history and score trends
- Role-based access (teacher / student)

## Project structure

```
QuizCraft/
├── frontend/          # React + Vite app
├── backend/           # FastAPI API
│   ├── app/
│   ├── sample_data/   # Sample CSV for import
│   └── supabase/      # SQL schema + RLS
└── README.md
```

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run `backend/supabase/schema.sql`.
3. In **Project Settings → API**, copy:
   - Project URL
   - `anon` public key
   - `service_role` key
4. In **Project Settings → API → JWT Settings**, copy the JWT secret (or use the legacy JWT secret).

## 2. Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill `.env`:

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
GEMINI_API_KEY=...
CORS_ORIGINS=http://localhost:5173
```

Run the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: [http://localhost:8000/api/health](http://localhost:8000/api/health)  
Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## 3. Frontend setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Fill `.env`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=http://localhost:8000/api
```

App: [http://localhost:5173](http://localhost:5173)

## Authentication (no email confirmation)

Signup does **not** send confirmation emails. The frontend calls `POST /api/auth/register`, which uses the Supabase **service role** to create a user with `email_confirm: true`, then signs in with password.

That avoids Supabase’s “email rate limit exceeded” during development.

Use a normal-looking email (`you@gmail.com`). Disposable / clearly fake addresses can still be rejected by Supabase as “invalid email”.

If you previously hit the email rate limit from the old signup flow, wait ~1 hour (or try a new email). The new path does not send mail.

Optional dashboard setting (not required for this app): Supabase → Authentication → Providers → Email → disable **Confirm email**.

## Typical teacher → student flow

1. Register as **teacher**, sign in.
2. **AI Generate** a quiz on a topic (or create blank + import `backend/sample_data/sample_questions.csv`).
3. Open the quiz → **Approve all** (or approve per question) → **Publish**.
4. Share the access code with students.
5. Register as **student**, enter the code, complete the timed quiz.
6. View results under student history; class insights under teacher analytics.

## CSV / Excel import format

| Column | Required | Notes |
|--------|----------|--------|
| `question_text` | yes | |
| `correct_answer` | yes | e.g. `A` or short text |
| `question_type` | no | `mcq`, `true_false`, `short_answer` |
| `option_a` … `option_d` | for MCQ | |
| `difficulty`, `points`, `topic`, `explanation` | no | |

## Deployment notes

- Frontend: Vercel / Netlify / Cloudflare Pages (set Vite env vars).
- Backend: Render / Railway / Fly.io (set env vars; allow CORS origin of the frontend).
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` server-side only.

## License

Academic / educational use.
