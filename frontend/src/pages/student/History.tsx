
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'

type Attempt = {
  id: string
  status: string
  percentage?: number | null
  score?: number | null
  max_score?: number | null
  submitted_at?: string | null
  quizzes?: {
    title: string
    subject?: string
    passing_score?: number
  } | null
}

export default function History() {
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    api
      .get('/attempts/me')
      .then((res) => {
        if (!active) return

        // Support either a direct array or an object containing attempts.
        const data = res.data
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.attempts)
            ? data.attempts
            : []

        setAttempts(list)
      })
      .catch((err: unknown) => {
        if (!active) return

        const error = err as {
          response?: { data?: { detail?: string; message?: string } }
          message?: string
        }

        setError(
          error.response?.data?.detail ||
            error.response?.data?.message ||
            error.message ||
            'Failed to load result history.'
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Result history</h1>
        <p>All of your submitted and in-progress assessments in one place.</p>
      </section>

      {error && <p className="error">{error}</p>}

      <div className="panel">
        {loading ? (
          <p className="muted">Loading result history...</p>
        ) : attempts.length === 0 ? (
          <div className="empty">
            No attempts yet. <Link to="/student/join">Join a quiz</Link>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Quiz</th>
                <th>Status</th>
                <th>Score</th>
                <th>Submitted</th>
              </tr>
            </thead>

            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.quizzes?.title || 'Quiz'}
                    {a.quizzes?.subject && (
                      <div className="muted">{a.quizzes.subject}</div>
                    )}
                  </td>

                  <td>
                    <span
                      className={`badge ${
                        a.status === 'submitted' ? '' : 'warn'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>

                  <td>
                    {a.percentage != null
                      ? `${a.score ?? 0}/${a.max_score ?? 0} (${a.percentage}%)`
                      : '—'}
                  </td>

                  <td>
                    {a.submitted_at
                      ? new Date(a.submitted_at).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
