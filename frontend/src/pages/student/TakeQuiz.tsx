import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/api'

type Option = { key: string; text: string }
type Question = {
  id: string
  question_text: string
  question_type: string
  options: Option[]
  points: number
}

type AttemptPayload = {
  attempt: { id: string; started_at: string }
  quiz: { title: string; duration_minutes: number; show_results_immediately: boolean }
  questions: Question[]
}

export default function TakeQuiz() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const [payload, setPayload] = useState<AttemptPayload | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ percentage: number; score: number; max_score: number } | null>(null)

  useEffect(() => {
    if (!attemptId) return
    const raw = sessionStorage.getItem(`attempt:${attemptId}`)
    if (!raw) {
      setError('Attempt session not found. Join again with the access code.')
      return
    }
    const data = JSON.parse(raw) as AttemptPayload
    setPayload(data)
    const started = new Date(data.attempt.started_at).getTime()
    const limitMs = data.quiz.duration_minutes * 60 * 1000
    const remaining = Math.max(0, Math.floor((started + limitMs - Date.now()) / 1000))
    setSecondsLeft(remaining)
  }, [attemptId])

  useEffect(() => {
    if (!payload || result) return
    if (secondsLeft <= 0) {
      void submit(true)
      return
    }
    const id = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, payload, result])

  const clock = useMemo(() => {
    const m = Math.floor(secondsLeft / 60)
    const s = secondsLeft % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }, [secondsLeft])



async function submit(auto = false) {
  if (!attemptId || busy || result) return

  setBusy(true)
  setError('')

  try {
    const body = {
      answers: Object.entries(answers).map(
        ([question_id, answer]) => ({
          question_id,
          answer,
        })
      ),
    }

    const { data } = await api.post(
      `/attempts/${attemptId}/submit`,
      body
    )

    // Handle the backend response safely
    setResult({
      percentage: Number(
        data.percentage ??
          data.results?.percentage ??
          data.attempt?.percentage ??
          0
      ),
      score: Number(
        data.score ??
          data.results?.score ??
          data.attempt?.score ??
          0
      ),
      max_score: Number(
        data.max_score ??
          data.results?.max_score ??
          data.attempt?.max_score ??
          0
      ),
    })

    // Clear the saved attempt after successful submission
    sessionStorage.removeItem(`attempt:${attemptId}`)

    if (!auto) {
      // Results will be displayed on the current page
    }
  } catch (err: unknown) {
    const error = err as {
      response?: {
        data?: {
          detail?: string
          message?: string
        }
      }
      message?: string
    }

    setError(
      error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        'Submit failed. Please try again.'
    )
  } finally {
    setBusy(false)
  }
}


  if (error && !payload) {
    return (
      <div className="panel">
        <p className="error">{error}</p>
        <button className="btn" type="button" onClick={() => navigate('/student/join')}>
          Join again
        </button>
      </div>
    )
  }

  if (!payload) return <p className="muted">Loading assessment…</p>

  if (result) {
    return (
      <div className="panel" style={{ maxWidth: 560 }}>
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Submitted</h1>
        <p className="muted">{payload.quiz.title}</p>
        <div className="stat" style={{ margin: '1rem 0' }}>
          <div className="label">Score</div>
          <div className="value">
            {result.score}/{result.max_score} ({result.percentage}%)
          </div>
        </div>
        <button className="btn" type="button" onClick={() => navigate('/student/history')}>
          View history
        </button>
      </div>
    )
  }

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>{payload.quiz.title}</h1>
        <p>Answer all questions before time runs out. Auto-submit triggers at 0:00.</p>
        <div className="cta-row">
          <span className="timer">Time left {clock}</span>
          {/* <button className="btn" type="button" disabled={busy} onClick={() => submit(false)}>
            {busy ? 'Submitting…' : 'Submit quiz'}
          </button> */}
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      {(payload.questions || []).map((q, idx) => (
        <div className="question-card" key={q.id}>
          <strong>
            {idx + 1}. {q.question_text}
          </strong>
          <div className="muted">{q.points} pts</div>
          {q.question_type === 'short_answer' ? (
            <input
              style={{ marginTop: '0.75rem', width: '100%', padding: '0.7rem', borderRadius: 12, border: '1px solid var(--line)' }}
              value={answers[q.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              placeholder="Your answer"
            />
          ) : (
            <div className="options">
              {(q.options || []).map((o) => (
                <label
                  key={o.key}
                  className={`option ${answers[q.id] === o.key ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === o.key}
                    onChange={() => setAnswers({ ...answers, [q.id]: o.key })}
                  />
                  <span>
                    <strong>{o.key}.</strong> {o.text}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          margin: '2rem 0',
        }}
      >
        <button
          className="btn"
          type="button"
          disabled={busy}
          onClick={() => submit(false)}
        >
          {busy ? 'Submitting…' : 'Submit quiz'}
        </button>
      </div>
    </div>
  )
}
