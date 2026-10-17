import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const isTeacher = profile?.role === 'teacher'

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          Quiz<span>Craft</span>
        </NavLink>
        <nav className="nav-links">
          {isTeacher ? (
            <>
              <NavLink to="/teacher">Dashboard</NavLink>
              <NavLink to="/teacher/generate">AI Generate</NavLink>
              <NavLink to="/teacher/quizzes">Quizzes</NavLink>
              <NavLink to="/teacher/analytics">Analytics</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/student">Dashboard</NavLink>
              <NavLink to="/student/join">Take Quiz</NavLink>
              <NavLink to="/student/history">Results</NavLink>
            </>
          )}
          <button className="linkish" type="button" onClick={() => signOut()}>
            Sign out ({profile?.full_name || profile?.email})
          </button>
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
