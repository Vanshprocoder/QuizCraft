
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import api from '../lib/api'

export type Profile = {
  id: string
  email: string
  full_name: string
  role: 'teacher' | 'student'
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: 'teacher' | 'student',
  ) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Load the authenticated user's profile from the FastAPI backend.
  const refreshProfile = useCallback(async () => {
    try {
      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession()

      if (error) throw error

      const accessToken = currentSession?.access_token

      if (!accessToken) {
        setProfile(null)
        return
      }

      const response = await api.get<Profile>('/auth/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      setProfile(response.data)
    } catch (error) {
      console.error('Failed to load profile:', error)
      setProfile(null)
    }
  }, [])

  // Restore the saved Supabase session when the app starts.
  useEffect(() => {
    let mounted = true

    const initializeSession = async () => {
      try {
        const {
          data: { session: savedSession },
          error,
        } = await supabase.auth.getSession()

        if (error) throw error

        if (mounted) {
          setSession(savedSession)
        }
      } catch (error) {
        console.error('Failed to initialize session:', error)

        if (mounted) {
          setSession(null)
          setProfile(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void initializeSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Refresh the profile whenever the authenticated session changes.
  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }

    void refreshProfile()
  }, [session, refreshProfile])

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      role: 'teacher' | 'student',
    ) => {
      const normalizedEmail = email.trim().toLowerCase()

      try {
        await api.post('/auth/register', {
          email: normalizedEmail,
          password,
          full_name: fullName.trim(),
          role,
        })
      } catch (err: unknown) {
        const detail =
          typeof err === 'object' &&
          err !== null &&
          'response' in err
            ? (err as {
                response?: { data?: { detail?: string } }
              }).response?.data?.detail
            : undefined

        throw new Error(
          typeof detail === 'string' ? detail : 'Registration failed',
        )
      }

      // Registration creates the account; sign in to establish a session.
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) throw error

      if (!data.session) {
        throw new Error('Registration succeeded, but no login session was created.')
      }

      setSession(data.session)
    },
    [],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) throw error

    if (!data.session) {
      throw new Error('Login succeeded, but no session was returned.')
    }

    setSession(data.session)
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()

    if (error) throw error

    setSession(null)
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      refreshProfile,
    ],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
