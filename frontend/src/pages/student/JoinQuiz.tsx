import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'

export default function JoinQuiz() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/attempts/start', { access_code: code })
      sessionStorage.setItem(`attempt:${data.attempt.id}`, JSON.stringify(data))
      navigate(`/student/attempt/${data.attempt.id}`)
    } catch (err: unknown) {
      // @ts-expect-error axios
      setError(err.response?.data?.detail || 'Could not start quiz')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>Join assessment</h1>
        <p>Enter the access code shared by your teacher to begin a timed quiz.</p>
      </section>
      <div className="panel" style={{ maxWidth: 480 }}>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Access code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="A1B2C3"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Starting…' : 'Start quiz'}
          </button>
        </form>
      </div>
    </div>
  )
}
