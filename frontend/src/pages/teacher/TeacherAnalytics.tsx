import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '../../lib/api'

type Analytics = {
  total_quizzes: number
  total_attempts: number
  average_score: number
  pass_rate: number
  score_distribution: { range: string; count: number }[]
  student_leaderboard: { full_name: string; average_score: number; attempts: number }[]
  recent_attempts: { quiz_title: string; student_name: string; percentage: number; submitted_at?: string }[]
}

export default function TeacherAnalytics() {
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<Analytics>('/analytics/teacher')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || err.message))
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Loading analytics…</p>

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Class analytics</h1>
        <p>Student-wise and class-wise performance across your published assessments.</p>
      </section>

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        <div className="stat">
          <div className="label">Average score</div>
          <div className="value">{data.average_score}%</div>
        </div>
        <div className="stat">
          <div className="label">Pass rate</div>
          <div className="value">{data.pass_rate}%</div>
        </div>
        <div className="stat">
          <div className="label">Attempts</div>
          <div className="value">{data.total_attempts}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Score distribution</h2>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data.score_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,42,36,0.12)" />
                <XAxis dataKey="range" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#0f6a5a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Leaderboard</h2>
          {data.student_leaderboard.length === 0 ? (
            <div className="empty">No submitted attempts yet.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Avg</th>
                  <th>Attempts</th>
                </tr>
              </thead>
              <tbody>
                {data.student_leaderboard.map((s) => (
                  <tr key={s.full_name}>
                    <td>{s.full_name}</td>
                    <td>{s.average_score}%</td>
                    <td>{s.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Recent attempts</h2>
        {data.recent_attempts.length === 0 ? (
          <div className="empty">Nothing submitted yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Quiz</th>
                <th>Student</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_attempts.map((a, i) => (
                <tr key={`${a.student_name}-${i}`}>
                  <td>{a.quiz_title}</td>
                  <td>{a.student_name}</td>
                  <td>{a.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
