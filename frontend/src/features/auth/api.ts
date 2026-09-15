import axios from 'axios'
import type { User, AuthTokens, LoginRequest, RegisterRequest } from '@/shared/types/api'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // For refresh token cookie
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add access token
api.interceptors.request.use((config) => {
  const tokens = localStorage.getItem('pos-auth')
  if (tokens) {
    try {
      const { state } = JSON.parse(tokens)
      if (state?.tokens?.access_token) {
        config.headers.Authorization = `Bearer ${state.tokens.access_token}`
      }
    } catch {}
  }
  return config
})

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        const tokens = localStorage.getItem('pos-auth')
        if (tokens) {
          const { state } = JSON.parse(tokens)
          if (state?.tokens?.refresh_token) {
            const { data } = await axios.post('/api/auth/refresh', {
              refresh_token: state.tokens.refresh_token,
            })
            
            // Update stored tokens
            const newState = { ...state, tokens: data }
            localStorage.setItem('pos-auth', JSON.stringify({ state: newState }))
            
            // Retry original request
            originalRequest.headers.Authorization = `Bearer ${data.access_token}`
            return api(originalRequest)
          }
        }
      } catch {
        // Refresh failed, redirect to login
        localStorage.removeItem('pos-auth')
        window.location.href = '/login'
      }
    }
    
    return Promise.reject(error)
  }
)

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post<{ user: User; tokens: AuthTokens }>('/auth/login', { email, password })
    return data
  },

  register: async (data: RegisterRequest) => {
    const { data: result } = await api.post<{ user: User; tokens: AuthTokens }>('/auth/register', data)
    return result
  },

  logout: async () => {
    await api.post('/auth/logout')
  },

  me: async () => {
    const { data } = await api.get<User>('/auth/me')
    return data
  },

  refresh: async (refreshToken: string) => {
    const { data } = await api.post<AuthTokens>('/auth/refresh', { refresh_token: refreshToken })
    return data
  },
}

export default api