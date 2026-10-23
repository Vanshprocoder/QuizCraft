
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

type ManualQuestion = {
  question_text: string
  question_type: 'mcq' | 'short_answer' | 'long_answer'
  correct_answer: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
}

export default function QuizDetail() {
  const { quizId } = useParams()

  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [publishedCode, setPublishedCode] = useState('')
  const [showPublishModal, setShowPublishModal] = useState(false)

  const [manual, setManual] = useState<ManualQuestion>({
    question_text: '',
    question_type: 'mcq',
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
    load().catch((err) =>
      setError(err.response?.data?.detail || err.message || 'Could not load quiz')
    )
  }, [load])

  async function approveAll() {
    if (!quizId) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      await api.post(`/quizzes/${quizId}/questions/approve-all`)
      setMessage('All questions approved.')
      await load()
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { detail?: string } }
      }
      setError(e.response?.data?.detail || 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  async function toggleApprove(q: Question) {
    if (!quizId) return

    setError('')

    try {
      await api.patch(`/quizzes/${quizId}/questions/${q.id}`, {
        is_approved: !q.is_approved,
      })
      await load()
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { detail?: string } }
      }
      setError(e.response?.data?.detail || 'Could not update approval')
    }
  }

  async function publish() {
    if (!quizId) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const { data } = await api.post(`/quizzes/${quizId}/publish`)

      // Use the actual code returned by the backend.
      const code = data.access_code || ''

      await load()

      setPublishedCode(code)
      setShowPublishModal(true)
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { detail?: string } }
      }
      setError(e.response?.data?.detail || 'Publish failed')
    } finally {
      setBusy(false)
    }
  }

  async function onImport(file: File | null) {
    if (!file || !quizId) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const form = new FormData()
      form.append('file', file)

      const { data } = await api.post(
        `/quizzes/${quizId}/import`,
        form
      )

      setMessage(`Imported ${data.imported} questions.`)
      await load()
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { detail?: string } }
      }
      setError(e.response?.data?.detail || 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  async function addManual(e: FormEvent) {
    e.preventDefault()
    if (!quizId) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const isMcq = manual.question_type === 'mcq'

      await api.post(`/quizzes/${quizId}/questions`, {
        question_text: manual.question_text,
        question_type: manual.question_type,
        options: isMcq
          ? [
              { key: 'A', text: manual.option_a },
              { key: 'B', text: manual.option_b },
              { key: 'C', text: manual.option_c },
              { key: 'D', text: manual.option_d },
            ]
          : [],
        correct_answer: manual.correct_answer,
      })

      setManual({
        question_text: '',
        question_type: 'mcq',
        correct_answer: 'A',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
      })

      setMessage('Question added successfully.')
      await load()
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { detail?: string } }
      }
      setError(e.response?.data?.detail || 'Could not add question')
    } finally {
      setBusy(false)
    }
  }

  // async function copyAccessCode() {
  //   try {
  //     await navigator.clipboard.writeText(publishedCode)
  //     setMessage('Access code copied.')
  //   } catch {
  //     setError('Could not copy automatically. Please select and copy the code.')
  //   }
  // }

  if (!quiz) {
    return (
      <div className="panel">
        {error ? <p className="error">{error}</p> : <p className="muted">Loading quiz…</p>}
      </div>
    )
  }

  const isMcq = manual.question_type === 'mcq'

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>{quiz.title}</h1>
        <p>
          {quiz.description ||
            'Review questions, approve them, then publish with an access code.'}
        </p>

        <div className="cta-row">
          <span className={`badge ${quiz.status === 'published' ? '' : 'warn'}`}>
            {quiz.status}
          </span>

          {quiz.access_code && (
            <span className="timer">Code: {quiz.access_code}</span>
          )}

          <button
            className="btn secondary"
            disabled={busy}
            onClick={approveAll}
            type="button"
          >
            Approve all
          </button>

          <button
            className="btn"
            disabled={busy || quiz.status === 'published'}
            onClick={publish}
            type="button"
          >
            {busy ? 'Please wait…' : quiz.status === 'published' ? 'Published' : 'Publish quiz'}
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div className="grid-2">
        <div className="panel">
          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>
            Import CSV / Excel
          </h2>

          <p className="muted">
            Required: question_text, correct_answer. Optional: option_a–d,
            question_type, difficulty, points, topic.
          </p>

          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            disabled={busy}
            onChange={(e) => {
              void onImport(e.target.files?.[0] || null)
              e.currentTarget.value = ''
            }}
          />
        </div>

        <div className="panel">
          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>
            Add question manually
          </h2>

          <form className="form" onSubmit={addManual}>
            <label>
              Question type
              <select
                value={manual.question_type}
                onChange={(e) =>
                  setManual({
                    ...manual,
                    question_type: e.target.value as ManualQuestion['question_type'],
                    correct_answer: 'A',
                  })
                }
              >
                <option value="mcq">MCQ (Multiple Choice)</option>
                <option value="short_answer">Short Answer</option>
                <option value="long_answer">Long Answer</option>
              </select>
            </label>

            <label>
              Question
              <textarea
                value={manual.question_text}
                onChange={(e) =>
                  setManual({ ...manual, question_text: e.target.value })
                }
                required
                placeholder="Enter your question"
              />
            </label>

            {isMcq && (
              <>
                <div className="grid-2">
                  <label>
                    Option A
                    <input
                      value={manual.option_a}
                      onChange={(e) =>
                        setManual({ ...manual, option_a: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    Option B
                    <input
                      value={manual.option_b}
                      onChange={(e) =>
                        setManual({ ...manual, option_b: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    Option C
                    <input
                      value={manual.option_c}
                      onChange={(e) =>
                        setManual({ ...manual, option_c: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    Option D
                    <input
                      value={manual.option_d}
                      onChange={(e) =>
                        setManual({ ...manual, option_d: e.target.value })
                      }
                      required
                    />
                  </label>
                </div>

                <label>
                  Correct answer
                  <select
                    value={manual.correct_answer}
                    onChange={(e) =>
                      setManual({ ...manual, correct_answer: e.target.value })
                    }
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </label>
              </>
            )}

            {!isMcq && (
              <label>
                Expected answer / marking guide
                <textarea
                  value={manual.correct_answer}
                  onChange={(e) =>
                    setManual({ ...manual, correct_answer: e.target.value })
                  }
                  required
                  placeholder={
                    manual.question_type === 'short_answer'
                      ? 'Enter the expected short answer'
                      : 'Enter key points or a marking guide for this long-answer question'
                  }
                />
              </label>
            )}

            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Add question'}
            </button>
          </form>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>
          Questions ({quiz.questions?.length || 0})
        </h2>

        {(quiz.questions || []).length === 0 && (
          <div className="empty">No questions yet.</div>
        )}

        {(quiz.questions || []).map((q, idx) => (
          <div className="question-card" key={q.id}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <strong>
                {idx + 1}. {q.question_text}
              </strong>

              <button
                className="btn secondary"
                type="button"
                disabled={busy}
                onClick={() => void toggleApprove(q)}
              >
                {q.is_approved ? 'Approved' : 'Approve'}
              </button>
            </div>

            <div className="muted" style={{ marginTop: '0.35rem' }}>
              {q.question_type} · {q.source} · {q.difficulty} · {q.points} pts
              {' · '}Answer: {q.correct_answer}
            </div>

            {(q.options || []).length > 0 && (
              <div className="options">
                {q.options.map((o) => (
                  <div key={o.key} className="option">
                    <strong>{o.key}.</strong> {o.text}
                  </div>
                ))}
              </div>
            )}

            {q.explanation && <p className="muted">{q.explanation}</p>}
          </div>
        ))}
      </div>

      {showPublishModal && (
        <div
          role="presentation"
          onClick={() => setShowPublishModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-title"
            onClick={(e) => e.stopPropagation()}
            className="panel"
            style={{
              width: '100%',
              maxWidth: 440,
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
              ✓
            </div>

            <h2 id="publish-title">Quiz published!</h2>
            <p className="muted">
              Students can use this access code to join your quiz.
            </p>

            <div
              className="timer"
              style={{
                display: 'block',
                fontSize: '1.8rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                padding: '1rem',
                margin: '1.25rem 0',
                userSelect: 'all',
              }}
            >
              {publishedCode || quiz.access_code || 'No code returned'}
            </div>

            {(publishedCode || quiz.access_code) && (
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  const code = publishedCode || quiz.access_code || ''
                  void navigator.clipboard
                    .writeText(code)
                    .then(() => setMessage('Access code copied.'))
                    .catch(() =>
                      setError('Copy failed. Please select and copy the code.')
                    )
                }}
              >
                Copy access code
              </button>
            )}

            <button
              className="btn"
              type="button"
              style={{ marginTop: '0.75rem', width: '100%' }}
              onClick={() => setShowPublishModal(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
