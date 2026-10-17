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
  duration_minutes: number
}

export default function QuizList() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<Quiz[]>('/quizzes')
      .then((res) => setQuizzes(res.data))
      .catch((err) => setError(err.response?.data?.detail || err.message))
  }, [])

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Your quizzes</h1>
        <p>Open a quiz to review AI drafts, import CSV/Excel, approve items, then publish.</p>
        <div className="cta-row">
          <Link className="btn" to="/teacher/generate">
            AI generate
          </Link>
          <Link className="btn secondary" to="/teacher/quizzes/new">
            New quiz
          </Link>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <div className="panel">
        {quizzes.length === 0 ? (
          <div className="empty">No quizzes yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Questions</th>
                <th>Duration</th>
                <th>Access code</th>
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
                  <td>{q.duration_minutes} min</td>
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
