import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'

type Attempt = {
  id: string
  status: string
  percentage?: number
  score?: number
  max_score?: number
  submitted_at?: string
  quizzes?: { title: string; subject?: string; passing_score?: number }
}

export default function History() {
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<Attempt[]>('/attempts/me')
      .then((res) => setAttempts(res.data))
      .catch((err) => setError(err.response?.data?.detail || err.message))
  }, [])

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Result history</h1>
        <p>All of your submitted and in-progress assessments in one place.</p>
      </section>

      {error && <p className="error">{error}</p>}

      <div className="panel">
        {attempts.length === 0 ? (
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
                    {a.quizzes?.subject && <div className="muted">{a.quizzes.subject}</div>}
                  </td>
                  <td>
                    <span className={`badge ${a.status === 'submitted' ? '' : 'warn'}`}>{a.status}</span>
                  </td>
                  <td>
                    {a.percentage != null ? `${a.score}/${a.max_score} (${a.percentage}%)` : '—'}
                  </td>
                  <td>{a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
