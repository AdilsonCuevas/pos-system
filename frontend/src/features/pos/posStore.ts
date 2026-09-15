import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CartItem, Sale, PaymentMethod } from '@/shared/types/pos'
import { v4 as uuidv4 } from '@/shared/utils/uuid'

interface POSState {
  // Cart
  cart: CartItem[]
  addToCart: (item: Omit<CartItem, 'id' | 'tempId'>) => void
  updateCartItem: (tempId: string, updates: Partial<CartItem>) => void
  removeFromCart: (tempId: string) => void
  clearCart: () => void
  
  // Register
  registerId: number
  setRegisterId: (id: number) => void
  
  // Offline queue
  offlineQueue: OfflineOperation[]
  addToQueue: (op: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>) => void
  processQueue: () => Promise<void>
  clearQueue: () => void
  
  // Sync status
  isOnline: boolean
  setIsOnline: (online: boolean) => void
  pendingCount: number
  lastSync: number | null
  setLastSync: (timestamp: number) => void
  
  // UI State
  isSidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  
  // Current sale (for editing/refund)
  currentSale: Sale | null
  setCurrentSale: (sale: Sale | null) => void
}

interface OfflineOperation {
  id: string
  entityType: 'sale' | 'inventory_movement' | 'customer'
  operation: 'create' | 'update' | 'delete'
  payload: any
  timestamp: number
  retryCount: number
  status: 'pending' | 'processing' | 'synced' | 'failed' | 'conflict'
}

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      // Cart
      cart: [],
      addToCart: (item) => set((state) => {
        // Check if same product+variant+modifiers exists
        const existingIndex = state.cart.findIndex(
          (i) => i.productId === item.productId && 
                 i.variantId === item.variantId &&
                 JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers)
        )
        
        if (existingIndex >= 0) {
          const newCart = [...state.cart]
          newCart[existingIndex] = {
            ...newCart[existingIndex],
            quantity: newCart[existingIndex].quantity + item.quantity,
          }
          return { cart: newCart }
        }
        
        return {
          cart: [...state.cart, { ...item, tempId: uuidv4() }],
        }
      }),
      
      updateCartItem: (tempId, updates) => set((state) => ({
        cart: state.cart.map((item) =>
          item.tempId === tempId ? { ...item, ...updates } : item
        ),
      })),
      
      removeFromCart: (tempId) => set((state) => ({
        cart: state.cart.filter((item) => item.tempId !== tempId),
      })),
      
      clearCart: () => set({ cart: [] }),
      
      // Register
      registerId: 1,
      setRegisterId: (id) => set({ registerId: id }),
      
      // Offline queue
      offlineQueue: [],
      addToQueue: (op) => set((state) => ({
        offlineQueue: [...state.offlineQueue, {
          ...op,
          id: uuidv4(),
          timestamp: Date.now(),
          retryCount: 0,
          status: 'pending',
        }],
        pendingCount: state.pendingCount + 1,
      })),
      
      processQueue: async () => {
        const { offlineQueue, isOnline } = get()
        if (!isOnline || offlineQueue.length === 0) return
        
        const pending = offlineQueue.filter((op) => op.status === 'pending')
        if (pending.length === 0) return
        
        // Process each operation
        for (const op of pending) {
          set((state) => ({
            offlineQueue: state.offlineQueue.map((o) =>
              o.id === op.id ? { ...o, status: 'processing' as const } : o
            ),
          }))
          
          try {
            // Call appropriate API based on entityType
            const { salesApi, inventoryApi } = await import('@/features/pos/api')
            
            switch (op.entityType) {
              case 'sale':
                await salesApi.create(op.payload)
                break
              case 'inventory_movement':
                await inventoryApi.adjust(op.payload)
                break
              // Add more as needed
            }
            
            set((state) => ({
              offlineQueue: state.offlineQueue.map((o) =>
                o.id === op.id ? { ...o, status: 'synced' as const, syncedAt: Date.now() } : o
              ),
              pendingCount: Math.max(0, state.pendingCount - 1),
            }))
            
            set({ lastSync: Date.now() })
          } catch (error) {
            set((state) => ({
              offlineQueue: state.offlineQueue.map((o) =>
                o.id === op.id
                  ? { ...o, status: 'failed' as const, retryCount: o.retryCount + 1, lastError: String(error) }
                  : o
              ),
            }))
          }
        }
      },
      
      clearQueue: () => set({ offlineQueue: [], pendingCount: 0 }),
      
      // Sync status
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      setIsOnline: (online) => set({ isOnline: online }),
      pendingCount: 0,
      lastSync: null,
      setLastSync: (timestamp) => set({ lastSync: timestamp }),
      
      // UI State
      isSidebarOpen: true,
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      
      // Current sale
      currentSale: null,
      setCurrentSale: (sale) => set({ currentSale: sale }),
    }),
    {
      name: 'pos-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cart: state.cart,
        registerId: state.registerId,
        offlineQueue: state.offlineQueue,
        pendingCount: state.pendingCount,
        lastSync: state.lastSync,
        isSidebarOpen: state.isSidebarOpen,
      }),
    }
  )
)