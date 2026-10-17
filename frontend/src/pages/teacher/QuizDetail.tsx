import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../lib/api'

type Option = { key: string; text: string }
type Question = {
  id: string
  question_text: string
  question_type: string
  options: Option[]
  correct_answer: string
  explanation?: string
  is_approved: boolean
  source: string
  difficulty: string
  points: number
}

type Quiz = {
  id: string
  title: string
  description?: string
  status: string
  access_code?: string
  duration_minutes: number
  questions?: Question[]
}

export default function QuizDetail() {
  const { quizId } = useParams()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState({
    question_text: '',
    correct_answer: 'A',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
  })

  const load = useCallback(async () => {
    if (!quizId) return
    const { data } = await api.get(`/quizzes/${quizId}`)
    setQuiz(data)
  }, [quizId])

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.detail || err.message))
  }, [load])

  async function approveAll() {
    if (!quizId) return
    setBusy(true)
    setError('')
    try {
      await api.post(`/quizzes/${quizId}/questions/approve-all`)
      setMessage('All questions approved.')
      await load()
    } catch (err: unknown) {
      // @ts-expect-error axios
      setError(err.response?.data?.detail || 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  async function toggleApprove(q: Question) {
    if (!quizId) return
    await api.patch(`/quizzes/${quizId}/questions/${q.id}`, { is_approved: !q.is_approved })
    await load()
  }

  async function publish() {
    if (!quizId) return
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post(`/quizzes/${quizId}/publish`)
      setMessage(`Published. Access code: ${data.access_code}`)
      await load()
    } catch (err: unknown) {
      // @ts-expect-error axios
      setError(err.response?.data?.detail || 'Publish failed')
    } finally {
      setBusy(false)
    }
  }

  async function onImport(file: File | null) {
    if (!file || !quizId) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post(`/quizzes/${quizId}/import`, form)
      setMessage(`Imported ${data.imported} questions.`)
      await load()
    } catch (err: unknown) {
      // @ts-expect-error axios
      setError(err.response?.data?.detail || 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  async function addManual(e: FormEvent) {
    e.preventDefault()
    if (!quizId) return
    setBusy(true)
    try {
      await api.post(`/quizzes/${quizId}/questions`, {
        question_text: manual.question_text,
        question_type: 'mcq',
        options: [
          { key: 'A', text: manual.option_a },
          { key: 'B', text: manual.option_b },
          { key: 'C', text: manual.option_c },
          { key: 'D', text: manual.option_d },
        ],
        correct_answer: manual.correct_answer,
      })
      setManual({
        question_text: '',
        correct_answer: 'A',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
      })
      await load()
    } catch (err: unknown) {
      // @ts-expect-error axios
      setError(err.response?.data?.detail || 'Could not add question')
    } finally {
      setBusy(false)
    }
  }

  if (!quiz) {
    return <p className="muted">Loading quiz…</p>
  }

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>{quiz.title}</h1>
        <p>{quiz.description || 'Review questions, approve, then publish with an access code.'}</p>
        <div className="cta-row">
          <span className={`badge ${quiz.status === 'published' ? '' : 'warn'}`}>{quiz.status}</span>
          {quiz.access_code && <span className="timer">Code: {quiz.access_code}</span>}
          <button className="btn secondary" disabled={busy} onClick={approveAll} type="button">
            Approve all
          </button>
          <button className="btn" disabled={busy} onClick={publish} type="button">
            Publish quiz
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div className="grid-2">
        <div className="panel">
          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Import CSV / Excel</h2>
          <p className="muted">
            Required columns: question_text, correct_answer. Optional: option_a–d, question_type,
            difficulty, points, topic.
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => onImport(e.target.files?.[0] || null)}
          />
        </div>

        <div className="panel">
          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Add MCQ manually</h2>
          <form className="form" onSubmit={addManual}>
            <label>
              Question
              <textarea
                value={manual.question_text}
                onChange={(e) => setManual({ ...manual, question_text: e.target.value })}
                required
              />
            </label>
            <div className="grid-2">
              <label>
                A
                <input value={manual.option_a} onChange={(e) => setManual({ ...manual, option_a: e.target.value })} required />
              </label>
              <label>
                B
                <input value={manual.option_b} onChange={(e) => setManual({ ...manual, option_b: e.target.value })} required />
              </label>
              <label>
                C
                <input value={manual.option_c} onChange={(e) => setManual({ ...manual, option_c: e.target.value })} required />
              </label>
              <label>
                D
                <input value={manual.option_d} onChange={(e) => setManual({ ...manual, option_d: e.target.value })} required />
              </label>
            </div>
            <label>
              Correct answer
              <select
                value={manual.correct_answer}
                onChange={(e) => setManual({ ...manual, correct_answer: e.target.value })}
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </label>
            <button className="btn" type="submit" disabled={busy}>
              Add question
            </button>
          </form>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>
          Questions ({quiz.questions?.length || 0})
        </h2>
        {(quiz.questions || []).length === 0 && <div className="empty">No questions yet.</div>}
        {(quiz.questions || []).map((q, idx) => (
          <div className="question-card" key={q.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <strong>
                {idx + 1}. {q.question_text}
              </strong>
              <button className="btn secondary" type="button" onClick={() => toggleApprove(q)}>
                {q.is_approved ? 'Approved' : 'Approve'}
              </button>
            </div>
            <div className="muted" style={{ marginTop: '0.35rem' }}>
              {q.question_type} · {q.source} · {q.difficulty} · {q.points} pts · answer {q.correct_answer}
            </div>
            <div className="options">
              {(q.options || []).map((o) => (
                <div key={o.key} className="option">
                  <strong>{o.key}.</strong> {o.text}
                </div>
              ))}
            </div>
            {q.explanation && <p className="muted">{q.explanation}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
