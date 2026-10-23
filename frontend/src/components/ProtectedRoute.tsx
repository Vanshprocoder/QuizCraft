import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ role }: { role?: 'teacher' | 'student' }) {
  const { session, profile, loading } = useAuth()

  if (loading || (session && !profile)) {
    return (
      <div className="page">
        <p className="muted">Loading session…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  // if (role && profile.role !== role) {
  //   return <Navigate to={profile.role === 'teacher' ? '/teacher' : '/student'} replace />
  // }

  if (role && profile && profile.role !== role) {
    return (
      <Navigate
        to={profile.role === 'teacher' ? '/teacher' : '/student'}
        replace
      />
    )
  }
  return <Outlet />
}
