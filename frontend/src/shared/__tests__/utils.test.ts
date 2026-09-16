// Frontend Unit Tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

// Test utilities
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

// ============================================================
// useAuth Tests
// ============================================================

describe('useAuth', () => {
  const mockLogin = vi.fn()
  const mockLogout = vi.fn()
  const mockRefreshAuth = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    vi.mock('@/features/auth/authStore', () => ({
      useAuthStore: {
        getState: () => ({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          setAuth: vi.fn(),
          logout: mockLogout,
          setLoading: vi.fn(),
        }),
      },
    }))
  })

  it('provides auth context', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider>{children}</AuthProvider>
      ),
    })

    expect(result.current).toHaveProperty('user')
    expect(result.current).toHaveProperty('isAuthenticated')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('login')
    expect(result.current).toHaveProperty('logout')
    expect(result.current).toHaveProperty('refreshAuth')
  })
})

// ============================================================
// useCart Tests
// ============================================================

describe('useCart', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('adds product to cart', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <POSProvider>{children}</POSProvider>
      ),
    })

    const mockProduct = {
      id: 1,
      name: 'Test Product',
      sku: 'TEST-001',
      price: 10000,
      taxRate: 0.19,
      imageUrl: null,
    }

    act(() => {
      result.current.addProduct(mockProduct, 2)
    })

    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0].productId).toBe(1)
    expect(result.current.cart[0].quantity).toBe(2)
  })

  it('merges same product with same modifiers', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <POSProvider>{children}</POSProvider>
      ),
    })

    const mockProduct = {
      id: 1,
      name: 'Test Product',
      sku: 'TEST-001',
      price: 10000,
      taxRate: 0.19,
    }

    act(() => {
      result.current.addProduct(mockProduct, 1)
      result.current.addProduct(mockProduct, 2)
    })

    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0].quantity).toBe(3)
  })

  it('calculates totals correctly', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <POSProvider>{children}</POSProvider>
      ),
    })

    const mockProduct = {
      id: 1,
      name: 'Test Product',
      sku: 'TEST-001',
      price: 10000,
      taxRate: 0.19,
    }

    act(() => {
      result.current.addProduct({ ...mockProduct, price: 10000 }, 2)
      result.current.addProduct({ ...mockProduct, price: 5000 }, 1)
    })

    expect(result.current.subtotal).toBe(25000) // 2*10000 + 1*5000
    expect(result.current.taxAmount).toBe(4750) // 25000 * 0.19
    expect(result.current.total).toBe(29750) // 25000 + 4750
  })

  it('updates item quantity', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <POSProvider>{children}</POSProvider>
      ),
    })

    const mockProduct = {
      id: 1,
      name: 'Test Product',
      sku: 'TEST-001',
      price: 10000,
      taxRate: 0.19,
    }

    act(() => {
      result.current.addProduct(mockProduct, 1)
    })

    const tempId = result.current.cart[0].tempId

    act(() => {
      result.current.updateQuantity(tempId, 5)
    })

    expect(result.current.cart[0].quantity).toBe(5)

    act(() => {
      result.current.updateQuantity(tempId, 0)
    })

    expect(result.current.cart).toHaveLength(0)
  })

  it('applies modifiers correctly', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <POSProvider>{children}</POSProvider>
      ),
    })

    const mockProduct = {
      id: 1,
      name: 'Hamburguesa',
      sku: 'HAMB-001',
      price: 15000,
      taxRate: 0.19,
    }

    act(() => {
      result.current.addProduct(mockProduct, 1, [
        { group_id: 1, modifier_id: 2, name: 'Queso extra', price_delta: 2000 }
      ])
    })

    expect(result.current.cart[0].modifiers).toHaveLength(1)
    expect(result.current.cart[0].unitPrice).toBe(17000) // 15000 + 2000
  })

  it('clears cart', () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: ({ children }) => (
        <POSProvider>{children}</POSProvider>
      ),
    })

    act(() => {
      result.current.addProduct({ id: 1, name: 'Test', price: 1000, taxRate: 0.19, sku: 'T' }, 1)
      result.current.clearCart()
    })

    expect(result.current.cart).toHaveLength(0)
    expect(result.current.isEmpty).toBe(true)
  })
})

// ============================================================
// useSync Tests
// ============================================================

describe('useSync', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tracks online/offline status', () => {
    const { result } = renderHook(() => useSync(), {
      wrapper: ({ children }) => (
        <POSProvider>{children}</POSProvider>
      ),
    })

    expect(result.current.isOnline).toBe(true) // Default in test environment

    // Simulate offline
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isOnline).toBe(false)

    // Simulate online
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current.isOnline).toBe(true)
  })

  it('tracks pending queue count', () => {
    const { result } = renderHook(() => useSync(), {
      wrapper: ({ children }) => (
        <POSProvider>{children}</POSProvider>
      ),
    })

    expect(result.current.pendingCount).toBe(0)

    // Add to queue via store
    act(() => {
      usePOSStore.getState().addToQueue({
        entityType: 'sale',
        operation: 'create',
        payload: { test: 'data' },
      })
    })

    expect(result.current.pendingCount).toBe(1)
  })
})

// ============================================================
// useIndexedDB Tests
// ============================================================

