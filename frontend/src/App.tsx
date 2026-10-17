import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import CreateQuiz from './pages/teacher/CreateQuiz'
import GenerateQuiz from './pages/teacher/GenerateQuiz'
import QuizDetail from './pages/teacher/QuizDetail'
import QuizList from './pages/teacher/QuizList'
import TeacherAnalytics from './pages/teacher/TeacherAnalytics'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import History from './pages/student/History'
import JoinQuiz from './pages/student/JoinQuiz'
import StudentDashboard from './pages/student/StudentDashboard'
import TakeQuiz from './pages/student/TakeQuiz'

function HomeRedirect() {
  const { session, profile, loading } = useAuth()
  if (loading) return <p className="muted page">Loading…</p>
  if (!session) return <Landing />
  if (profile?.role === 'teacher') return <Navigate to="/teacher" replace />
  return <Navigate to="/student" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute role="teacher" />}>
        <Route element={<Layout />}>
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/generate" element={<GenerateQuiz />} />
          <Route path="/teacher/quizzes" element={<QuizList />} />
          <Route path="/teacher/quizzes/new" element={<CreateQuiz />} />
          <Route path="/teacher/quizzes/:quizId" element={<QuizDetail />} />
          <Route path="/teacher/analytics" element={<TeacherAnalytics />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="student" />}>
        <Route element={<Layout />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/join" element={<JoinQuiz />} />
          <Route path="/student/attempt/:attemptId" element={<TakeQuiz />} />
          <Route path="/student/history" element={<History />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
