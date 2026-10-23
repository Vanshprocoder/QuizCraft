
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'

export default function GenerateQuiz() {
  const navigate = useNavigate()

  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('')
  const [className, setClassName] = useState('')
  const [chapter, setChapter] = useState('')
  const [instructions, setInstructions] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [questionCount, setQuestionCount] = useState(5)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()

    if (!topic.trim()) {
      setError('Please enter the main topic or concept.')
      return
    }

    setBusy(true)
    setError('')

    try {
      // Combine all learning context into one prompt.
      // This does not make any additional AI requests.
      const combinedTopic = [
        `Main topic/concept: ${topic.trim()}`,
        className.trim() ? `Class/Grade: ${className.trim()}` : '',
        subject.trim() ? `Subject: ${subject.trim()}` : '',
        chapter.trim() ? `Chapter/Unit: ${chapter.trim()}` : '',
        instructions.trim()
          ? `Specific instructions: ${instructions.trim()}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')

      const quizTitle =
        title.trim() || `AI Quiz: ${topic.trim()}`

      const { data } = await api.post('/ai/generate', {
        topic: combinedTopic,
        subject: subject.trim() || null,
        difficulty,
        question_count: questionCount,
        question_types: ['mcq', 'true_false'],
        create_quiz_title: quizTitle,
      })

      navigate(`/teacher/quizzes/${data.quiz_id}`)
    } catch (err: unknown) {
      const errorObject = err as {
        response?: {
          data?: {
            detail?: string
            message?: string
          }
        }
        message?: string
      }

      setError(
        errorObject.response?.data?.detail ||
          errorObject.response?.data?.message ||
          errorObject.message ||
          'AI generation failed. Please try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <section className="hero" style={{ paddingTop: 0 }}>
        <h1>AI question generation</h1>
        <p>
          Generate curriculum-focused questions with Gemini.
          Review and approve every item before publishing.
        </p>
      </section>

      <div className="panel" style={{ maxWidth: 720 }}>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Main topic or concept *
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              placeholder="e.g. Photosynthesis, Internet Safety"
            />
          </label>

          <div className="grid-2">
            <label>
              Class / Grade
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              >
                <option value="">Select class</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(
                  (grade) => (
                    <option key={grade} value={`Class ${grade}`}>
                      Class {grade}
                    </option>
                  )
                )}
                <option value="College">College</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label>
              Subject
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Science, Computer"
              />
            </label>
          </div>

          <label>
            Chapter name / Unit
            <input
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Chapter 3: The Internet"
            />
          </label>

          <label>
            Quiz title (optional)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter 3 Assessment"
            />
          </label>

          <label>
            Specific instructions for AI (optional)
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
              maxLength={3000}
              placeholder={
                'Tell AI what to include or avoid.\n\n' +
                'Example:\n' +
                '- Focus on the main concepts in this chapter.\n' +
                '- Include practical, real-life examples.\n' +
                '- Test understanding, not just memorization.\n' +
                '- Avoid topics outside the syllabus.'
              }
            />
            <small className="muted">
              {instructions.length}/3000 characters
            </small>
          </label>

          <div className="grid-2">
            <label>
              Difficulty
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
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
                required
                onChange={(e) => {
                  const value = Number(e.target.value)
                  setQuestionCount(
                    Math.min(30, Math.max(1, value))
                  )
                }}
              />
            </label>
          </div>

          {error && <p className="error">{error}</p>}

          <button
            className="btn"
            type="submit"
            disabled={busy || !topic.trim()}
          >
            {busy ? 'Generating questions…' : 'Generate questions'}
          </button>

          <p className="muted">
            Tip: Include your class, chapter and learning objectives
            for more relevant questions.
          </p>
        </form>
      </div>
    </div>
  )
}
