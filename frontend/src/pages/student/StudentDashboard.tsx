import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api from '../../lib/api'

type StudentAnalytics = {
  total_attempts: number
  average_score: number
  score_trend: { label: string; percentage: number }[]
  history: { quiz_title: string; percentage: number; passed: boolean }[]
}

export default function StudentDashboard() {
  const [data, setData] = useState<StudentAnalytics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<StudentAnalytics>('/analytics/student')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || err.message))
  }, [])

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Student dashboard</h1>
        <p>Join a quiz with an access code, finish before the timer ends, and track your history.</p>
        <div className="cta-row">
          <Link className="btn" to="/student/join">
            Enter access code
          </Link>
          <Link className="btn secondary" to="/student/history">
            View results
          </Link>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <div className="stat">
              <div className="label">Attempts</div>
              <div className="value">{data.total_attempts}</div>
            </div>
            <div className="stat">
              <div className="label">Average score</div>
              <div className="value">{data.average_score}%</div>
            </div>
          </div>

          <div className="panel">
            <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Score trend</h2>
            {data.score_trend.length === 0 ? (
              <div className="empty">Take a quiz to see your trend.</div>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={data.score_trend}>
                    <XAxis dataKey="label" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="percentage" stroke="#0f6a5a" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
