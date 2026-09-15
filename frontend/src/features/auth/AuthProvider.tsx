import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useAuthStore } from './authStore'
import { authApi } from './api'
import type { User } from '@/shared/types/api'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, tokens, isAuthenticated, isLoading, setAuth, logout: logoutStore, setLoading } = useAuthStore()

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      if (tokens?.access_token) {
        try {
          // Verify token and get fresh user data
          const freshUser = await authApi.me()
          setAuth(freshUser, tokens)
        } catch {
          // Token invalid, clear auth
          logoutStore()
        }
      }
      setLoading(false)
    }
    
    initAuth()
  }, [tokens, setAuth, logoutStore, setLoading])

  const login = async (email: string, password: string) => {
    const { user, tokens } = await authApi.login(email, password)
    setAuth(user, tokens)
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      logoutStore()
    }
  }

  const refreshAuth = async () => {
    if (tokens?.refresh_token) {
      try {
        const newTokens = await authApi.refresh(tokens.refresh_token)
        setAuth(user!, newTokens)
      } catch {
        logoutStore()
      }
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoading,
      login,
      logout,
      refreshAuth,
    }}>
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