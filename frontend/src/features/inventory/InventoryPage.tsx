'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'
import { Plus, Search, Loader2, Download, AlertTriangle, Package, Utensils, ClipboardList, Truck } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Badge } from '@/shared/ui/Badge'
import { formatCOP, formatDate } from '@/shared/utils/cn'
import { api } from '@/shared/utils/api'
import type { Product, Ingredient, InventoryMovement, PurchaseOrder, StockCount } from '@/shared/types/pos'

export function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'movements' | 'adjustments' | 'purchase-orders' | 'counts'>('overview')
  const queryClient = useQueryClient()
  
  // Overview data
  const { data: valuation } = useQuery({
    queryKey: ['reports', 'inventory', 'valuation'],
    queryFn: async () => {
      const { data } = await api.get('/reports/inventory/valuation')
      return data
    },
  })
  
  const { data: lowStock } = useQuery({
    queryKey: ['reports', 'inventory', 'low-stock'],
    queryFn: async () => {
      const { data } = await api.get('/reports/inventory/low-stock')
      return data
    },
  })
  
  // Products & Ingredients for adjustments
  const { data: products } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: async () => {
      const { data } = await api.get('/products', { params: { is_active: true, limit: 200 } })
      return data
    },
  })
  
  const { data: ingredients } = useQuery({
    queryKey: ['ingredients', 'all'],
    queryFn: async () => {
      const { data } = await api.get('/ingredients', { params: { is_active: true, limit: 200 } })
      return data
    },
  })
  
  // Movements
  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ['inventory', 'movements'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/movements', { params: { limit: 100 } })
      return data
    },
  })
  
  // Purchase Orders
  const { data: posData } = useQuery({
    queryKey: ['purchase-orders', 'list'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/purchase-orders', { params: { limit: 50 } })
      return data
    },
  })
  
  // Stock Counts
  const { data: countsData } = useQuery({
    queryKey: ['stock-counts', 'list'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/counts', { params: { limit: 50 } })
      return data
    },
  })
  
  const adjustmentMutation = useMutation({
    mutationFn: (adj: any) => api.post('/inventory/adjustments', adj),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'movements'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'inventory', 'valuation'] })
      queryClient.invalidateQueries({ queryKey: ['reports', 'inventory', 'low-stock'] })
    },
  })
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-muted-foreground">Control de stock, movimientos, compras y conteos</p>
        </div>
      </div>
      
      {/* Overview KPIs */}
      {activeTab === 'overview' && valuation && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total Inventario</p>
                  <p className="text-2xl font-bold">{formatCOP(valuation.total_value)}</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Productos</p>
                  <p className="text-2xl font-bold">{formatCOP(valuation.products_value)}</p>
                </div>
                <Package className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Ingredientes</p>
                  <p className="text-2xl font-bold">{formatCOP(valuation.ingredients_value)}</p>
                </div>
                <Utensils className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Alertas Stock Bajo</p>
                  <p className="text-2xl font-bold text-orange-600">{lowStock?.length || 0}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </Card>
        )}
      
      {/* Low Stock Alerts */}
      {activeTab === 'overview' && lowStock && lowStock.length > 0 && (
        <Card className="mb-6 border-orange-500/50">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h3 className="font-semibold text-orange-800">Productos/Ingredientes con Stock Bajo</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Nombre</th>
                    <th className="pb-2 font-medium text-right">Stock Actual</th>
                    <th className="pb-2 font-medium text-right">Stock Mín</th>
                    <th className="pb-2 font-medium text-right">Déficit</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.slice(0, 10).map((item, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2">{item.type === 'product' ? <Package className="h-4 w-4" /> : <Utensils className="h-4 w-4" />}</td>
                      <td className="py-2 font-medium">{item.name}</td>
                      <td className="py-2 text-right text-destructive">{item.current_stock} {item.unit}</td>
                      <td className="py-2 text-right">{item.min_stock} {item.unit}</td>
                      <td className="py-2 text-right font-medium text-destructive">{item.min_stock - item.current_stock} {item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
          <TabsTrigger value="adjustments">Ajustes</TabsTrigger>
          <TabsTrigger value="purchase-orders">Compras</TabsTrigger>
          <TabsTrigger value="counts">Conteos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <div className="mt-6 space-y-4">
            <Card>
              <div className="p-4">
                <h3 className="font-semibold mb-4">Valor por Categoría</h3>
                <div className="space-y-3">
                  {valuation?.by_category?.map((cat: any) => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <span>{cat.category}</span>
                      <div className="text-right">
                        <p className="font-medium">{formatCOP(cat.value)}</p>
                        <p className="text-sm text-muted-foreground">{cat.items} items</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="movements">
          <div className="mt-4">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="pb-3 font-medium">Fecha</th>
                      <th className="pb-3 font-medium">Tipo</th>
                      <th className="pb-3 font-medium">Referencia</th>
                      <th className="pb-3 font-medium">Cantidad</th>
                      <th className="pb-3 font-medium">Motivo</th>
                      <th className="pb-3 font-medium">Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementsLoading ? (
                      <tr><td colSpan={6} className="py-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></td></tr>
                    ) : movementsData?.length === 0 ? (
                      <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No hay movimientos</td></tr>
                    ) : (
                      movementsData!.map((mov: InventoryMovement, i) => (
                        <tr key={i} className="border-b hover:bg-muted/50">
                          <td className="py-3 text-sm">{formatDate(mov.created_at)}</td>
                          <td className="py-3">
                            <Badge variant={
                              mov.type === 'entry' ? 'success' :
                              mov.type === 'exit' ? 'destructive' :
                              mov.type === 'sale' ? 'default' :
                              mov.type === 'refund' ? 'warning' : 'secondary'
                            }>
                              {mov.type}
                            </Badge>
                          </td>
                          <td className="py-3 text-sm">{mov.reference_type}: {mov.reference_id} {mov.reference ? `(${mov.reference})` : ''}</td>
                          <td className="py-3 text-right font-mono">
                            <span className={mov.quantity > 0 ? 'text-green-600' : 'text-destructive'}>
                              {mov.quantity > 0 ? '+' : ''}{mov.quantity.toLocaleString('es-CO', {minimumFractionDigits: 3, maximumFractionDigits: 3})}
                            </span>
                          </td>
                          <td className="py-3 text-sm">{mov.reason}</td>
                          <td className="py-3 text-sm">{mov.user?.name || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="adjustments">
          <InventoryAdjustmentForm
            products={products || []}
            ingredients={ingredients || []}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['inventory', 'movements'] })}
          />
        </TabsContent>
        
        <TabsContent value="purchase-orders">
          <PurchaseOrdersTab
            purchaseOrders={posData || []}
            products={products || []}
            ingredients={ingredients || []}
            queryClient={queryClient}
          />
        </TabsContent>
        
        <TabsContent value="counts">
          <StockCountsTab
            counts={countsData || []}
            products={products || []}
            ingredients={ingredients || []}
            queryClient={queryClient}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Adjustment Form Component
function InventoryAdjustmentForm({ products, ingredients, onSuccess }: any) {
  const [formData, setFormData] = useState({
    reference_type: 'product',
    reference_id: '',
    type: 'entry',
    quantity: 1,
    unit_cost: 0,
    reason: 'compra',
    reference: '',
    notes: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await api.post('/inventory/adjustments', {
        ...formData,
        reference_id: parseInt(formData.reference_id),
        quantity: parseFloat(formData.quantity),
        unit_cost: parseFloat(formData.unit_cost) || undefined,
      })
      onSuccess()
      setFormData({ reference_type: 'product', reference_id: '', type: 'entry', quantity: 1, unit_cost: 0, reason: 'compra', reference: '', notes: '' })
    } catch (error) {
      alert('Error al registrar ajuste')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const allItems = [
    ...(products || []).map(p => ({ id: p.id, name: p.name, sku: p.sku, unit: p.unit, type: 'product' as const })),
    ...(ingredients || []).map(i => ({ id: i.id, name: i.name, sku: '', unit: i.unit, type: 'ingredient' as const })),
  ]
  
  return (
    <Card className="mt-4">
      <div className="p-6">
        <h3 className="font-semibold mb-4">Registrar Ajuste de Inventario</h3>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de referencia *</label>
              <select value={formData.reference_type} onChange={e => setFormData({...formData, reference_type: e.target.value, reference_id: ''})} className="w-full border rounded-lg px-3 py-2">
                <option value="product">Producto</option>
                <option value="ingredient">Ingrediente</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Artículo *</label>
              <select value={formData.reference_id} onChange={e => setFormData({...formData, reference_id: e.target.value})} className="w-full border rounded-lg px-3 py-2" required>
                <option value="">Seleccionar...</option>
                {allItems.filter(item => item.type === formData.reference_type).map(item => (
                  <option key={item.id} value={item.id}>{item.name} {item.sku ? `(${item.sku})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de movimiento *</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full border rounded-lg px-3 py-2" required>
                <option value="entry">Entrada (+)</option>
                <option value="exit">Salida (-)</option>
                <option value="adjustment">Ajuste (=)</option>
              </select>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cantidad *</label>
              <Input type="number" step="0.001" min="0.001" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Costo unitario</label>
              <Input type="number" step="0.01" min="0" value={formData.unit_cost} onChange={e => setFormData({...formData, unit_cost: parseFloat(e.target.value) || 0})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Motivo *</label>
              <select value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} className="w-full border rounded-lg px-3 py-2" required>
                <option value="compra">Compra</option>
                <option value="venta">Venta</option>
                <option value="merma">Merma/Pérdida</option>
                <option value="ajuste">Ajuste</option>
                <option value="devolucion">Devolución</option>
                <option value="transferencia">Transferencia</option>
                <option value="conteo">Conteo físico</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Referencia (OC, Nota, etc.)</label>
              <Input value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} placeholder="OC-123, Nota-456" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Notas</label>
            <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full border rounded-lg px-3 py-2 min-h-[80px]" rows={3} placeholder="Observaciones adicionales..." />
          </div>
          
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Registrando...' : 'Registrar Ajuste'}
          </Button>
        </form>
      </div>
    </Card>
  )
}

// Purchase Orders Tab
function PurchaseOrdersTab({ purchaseOrders, products, ingredients, queryClient }: any) {
  const [showForm, setShowForm] = useState(false)
  const [editingPO, setEditingPO] = useState<any>(null)
  
  // Simplified - would need full implementation
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Órdenes de Compra</h3>
        <Button onClick={() => { setEditingPO(null); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Orden
        </Button>
      </div>
      
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Nº OC</th>
                <th className="pb-3 font-medium">Proveedor</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Fecha Esperada</th>
                <th className="pb-3 font-medium">Total</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No hay órdenes de compra</td></tr>
              ) : (
                purchaseOrders.map((po: any) => (
                  <tr key={po.id} className="border-b hover:bg-muted/50">
                    <td className="py-4 font-mono">{po.po_number}</td>
                    <td className="py-4">{po.supplier_name}</td>
                    <td className="py-4">
                      <Badge variant={
                        po.status === 'received' ? 'success' :
                        po.status === 'sent' ? 'default' :
                        po.status === 'draft' ? 'secondary' : 'destructive'
                      }>{po.status}</Badge>
                    </td>
                    <td className="py-4">{po.expected_date ? formatDate(po.expected_date) : '—'}</td>
                    <td className="py-4 text-right font-medium">{formatCOP(po.total_amount)}</td>
                    <td className="py-4 text-right">
                      <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// Stock Counts Tab
function StockCountsTab({ counts, products, ingredients, queryClient }: any) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Conteos de Inventario</h3>
        <Button onClick={() => setShowCountForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Conteo
        </Button>
      </div>
      
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Nombre</th>
                <th className="pb-3 font-medium">Tipo</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Iniciado</th>
                <th className="pb-3 font-medium">Completado</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {counts.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No hay conteos registrados</td></tr>
              ) : (
                counts.map((c: StockCount) => (
                  <tr key={c.id} className="border-b hover:bg-muted/50">
                    <td className="py-4 font-medium">{c.name}</td>
                    <td className="py-4">
                      <Badge variant={c.type === 'full' ? 'default' : c.type === 'partial' ? 'secondary' : 'outline'}>{c.type}</Badge>
                    </td>
                    <td className="py-4">
                      <Badge variant={
                        c.status === 'completed' ? 'success' :
                        c.status === 'in_progress' ? 'default' : 'secondary'
                      }>{c.status}</Badge>
                    </td>
                    <td className="py-4">{formatDate(c.started_at)}</td>
                    <td className="py-4">{c.completed_at ? formatDate(c.completed_at) : '—'}</td>
                    <td className="py-4 text-right">
                      <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}