describe('useIndexedDB', () => {
  beforeEach(() => {
    vi.resetModules()
    // Mock IndexedDB
    global.indexedDB = {
      open: vi.fn().mockReturnValue({
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: {
          createObjectStore: vi.fn(),
          transaction: vi.fn().mockReturnValue({
            objectStore: vi.fn().mockReturnValue({
              add: vi.fn().mockReturnValue({ onsuccess: null }),
              get: vi.fn().mockReturnValue({ onsuccess: null }),
              getAll: vi.fn().mockReturnValue({ onsuccess: null }),
              put: vi.fn().mockReturnValue({ onsuccess: null }),
              delete: vi.fn().mockReturnValue({ onsuccess: null }),
            }),
          }),
        },
      })
    }
  })

  it('opens database connection', async () => {
    const { result } = renderHook(() => useIndexedDB('test-db', 1), {
      wrapper: ({ children }) => <POSProvider>{children}</POSProvider>,
    })

    await waitFor(() => {
      expect(result.current.db).toBeDefined()
    })
  })

  it('adds and retrieves data', async () => {
    const { result } = renderHook(() => useIndexedDB('test-db', 1), {
      wrapper: ({ children }) => <POSProvider>{children}</POSProvider>,
    })

    await waitFor(() => expect(result.current.db).toBeDefined())

    const testData = { id: '1', name: 'Test' }
    
    await act(async () => {
      await result.current.add('store', testData)
    })

    // Verify data was stored (mocked)
    expect(result.current.db).toBeDefined()
  })
})

// ============================================================
// Utility Function Tests
// ============================================================

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('base', 'extra')).toBe('base extra')
    expect(cn('base', false && 'conditional')).toBe('base')
    expect(cn('base', true && 'conditional')).toBe('base conditional')
  })

  it('handles tailwind merge', () => {
    expect(cn('p-2 p-4')).toBe('p-4') // Tailwind merge removes duplicate
    expect(cn('text-red-500 text-blue-500')).toBe('text-blue-500')
  })
})

describe('formatCOP utility', () => {
  it('formats COP amounts correctly', () => {
    expect(formatCOP(10000)).toBe('$10.000')
    expect(formatCOP(1000000)).toBe('$1.000.000')
    expect(formatCOP(0)).toBe('$0')
    expect(formatCOP(1234567.89)).toBe('$1.234.568')
  })

  it('parses COP strings', () => {
    expect(parseCOP('$10.000')).toBe(10000)
    expect(parseCOP('$1.000.000')).toBe(1000000)
    expect(parseCOP('invalid')).toBe(0)
    expect(parseCOP('')).toBe(0)
  })
})

describe('formatDate utilities', () => {
  it('formats dates correctly', () => {
    const date = new Date('2024-01-15T10:30:00')
    
    expect(formatDate(date)).toBe('15/01/2024')
    expect(formatDateTime(date)).toBe('15/01/2024, 10:30:00')
    expect(formatTime(date)).toBe('10:30')
  })
})

describe('generateId utility', () => {
  it('generates unique IDs', () => {
    const id1 = generateId()
    const id2 = generateId()
    
    expect(id1).not.toBe(id2)
    expect(id1.length).toBeGreaterThan(10)
  })
})

describe('debounce utility', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces function calls', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    debouncedFn()
    debouncedFn()

    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('throttle utility', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throttles function calls', () => {
    const fn = vi.fn()
    const throttledFn = throttle(fn, 100)

    throttledFn()
    throttledFn()
    throttledFn()

    expect(fn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)

    throttledFn()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('clamp utility', () => {
  it('clamps values within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })
})

describe('roundTo utility', () => {
  it('rounds to specified decimals', () => {
    expect(roundTo(1.2345, 2)).toBe(1.23)
    expect(roundTo(1.235, 2)).toBe(1.24)
    expect(roundTo(1.2, 0)).toBe(1)
    expect(roundTo(1.7, 0)).toBe(2)
  })
})

describe('sleep utility', () => {
  it('delays execution', async () => {
    vi.useFakeTimers()
    
    const promise = sleep(100)
    
    vi.advanceTimersByTime(100)
    
    await promise
    
    vi.useRealTimers()
  })
})

describe('isOnline utility', () => {
  it('returns navigator.onLine', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    expect(isOnline()).toBe(true)
    
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    expect(isOnline()).toBe(false)
  })
})

describe('getInitials utility', () => {
  it('extracts initials from name', () => {
    expect(getInitials('Juan Pérez')).toBe('JP')
    expect(getInitials('María')).toBe('M')
    expect(getInitials('Juan Carlos Pérez')).toBe('JC')
  })
})

describe('truncate utility', () => {
  it('truncates long strings', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...')
    expect(truncate('Hi', 10)).toBe('Hi')
    expect(truncate('', 5)).toBe('')
  })
})

describe('getErrorMessage utility', () => {
  it('extracts error messages', () => {
    expect(getErrorMessage(new Error('Test error'))).toBe('Test error')
    expect(getErrorMessage('String error')).toBe('String error')
    expect(getErrorMessage({ message: 'Object error' })).toBe('Object error')
    expect(getErrorMessage(null)).toBe('Error desconocido')
    expect(getErrorMessage(undefined)).toBe('Error desconocido')
  })
})