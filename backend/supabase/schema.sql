-- QuizCraft Supabase schema
-- Run in Supabase SQL Editor

create extension if not exists "pgcrypto";

create type public.user_role as enum ('teacher', 'student');
create type public.quiz_status as enum ('draft', 'pending_review', 'approved', 'published', 'archived');
create type public.question_type as enum ('mcq', 'true_false', 'short_answer');
create type public.attempt_status as enum ('in_progress', 'submitted', 'expired');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  subject text,
  duration_minutes integer not null default 30,
  passing_score numeric not null default 40,
  shuffle_questions boolean not null default false,
  show_results_immediately boolean not null default true,
  status public.quiz_status not null default 'draft',
  access_code text unique,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_text text not null,
  question_type public.question_type not null default 'mcq',
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text,
  difficulty text not null default 'medium',
  points numeric not null default 1,
  topic text,
  source text not null default 'manual',
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric,
  max_score numeric,
  percentage numeric,
  time_spent_seconds integer,
  answers jsonb default '{}'::jsonb
);

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  student_answer text,
  correct_answer text,
  is_correct boolean not null default false,
  points_earned numeric not null default 0,
  points_possible numeric not null default 1
);

create index if not exists idx_quizzes_teacher on public.quizzes(teacher_id);
create index if not exists idx_quizzes_access_code on public.quizzes(access_code);
create index if not exists idx_questions_quiz on public.questions(quiz_id);
create index if not exists idx_attempts_student on public.attempts(student_id);
create index if not exists idx_attempts_quiz on public.attempts(quiz_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'student')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;

-- Profiles policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Teachers can view student profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

-- Quizzes policies
create policy "Teachers manage own quizzes" on public.quizzes
  for all using (teacher_id = auth.uid());
create policy "Students view published quizzes" on public.quizzes
  for select using (status = 'published');

-- Questions policies
create policy "Teachers manage questions on own quizzes" on public.questions
  for all using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id and q.teacher_id = auth.uid()
    )
  );
create policy "Students view approved questions on published quizzes" on public.questions
  for select using (
    is_approved = true and exists (
      select 1 from public.quizzes q
      where q.id = quiz_id and q.status = 'published'
    )
  );

-- Attempts policies
create policy "Students manage own attempts" on public.attempts
  for all using (student_id = auth.uid());
create policy "Teachers view attempts on own quizzes" on public.attempts
  for select using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id and q.teacher_id = auth.uid()
    )
  );

create policy "Students view own attempt answers" on public.attempt_answers
  for select using (
    exists (
      select 1 from public.attempts a
      where a.id = attempt_id and a.student_id = auth.uid()
    )
  );
create policy "Teachers view attempt answers for own quizzes" on public.attempt_answers
  for select using (
    exists (
      select 1 from public.attempts a
      join public.quizzes q on q.id = a.quiz_id
      where a.id = attempt_id and q.teacher_id = auth.uid()
    )
  );
