
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'

const sampleCsv = [
  [
    'question_text',
    'correct_answer',
    'option_a',
    'option_b',
    'option_c',
    'option_d',
    'question_type',
    'difficulty',
    'points',
    'topic',
  ],
  [
    'What does CPU stand for?',
    'A',
    'Central Processing Unit',
    'Computer Personal Unit',
    'Central Program Utility',
    'Control Processing User',
    'mcq',
    'easy',
    '1',
    'Computer Fundamentals',
  ],
  [
    'What does HTML stand for?',
    'HyperText Markup Language',
    '',
    '',
    '',
    '',
    'short_answer',
    'medium',
    '2',
    'Web Development',
  ],
  [
    'Explain how the internet works.',
    'The internet connects devices through networks using communication protocols.',
    '',
    '',
    '',
    '',
    'long_answer',
    'hard',
    '5',
    'Internet',
  ],
]

function downloadSampleCsv() {
  const csvContent = sampleCsv
    .map((row) =>
      row
        .map((value) => `"${value.replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\r\n')

  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'quizcraft_sample.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

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
      const errorObject = err as {
        response?: {
          data?: { detail?: string; message?: string }
        }
        message?: string
      }

      setError(
        errorObject.response?.data?.detail ||
          errorObject.response?.data?.message ||
          errorObject.message ||
          'Could not create quiz'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Create quiz</h1>
        <p>
          Start blank, add questions manually, or import a CSV file.
        </p>
      </section>

      <div className="panel" style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h3>Import questions</h3>
          <p className="muted">
            Download the sample CSV to see the required column names
            and supported question formats.
          </p>

          <button
            className="btn"
            type="button"
            onClick={downloadSampleCsv}
          >
            Download sample CSV
          </button>
        </div>

        <hr
          style={{
            border: 0,
            borderTop: '1px solid var(--line)',
            margin: '1.5rem 0',
          }}
        />

        <h3>Quiz details</h3>

        <form className="form" onSubmit={onSubmit}>
          <label>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Science Chapter 3 Quiz"
            />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this quiz"
            />
          </label>

          <label>
            Subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Science"
            />
          </label>

          <div className="grid-2">
            <label>
              Duration (minutes)
              <input
                type="number"
                min={5}
                value={duration}
                required
                onChange={(e) =>
                  setDuration(Number(e.target.value))
                }
              />
            </label>

            <label>
              Passing score (%)
              <input
                type="number"
                min={0}
                max={100}
                value={passing}
                required
                onChange={(e) =>
                  setPassing(Number(e.target.value))
                }
              />
            </label>
          </div>

          {error && <p className="error">{error}</p>}

          <button
            className="btn"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Creating…' : 'Create quiz'}
          </button>
        </form>
      </div>
    </div>
  )
}
