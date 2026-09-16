import { Calendar, Copy, Download, RefreshCw, Search, AlertTriangle, CheckCircle, XCircle, Clock, Eye, FileText } from 'lucide-react'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Badge } from '@/shared/ui/Badge'
import { formatCOP, formatDate, formatDateTime } from '@/shared/utils/cn'
import { api } from '@/shared/utils/api'
import type { FDEDocument } from '@/shared/types/pos'

export function FDEDocumentsPage() {
  const queryClient = useQueryClient()
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
  
  const { data, isLoading } = useQuery({
    queryKey: ['fde', 'documents', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, String(v)) })
      const { data } = await api.get<{ documents: FDEDocument[]; total: number }>(`/fde/documents?${params}`)
      return data
    },
  })
  
  const checkStatusMutation = useMutation({
    mutationFn: (id: number) => api.get(`/fde/documents/${id}/status`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fde', 'documents'] }),
  })
  
  const exportMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, String(v)) })
      const { data } = await api.get('/reports/export/fde', { params, responseType: 'blob' })
      return data
    },
    onSuccess: (data) => {
      const url = window.URL.createObjectURL(new Blob([data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `documentos-fde-${filters.from}-${filters.to}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    },
  })
  
  const documents = data?.documents || []
  const total = data?.total || 0
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'authorized': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'rejected': return <XCircle className="h-4 w-4 text-destructive" />
      case 'cancelled': return <XCircle className="h-4 w-4 text-destructive" />
      default: return <Clock className="h-4 w-4 text-yellow-600" />
    }
  }
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'authorized': return <Badge variant="success">Autorizado</Badge>
      case 'rejected': return <Badge variant="destructive">Rechazado</Badge>
      case 'cancelled': return <Badge variant="destructive">Anulado</Badge>
      default: return <Badge variant="warning">Pendiente</Badge>
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Documentos FDE (DIAN)</h1>
          <p className="text-muted-foreground">Gestiona facturas electrónicas, tiquetes POS y notas crédito/débito</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['fde', 'documents'] })}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
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
            <Input placeholder="Buscar (CUFE, Nº, cliente)..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value, page: 1})} className="pl-10" />
          </div>
          <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value, page: 1})} className="border rounded-lg px-3 py-2 w-[180px]">
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="authorized">Autorizado</option>
            <option value="rejected">Rechazado</option>
            <option value="cancelled">Anulado</option>
          </select>
        </div>
      </Card>
      
      {/* Documents Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Tipo</th>
                <th className="pb-3 font-medium">Nº Documento</th>
                <th className="pb-3 font-medium">Venta</th>
                <th className="pb-3 font-medium">Cliente</th>
                <th className="pb-3 font-medium">Fecha</th>
                <th className="pb-3 font-medium">Total</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">CUFE</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="py-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></td></tr>
              ) : documents.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No se encontraron documentos</td></tr>
              ) : (
                documents.map(doc => (
                  <tr key={doc.id} className="border-b hover:bg-muted/50">
                    <td className="py-4">
                      <Badge variant={
                        doc.document_type === 'invoice' ? 'default' :
                        doc.document_type === 'pos_ticket' ? 'secondary' :
                        doc.document_type === 'credit_note' ? 'warning' : 'destructive'
                      }>
                        {doc.document_type === 'invoice' ? 'Factura' :
                         doc.document_type === 'pos_ticket' ? 'Tiquete POS' :
                         doc.document_type === 'credit_note' ? 'Nota Crédito' : 'Nota Débito'}
                      </Badge>
                    </td>
                    <td className="py-4 font-mono text-sm">{doc.prefix}{doc.number.toString().padStart(10, '0')}</td>
                    <td className="py-4">{doc.sale?.sale_number || '—'}</td>
                    <td className="py-4">
                      {doc.sale?.customer_name ? (
                        <div>
                          <p className="font-medium">{doc.sale.customer_name}</p>
                          {doc.sale.customer_tax_id && <p className="text-xs text-muted-foreground">{doc.sale.customer_tax_id}</p>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Consumidor final</span>
                      )}
                    </td>
                    <td className="py-4 text-sm">{formatDateTime(doc.created_at)}</td>
                    <td className="py-4 text-right font-medium">{formatCOP(doc.sale?.total || 0)}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(doc.status)}
                        {getStatusBadge(doc.status)}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-muted-foreground truncate max-w-[150px]">{doc.cufe}</span>
                        <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(doc.cufe)} title="Copiar CUFE">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => window.open(`/api/fde/documents/${doc.id}/xml`, '_blank')} title="Ver XML">
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => window.open(`/api/fde/documents/${doc.id}/pdf`, '_blank')} title="Ver PDF">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {doc.status === 'pending' && (
                          <Button variant="ghost" size="icon" onClick={() => checkStatusMutation.mutate(doc.id)} disabled={checkStatusMutation.isPending} title="Verificar estado DIAN">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
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

function getStatusIcon(status: string) {
  const { CheckCircle, XCircle, Clock } = require('lucide-react')
  switch (status) {
    case 'authorized': return <CheckCircle className="h-4 w-4 text-green-600" />
    case 'rejected': return <XCircle className="h-4 w-4 text-destructive" />
    case 'cancelled': return <XCircle className="h-4 w-4 text-destructive" />
    default: return <Clock className="h-4 w-4 text-yellow-600" />
  }
}

function getStatusBadge(status: string) {
  const { Badge } = require('@/shared/ui/Badge')
  switch (status) {
    case 'authorized': return <Badge variant="success">Autorizado</Badge>
    case 'rejected': return <Badge variant="destructive">Rechazado</Badge>
    case 'cancelled': return <Badge variant="destructive">Anulado</Badge>
    default: return <Badge variant="warning">Pendiente</Badge>
  }
}