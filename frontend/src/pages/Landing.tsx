import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Landing() {
  const { session, profile } = useAuth()
  const dest = profile?.role === 'teacher' ? '/teacher' : '/student'

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          Quiz<span>Craft</span>
        </div>
        <nav className="nav-links">
          {session ? (
            <Link to={dest}>Open app</Link>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link to="/register">Create account</Link>
            </>
          )}
        </nav>
      </header>
      <main className="page">
        <section className="hero">
          <div className="brand" style={{ fontSize: '2.6rem' }}>
            Quiz<span>Craft</span>
          </div>
          <h1>AI quizzes that teachers trust and students can finish on time.</h1>
          <p>
            Generate questions with Gemini, review them before publish, run timed assessments with
            access codes, and read class performance at a glance.
          </p>
          <div className="cta-row">
            {session ? (
              <Link className="btn" to={dest}>
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link className="btn" to="/register">
                  Get started
                </Link>
                <Link className="btn secondary" to="/login">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
