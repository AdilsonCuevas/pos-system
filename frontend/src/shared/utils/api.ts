import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { getErrorMessage } from './cn'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add access token from localStorage
    try {
      const authStorage = localStorage.getItem('pos-auth')
      if (authStorage) {
        const { state } = JSON.parse(authStorage)
        if (state?.tokens?.access_token) {
          config.headers.Authorization = `Bearer ${state.tokens.access_token}`
        }
      }
    } catch {}
    
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for token refresh
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: any) => void
  reject: (reason: any) => void
}> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }
      
      originalRequest._retry = true
      isRefreshing = true
      
      try {
        const authStorage = localStorage.getItem('pos-auth')
        if (authStorage) {
          const { state } = JSON.parse(authStorage)
          if (state?.tokens?.refresh_token) {
            const { data } = await axios.post('/api/auth/refresh', {
              refresh_token: state.tokens.refresh_token,
            })
            
            // Update stored tokens
            const newState = { ...state, tokens: data }
            localStorage.setItem('pos-auth', JSON.stringify({ state: newState }))
            
            processQueue(null, data.access_token)
            
            originalRequest.headers.Authorization = `Bearer ${data.access_token}`
            return api(originalRequest)
          }
        }
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('pos-auth')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    
    return Promise.reject(error)
  }
)

export default api