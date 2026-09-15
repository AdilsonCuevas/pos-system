import { useEffect, useCallback, useRef } from 'react'
import { usePOSStore } from '../posStore'
import { salesApi, inventoryApi } from '../api'
import type { OfflineOperation } from '../posStore'

const SYNC_INTERVAL = 5000 // 5 seconds
const MAX_RETRIES = 3

export function useSync() {
  const {
    isOnline,
    setIsOnline,
    offlineQueue,
    pendingCount,
    lastSync,
    setLastSync,
    processQueue,
  } = usePOSStore()
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isProcessingRef = useRef(false)
  
  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Initial check
    setIsOnline(navigator.onLine)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [setIsOnline])
  
  // Auto-sync when online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isProcessingRef.current) {
      // Initial sync attempt
      processQueue()
      
      // Set up interval for periodic sync
      intervalRef.current = setInterval(() => {
        if (isOnline && pendingCount > 0 && !isProcessingRef.current) {
          processQueue()
        }
      }, SYNC_INTERVAL)
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isOnline, pendingCount, processQueue])
  
  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (!isOnline) return
    await processQueue()
  }, [isOnline, processQueue])
  
  // Retry failed operations
  const retryFailed = useCallback(async () => {
    const { offlineQueue: queue } = usePOSStore.getState()
    const failed = queue.filter((op) => op.status === 'failed' && op.retryCount < MAX_RETRIES)
    
    for (const op of failed) {
      usePOSStore.setState((state) => ({
        offlineQueue: state.offlineQueue.map((o) =>
          o.id === op.id ? { ...o, status: 'pending' as const } : o
        ),
      }))
    }
    
    await processQueue()
  }, [processQueue])
  
  // Clear synced operations (keep for history but don't show as pending)
  const clearSynced = useCallback(() => {
    usePOSStore.setState((state) => ({
      offlineQueue: state.offlineQueue.filter((op) => op.status !== 'synced'),
    }))
  }, [])
  
  return {
    isOnline,
    pendingCount,
    lastSync,
    triggerSync,
    retryFailed,
    clearSynced,
  }
}

// Initialize sync on app start
export function useInitSync() {
  useEffect(() => {
    // Listen for storage changes (other tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pos-state') {
        // Queue was updated in another tab
        window.dispatchEvent(new CustomEvent('pos-queue-updated'))
      }
    }
    
    window.addEventListener('storage', handleStorage)
    window.addEventListener('pos-queue-updated', () => {
      // Trigger sync check
      const { isOnline, pendingCount, processQueue } = usePOSStore.getState()
      if (isOnline && pendingCount > 0) {
        processQueue()
      }
    })
    
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('pos-queue-updated', () => {})
    }
  }, [])
}