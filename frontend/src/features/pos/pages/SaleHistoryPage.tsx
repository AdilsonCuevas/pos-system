'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Download, Loader2, Search, Eye, Receipt } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Badge } from '@/shared/ui/Badge'
import { formatCOP, formatDate, formatDateTime } from '@/shared/utils/cn'
import { api } from '@/shared/utils/api'
import type { Sale } from '@/shared/types/pos'

interface SalesResponse {
  sales: Sale[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export function SaleHistoryPage() {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    status: '',
    search: '',
    page: 1,
    page_size: 20,
  })
  
  const today = new Date().toISOString().split('T')[0]
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  
  if (!filters.from) setFilters({...filters, from: firstDay, to: today})
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sales', 'history', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, String(v))
      })
      const { data } = await api.get<SalesResponse>(`/sales?${params}`)
      return data
    },
  })
  
  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, String(v)) })
      const { data } = await api.get('/reports/export/sales', { params, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `ventas-${filters.from}-${filters.to}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Export error:', error)
      alert('Error al exportar')
    }
  }
  
  const sales = data?.sales || []
  const total = data?.total || 0
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Historial de Ventas</h1>
          <p className="text-muted-foreground">Consulta y gestiona todas las transacciones</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={isLoading}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value, page: 1})} className="w-[160px]" />
            <span className="text-muted-foreground">a</span>
            <Input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value, page: 1})} className="w-[160px]" />
          </div>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar (Nº venta, cliente)..."
              value={filters.search}
              onChange={e => setFilters({...filters, search: e.target.value, page: 1})}
              className="pl-10"
            />
          </div>
          <select
            value={filters.status}
            onChange={e => setFilters({...filters, status: e.target.value, page: 1})}
            className="border rounded-lg px-3 py-2 w-[180px]"
          >
            <option value="">Todos los estados</option>
            <option value="completed">Completada</option>
            <option value="refunded">Devuelta</option>
            <option value="voided">Anulada</option>
            <option value="pending">Pendiente</option>
          </select>
          <Button onClick={() => refetch()}>
            <Loader2 className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </Card>
      
      {/* Sales Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Nº Venta</th>
                <th className="pb-3 font-medium">Fecha</th>
                <th className="pb-3 font-medium">Cliente</th>
                <th className="pb-3 font-medium">Cajero</th>
                <th className="pb-3 font-medium text-right">Total</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Pago</th>
                <th className="pb-3 font-medium">FDE</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="py-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No se encontraron ventas</td></tr>
              ) : (
                sales.map(sale => (
                  <tr key={sale.id} className="border-b hover:bg-muted/50">
                    <td className="py-4 font-mono text-sm">{sale.sale_number}</td>
                    <td className="py-4 text-sm">{formatDateTime(sale.created_at)}</td>
                    <td className="py-4">
                      {sale.customer_name ? (
                        <div>
                          <p className="font-medium">{sale.customer_name}</p>
                          {sale.customer_tax_id && <p className="text-xs text-muted-foreground">{sale.customer_tax_id}</p>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Consumidor final</span>
                      )}
                    </td>
                    <td className="py-4 text-sm">{sale.user?.name || '—'}</td>
                    <td className="py-4 text-right font-medium">{formatCOP(sale.total)}</td>
                    <td className="py-4">
                      <Badge variant={
                        sale.status === 'completed' ? 'success' :
                        sale.status === 'refunded' ? 'warning' :
                        sale.status === 'voided' ? 'destructive' : 'secondary'
                      }>
                        {sale.status === 'completed' ? 'Completada' :
                         sale.status === 'refunded' ? 'Devuelta' :
                         sale.status === 'voided' ? 'Anulada' : 'Pendiente'}
                      </Badge>
                    </td>
                    <td className="py-4 text-sm">
                      {sale.payment_method?.map((p: any) => `${p.method}: ${formatCOP(p.amount)}`).join(', ') || '—'}
                    </td>
                    <td className="py-4">
                      {sale.fde_document ? (
                        <Badge variant={
                          sale.fde_document.status === 'authorized' ? 'success' :
                          sale.fde_document.status === 'rejected' ? 'destructive' :
                          sale.fde_document.status === 'cancelled' ? 'destructive' : 'warning'
                        }>
                          {sale.fde_document.status === 'authorized' ? 'Autorizado' :
                           sale.fde_document.status === 'rejected' ? 'Rechazado' :
                           sale.fde_document.status === 'cancelled' ? 'Anulado' : 'Pendiente'}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => window.open(`/api/sales/${sale.id}/receipt?format=html`, '_blank')}>
                          <Receipt className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => window.open(`/api/sales/${sale.id}/receipt?format=pdf`, '_blank')}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Mostrando {((data.page - 1) * data.page_size) + 1} a {Math.min(data.page * data.page_size, data.total)} de {data.total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setFilters({...filters, page: 1})} disabled={filters.page === 1}>Primera</Button>
              <Button variant="outline" size="sm" onClick={() => setFilters({...filters, page: filters.page - 1})} disabled={filters.page === 1}>Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => setFilters({...filters, page: filters.page + 1})} disabled={filters.page === data.total_pages}>Siguiente</Button>
              <Button variant="outline" size="sm" onClick={() => setFilters({...filters, page: data.total_pages})} disabled={filters.page === data.total_pages}>Última</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}