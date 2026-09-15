'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Download, Loader2, BarChart3, TrendingUp, DollarSign, Package } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { formatCOP, formatDate } from '@/shared/utils/cn'
import { api } from '@/shared/utils/api'

interface SalesReport {
  period: string
  total_sales: number
  total_revenue: number
  avg_ticket: number
  by_payment_method: { method: string; amount: number; count: number }[]
  by_category: { category: string; revenue: number; count: number }[]
  by_hour: { hour: number; revenue: number }[]
}

interface InventoryValuation {
  total_value: number
  by_category: { category: string; value: number; items: number }[]
  low_stock_count: number
  zero_stock_count: number
}

interface RecipeCostAnalysis {
  product_id: number
  product_name: string
  sale_price: number
  recipe_cost: number
  margin_percent: number
  margin_amount: number
  ingredients: { name: string; quantity: number; unit: string; cost: number }[]
}

export function ReportsPage() {
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'recipes'>('sales')
  
  const today = new Date().toISOString().split('T')[0]
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  
  if (!dateRange.from) setDateRange({ from: firstDay, to: today })
  
  const { data: salesReport, isLoading: salesLoading } = useQuery({
    queryKey: ['reports', 'sales', dateRange],
    queryFn: async () => {
      const { data } = await api.get<SalesReport>('/reports/sales', { params: dateRange })
      return data
    },
    enabled: activeTab === 'sales',
  })
  
  const { data: inventoryValuation, isLoading: invLoading } = useQuery({
    queryKey: ['reports', 'inventory', 'valuation'],
    queryFn: async () => {
      const { data } = await api.get<InventoryValuation>('/reports/inventory/valuation')
      return data
    },
    enabled: activeTab === 'inventory',
  })
  
  const { data: recipeCosts, isLoading: recipeLoading } = useQuery({
    queryKey: ['reports', 'recipes', 'cost-analysis'],
    queryFn: async () => {
      const { data } = await api.get<RecipeCostAnalysis[]>('/reports/recipes/cost-analysis')
      return data
    },
    enabled: activeTab === 'recipes',
  })
  
  const handleExport = async (type: string) => {
    try {
      const { data } = await api.get(`/reports/export/${type}`, {
        params: dateRange,
        responseType: 'blob',
      })
      
      const url = window.URL.createObjectURL(new Blob([data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `reporte-${type}-${dateRange.from}-${dateRange.to}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Export error:', error)
      alert('Error al exportar reporte')
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">Análisis de ventas, inventario y costos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('sales')} disabled={activeTab !== 'sales' || salesLoading}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Ventas
          </Button>
          <Button variant="outline" onClick={() => handleExport('inventory')} disabled={activeTab !== 'inventory' || invLoading}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Inventario
          </Button>
        </div>
      </div>
      
      {/* Date Range & Tabs */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="w-[160px]" />
              <span className="text-muted-foreground">a</span>
              <Input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="w-[160px]" />
            </div>
          </div>
          
          <div className="flex gap-1">
            {[
              { id: 'sales', label: 'Ventas', icon: BarChart3 },
              { id: 'inventory', label: 'Inventario', icon: Package },
              { id: 'recipes', label: 'Costos Recetas', icon: DollarSign },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </Card>
      
      {/* Sales Report */}
      {activeTab === 'sales' && salesReport && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ventas Totales</p>
                    <p className="text-2xl font-bold">{salesReport.total_sales.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ingresos Totales</p>
                    <p className="text-2xl font-bold">{formatCOP(salesReport.total_revenue)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ticket Promedio</p>
                    <p className="text-2xl font-bold">{formatCOP(salesReport.avg_ticket)}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Métodos de Pago</p>
                    <p className="text-2xl font-bold">{salesReport.by_payment_method.length}</p>
                  </div>
                  <Package className="h-8 w-8 text-purple-600" />
                </div>
              </div>
            </Card>
          </div>
          
          {/* Payment Methods */}
          <Card>
            <div className="p-6">
              <h3 className="font-semibold mb-4">Por Método de Pago</h3>
              <div className="space-y-3">
                {salesReport.by_payment_method.map((pm, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-bold">{pm.method.charAt(0)}</span>
                      </div>
                      <span className="font-medium capitalize">{pm.method}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCOP(pm.amount)}</p>
                      <p className="text-sm text-muted-foreground">{pm.count} transacciones</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          
          {/* By Category */}
          <Card>
            <div className="p-6">
              <h3 className="font-semibold mb-4">Por Categoría</h3>
              <div className="space-y-3">
                {salesReport.by_category.map((cat, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="font-medium">{cat.category}</span>
                    <div className="text-right">
                      <p className="font-semibold">{formatCOP(cat.revenue)}</p>
                      <p className="text-sm text-muted-foreground">{cat.count} ventas</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* Inventory Report */}
      {activeTab === 'inventory' && inventoryValuation && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <div className="p-6">
                <p className="text-sm text-muted-foreground">Valor Total Inventario</p>
                <p className="text-2xl font-bold">{formatCOP(inventoryValuation.total_value)}</p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <p className="text-sm text-muted-foreground">Categorías</p>
                <p className="text-2xl font-bold">{inventoryValuation.by_category.length}</p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <p className="text-sm text-muted-foreground">Stock Bajo</p>
                <p className="text-2xl font-bold text-orange-600">{inventoryValuation.low_stock_count}</p>
              </div>
            </Card>
            <Card>
              <div className="p-6">
                <p className="text-sm text-muted-foreground">Sin Stock</p>
                <p className="text-2xl font-bold text-destructive">{inventoryValuation.zero_stock_count}</p>
              </div>
            </Card>
          </div>
          
          <Card>
            <div className="p-6">
              <h3 className="font-semibold mb-4">Valor por Categoría</h3>
              <div className="space-y-3">
                {inventoryValuation.by_category.map((cat, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="font-medium">{cat.category}</span>
                    <div className="text-right">
                      <p className="font-semibold">{formatCOP(cat.value)}</p>
                      <p className="text-sm text-muted-foreground">{cat.items} items</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* Recipe Cost Analysis */}
      {activeTab === 'recipes' && recipeCosts && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h3 className="font-semibold mb-4">Análisis de Costos y Margenes</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="pb-3 font-medium">Producto</th>
                      <th className="pb-3 font-medium text-right">Precio Venta</th>
                      <th className="pb-3 font-medium text-right">Costo Receta</th>
                      <th className="pb-3 font-medium text-right">Margen %</th>
                      <th className="pb-3 font-medium text-right">Margen $</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipeCosts.map(recipe => (
                      <tr key={recipe.product_id} className="border-b">
                        <td className="py-4 font-medium">{recipe.product_name}</td>
                        <td className="py-4 text-right">{formatCOP(recipe.sale_price)}</td>
                        <td className="py-4 text-right">{formatCOP(recipe.recipe_cost)}</td>
                        <td className="py-4 text-right">
                          <span className={recipe.margin_percent < 30 ? 'text-destructive' : 'text-green-600'}>
                            {recipe.margin_percent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-4 text-right font-medium">{formatCOP(recipe.margin_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}