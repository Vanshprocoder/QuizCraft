import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'

export default function CreateQuiz() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [duration, setDuration] = useState(30)
  const [passing, setPassing] = useState(40)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/quizzes', {
        title,
        description,
        subject,
        duration_minutes: duration,
        passing_score: passing,
      })
      navigate(`/teacher/quizzes/${data.id}`)
    } catch (err: unknown) {
      // @ts-expect-error axios
      setError(err.response?.data?.detail || 'Could not create quiz')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Create quiz</h1>
        <p>Start blank, then add questions manually or import a CSV/Excel file.</p>
      </section>
      <div className="panel" style={{ maxWidth: 640 }}>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <div className="grid-2">
            <label>
              Duration (minutes)
              <input type="number" min={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </label>
            <label>
              Passing score (%)
              <input type="number" min={0} max={100} value={passing} onChange={(e) => setPassing(Number(e.target.value))} />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={busy} type="submit">
            {busy ? 'Creating…' : 'Create quiz'}
          </button>
        </form>
      </div>
    </div>
  )
}
