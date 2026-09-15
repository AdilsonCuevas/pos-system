import api from '@/shared/utils/api'
import type { Sale, SaleCreate, OfflineSale, SaleResponse, SaleFilters } from '@/shared/types/pos'
import type { InventoryAdjustment, InventoryMovement } from '@/shared/types/inventory'

export const salesApi = {
  create: async (sale: SaleCreate): Promise<SaleResponse> => {
    const { data } = await api.post<SaleResponse>('/sales', sale)
    return data
  },
  
  sync: async (sales: OfflineSale[]): Promise<{ synced: string[]; failed: any[]; conflicts: any[] }> => {
    const { data } = await api.post('/sales/sync', { sales })
    return data
  },
  
  list: async (filters?: SaleFilters) => {
    const params = new URLSearchParams()
    if (filters?.from) params.append('from', filters.from)
    if (filters?.to) params.append('to', filters.to)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.page) params.append('page', String(filters.page))
    if (filters?.pageSize) params.append('page_size', String(filters.pageSize))
    
    const { data } = await api.get<Sale[]>(`/sales?${params}`)
    return data
  },
  
  get: async (id: number): Promise<Sale> => {
    const { data } = await api.get<Sale>(`/sales/${id}`)
    return data
  },
  
  refund: async (id: number, items: { saleItemId: number; quantity: number }[], reason: string) => {
    const { data } = await api.post(`/sales/${id}/refund`, { items, reason })
    return data
  },
  
  receipt: async (id: number, format: 'escpos' | 'pdf' | 'html' = 'escpos'): Promise<Blob> => {
    const { data } = await api.get(`/sales/${id}/receipt`, {
      params: { format },
      responseType: 'blob',
    })
    return data
  },
}

export const inventoryApi = {
  adjust: async (adjustment: InventoryAdjustment): Promise<InventoryMovement> => {
    const { data } = await api.post<InventoryMovement>('/inventory/adjustments', adjustment)
    return data
  },
  
  listMovements: async (filters?: { from?: string; to?: string; type?: string; productId?: number }) => {
    const params = new URLSearchParams()
    if (filters?.from) params.append('from', filters.from)
    if (filters?.to) params.append('to', filters.to)
    if (filters?.type) params.append('type', filters.type)
    if (filters?.productId) params.append('product_id', String(filters.productId))
    
    const { data } = await api.get<InventoryMovement[]>(`/inventory/movements?${params}`)
    return data
  },
  
  lowStock: async () => {
    const { data } = await api.get('/reports/inventory/low-stock')
    return data
  },
}