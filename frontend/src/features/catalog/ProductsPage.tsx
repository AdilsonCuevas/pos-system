'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Loader2, Edit, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Badge } from '@/shared/ui/Badge'
import { formatCOP } from '@/shared/utils/cn'
import { api } from '@/shared/utils/api'
import type { Product, Category } from '@/shared/types/pos'

export function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  
  const { data, isLoading } = useQuery({
    queryKey: ['products', 'list', search],
    queryFn: async () => {
      const { data } = await api.get<Product[]>('/products', {
        params: { search, limit: 100 },
      })
      return data
    },
  })
  
  const { data: categories } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: async () => {
      const { data } = await api.get<Category[]>('/categories/tree')
      return data
    },
  })
  
  const createMutation = useMutation({
    mutationFn: (product: Partial<Product>) => api.post('/products', product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setShowForm(false)
    },
  })
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Product> }) => api.put(`/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setEditingProduct(null)
    },
  })
  
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  })
  
  const products = data || []
  
  const handleSubmit = (productData: any) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: productData })
    } else {
      createMutation.mutate(productData)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-muted-foreground">Gestiona tu catálogo de productos</p>
        </div>
        <Button onClick={() => { setEditingProduct(null); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Producto
        </Button>
      </div>
      
      {/* Search */}
      <div className="relative max-w-md">
        <Input
          placeholder="Buscar por nombre, SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>
      
      {/* Products Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Producto</th>
                <th className="pb-3 font-medium">SKU</th>
                <th className="pb-3 font-medium">Categoría</th>
                <th className="pb-3 font-medium text-right">Precio</th>
                <th className="pb-3 font-medium text-right">Stock</th>
                <th className="pb-3 font-medium">Tipo</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No hay productos. Haz clic en "Nuevo Producto" para comenzar.
                  </td>
                </tr>
              ) : (
                products.map(product => (
                  <tr key={product.id} className="border-b hover:bg-muted/50">
                    <td className="py-4">
                      <div className="font-medium">{product.name}</div>
                      {product.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">{product.description}</div>
                      )}
                    </td>
                    <td className="py-4 font-mono text-sm">{product.sku}</td>
                    <td className="py-4">
                      {categories?.flatMap(c => [c, ...(c.children || [])]).find(c => c.id === product.category_id)?.name || '—'}
                    </td>
                    <td className="py-4 text-right font-medium">{formatCOP(product.price)}</td>
                    <td className="py-4 text-right">
                      {product.track_stock ? (
                        <span className={product.current_stock <= product.min_stock && product.min_stock > 0 ? 'text-destructive' : ''}>
                          {product.current_stock} {product.unit}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No track</span>
                      )}
                    </td>
                    <td className="py-4">
                      <Badge variant={product.type === 'composite' ? 'default' : 'secondary'}>
                        {product.type === 'composite' ? 'Receta' : 'Simple'}
                      </Badge>
                    </td>
                    <td className="py-4">
                      <Badge variant={product.is_active ? 'success' : 'secondary'}>
                        {product.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingProduct(product); setShowForm(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(product.id)} disabled={deleteMutation.isPending}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Product Form Modal */}
      {(showForm || editingProduct) && (
        <ProductFormModal
          product={editingProduct}
          categories={categories || []}
          onClose={() => { setShowForm(false); setEditingProduct(null); }}
          onSubmit={handleSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  )
}

function ProductFormModal({
  product,
  categories,
  onClose,
  onSubmit,
  isLoading,
}: {
  product: Product | null
  categories: Category[]
  onClose: () => void
  onSubmit: (data: any) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    type: 'simple' as 'simple' | 'composite',
    unit: 'pza',
    price: 0,
    cost: 0,
    tax_rate: 0.19,
    category_id: '',
    track_stock: true,
    min_stock: 0,
    current_stock: 0,
    image_url: '',
  })
  
  useState(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku,
        description: product.description || '',
        type: product.type,
        unit: product.unit,
        price: product.price,
        cost: product.cost,
        tax_rate: product.tax_rate,
        category_id: String(product.category_id),
        track_stock: product.track_stock,
        min_stock: product.min_stock,
        current_stock: product.current_stock,
        image_url: product.image_url || '',
      })
    }
  }, [product])
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }
  
  const units = ['pza', 'kg', 'g', 'L', 'ml', 'm', 'cm', 'pack', 'caja', 'bolsa', 'lata', 'botella', 'porcion', 'plato']
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-card rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">{product ? 'Editar Producto' : 'Nuevo Producto'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">SKU *</label>
              <Input value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full border rounded-lg px-3 py-2">
                <option value="simple">Simple</option>
                <option value="composite">Compuesto (Receta)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unidad</label>
              <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full border rounded-lg px-3 py-2">
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Precio *</label>
              <Input type="number" step="0.01" min="0" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Costo</label>
              <Input type="number" step="0.01" min="0" value={formData.cost} onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">IVA</label>
              <select value={formData.tax_rate} onChange={e => setFormData({...formData, tax_rate: parseFloat(e.target.value)})} className="w-full border rounded-lg px-3 py-2">
                <option value="0">Exento (0%)</option>
                <option value="0.05">5%</option>
                <option value="0.19">19% (General)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoría *</label>
              <select value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} className="w-full border rounded-lg px-3 py-2" required>
                {categories.flatMap(c => [c, ...(c.children || [])]).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.parent_id ? `  └ ${cat.name}` : cat.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Stock actual</label>
              <Input type="number" step="0.001" min="0" value={formData.current_stock} onChange={e => setFormData({...formData, current_stock: parseFloat(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock mínimo</label>
              <Input type="number" step="0.001" min="0" value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: parseFloat(e.target.value)})} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.track_stock} onChange={e => setFormData({...formData, track_stock: e.target.checked})} className="rounded border-input" />
                <span className="text-sm">Controlar stock</span>
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border rounded-lg px-3 py-2 min-h-[80px]" rows={3} />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : (product ? 'Actualizar' : 'Crear')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}