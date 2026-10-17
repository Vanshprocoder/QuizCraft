import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'

export default function GenerateQuiz() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [questionCount, setQuestionCount] = useState(5)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/ai/generate', {
        topic,
        subject: subject || null,
        difficulty,
        question_count: questionCount,
        question_types: ['mcq', 'true_false'],
        create_quiz_title: title || `AI Quiz: ${topic}`,
      })
      navigate(`/teacher/quizzes/${data.quiz_id}`)
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err && 'response' in err
          ? // @ts-expect-error axios shape
            err.response?.data?.detail || 'Generation failed'
          : 'Generation failed'
      setError(String(message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>AI question generation</h1>
        <p>Gemini drafts questions for you. Review and approve every item before publishing.</p>
      </section>

      <div className="panel" style={{ maxWidth: 640 }}>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Topic
            <input value={topic} onChange={(e) => setTopic(e.target.value)} required placeholder="Photosynthesis" />
          </label>
          <label>
            Quiz title (optional)
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Biology Unit 3 Check" />
          </label>
          <label>
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Biology" />
          </label>
          <div className="grid-2">
            <label>
              Difficulty
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label>
              Question count
              <input
                type="number"
                min={1}
                max={30}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
              />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Generating…' : 'Generate questions'}
          </button>
        </form>
      </div>
    </div>
  )
}
