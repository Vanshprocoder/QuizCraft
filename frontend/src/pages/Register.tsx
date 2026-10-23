import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'teacher' | 'student'>('teacher')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await signUp(email, password, fullName, role)
      setMessage('Account created. Signing you in…')
      navigate(role === 'teacher' ? '/teacher' : '/student')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="panel auth-card">
        <span className="brand">
          Quiz<span>Craft</span>
        </span>
        <h1>Create account</h1>
        <p className="muted">Teachers generate and publish. Students take timed quizzes.</p>
        <form className="form" onSubmit={onSubmit} style={{ marginTop: '1.25rem' }}>
          <label>
            Full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as 'teacher' | 'student')}>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
            </select>
          </label>
          {error && <p className="error">{error}</p>}
          {message && <p className="success">{message}</p>}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1rem' }}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
