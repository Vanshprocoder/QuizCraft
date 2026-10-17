import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'

type Quiz = {
  id: string
  title: string
  status: string
  access_code?: string
  question_count?: number
  subject?: string
}

type Analytics = {
  total_quizzes: number
  total_attempts: number
  average_score: number
  pass_rate: number
}

export default function TeacherDashboard() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [stats, setStats] = useState<Analytics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.get<Quiz[]>('/quizzes'), api.get<Analytics>('/analytics/teacher')])
      .then(([q, a]) => {
        setQuizzes(q.data.slice(0, 5))
        setStats(a.data)
      })
      .catch((err) => setError(err.response?.data?.detail || err.message))
  }, [])

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Teacher workspace</h1>
        <p>Generate with AI, review carefully, publish with an access code, then watch class results.</p>
        <div className="cta-row">
          <Link className="btn" to="/teacher/generate">
            Generate with AI
          </Link>
          <Link className="btn secondary" to="/teacher/quizzes/new">
            Create blank quiz
          </Link>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      {stats && (
        <div className="grid-3" style={{ marginBottom: '1rem' }}>
          <div className="stat">
            <div className="label">Quizzes</div>
            <div className="value">{stats.total_quizzes}</div>
          </div>
          <div className="stat">
            <div className="label">Attempts</div>
            <div className="value">{stats.total_attempts}</div>
          </div>
          <div className="stat">
            <div className="label">Pass rate</div>
            <div className="value">{stats.pass_rate}%</div>
          </div>
        </div>
      )}

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>Recent quizzes</h2>
          <Link to="/teacher/quizzes">View all</Link>
        </div>
        {quizzes.length === 0 ? (
          <div className="empty">No quizzes yet. Generate one with AI to get started.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Questions</th>
                <th>Code</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((q) => (
                <tr key={q.id}>
                  <td>
                    <Link to={`/teacher/quizzes/${q.id}`}>{q.title}</Link>
                    {q.subject && <div className="muted">{q.subject}</div>}
                  </td>
                  <td>
                    <span className={`badge ${q.status === 'published' ? '' : 'warn'}`}>{q.status}</span>
                  </td>
                  <td>{q.question_count ?? 0}</td>
                  <td>{q.access_code || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
