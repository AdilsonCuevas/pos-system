'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Loader2, Edit, Trash2, ArrowUpDown, Package } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Badge } from '@/shared/ui/Badge'
import { formatCOP } from '@/shared/utils/cn'
import { api } from '@/shared/utils/api'
import type { Ingredient } from '@/shared/types/pos'

export function IngredientsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  
  const { data, isLoading } = useQuery({
    queryKey: ['ingredients', 'list', search],
    queryFn: async () => {
      const { data } = await api.get<Ingredient[]>('/ingredients', { params: { search, limit: 100 } })
      return data
    },
  })
  
  const createMutation = useMutation({
    mutationFn: (ingredient: Partial<Ingredient>) => api.post('/ingredients', ingredient),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ingredients'] }); setShowForm(false); },
  })
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Ingredient> }) => api.put(`/ingredients/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ingredients'] }); setEditingIngredient(null); },
  })
  
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/ingredients/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ingredients'] }),
  })
  
  const adjustMutation = useMutation({
    mutationFn: ({ id, adjustment }: { id: number; adjustment: { type: string; quantity: number; reason: string; notes?: string } }) => 
      api.post(`/ingredients/${id}/adjust`, adjustment),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ingredients'] }),
  })
  
  const ingredients = data || []
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ingredientes</h1>
          <p className="text-muted-foreground">Gestiona materias primas y stock para recetas</p>
        </div>
        <Button onClick={() => { setEditingIngredient(null); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Ingrediente
        </Button>
      </div>
      
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar ingrediente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>
      
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Ingrediente</th>
                <th className="pb-3 font-medium">Unidad</th>
                <th className="pb-3 font-medium text-right">Costo/Unidad</th>
                <th className="pb-3 font-medium text-right">Stock Actual</th>
                <th className="pb-3 font-medium text-right">Stock Mín</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></td></tr>
              ) : ingredients.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No hay ingredientes. Agrega tu primero.</td></tr>
              ) : (
                ingredients.map(ing => (
                  <tr key={ing.id} className="border-b hover:bg-muted/50">
                    <td className="py-4">
                      <div className="font-medium">{ing.name}</div>
                    </td>
                    <td className="py-4 text-center">{ing.unit}</td>
                    <td className="py-4 text-right font-mono">{formatCOP(ing.cost_per_unit)}/{ing.unit}</td>
                    <td className="py-4 text-right">
                      <span className={ing.current_stock <= ing.min_stock && ing.min_stock > 0 ? 'text-destructive font-medium' : ''}>
                        {ing.current_stock.toLocaleString('es-CO', {minimumFractionDigits: 3, maximumFractionDigits: 3})} {ing.unit}
                      </span>
                    </td>
                    <td className="py-4 text-right text-sm text-muted-foreground">{ing.min_stock} {ing.unit}</td>
                    <td className="py-4">
                      <Badge variant={ing.is_active ? 'success' : 'secondary'}>
                        {ing.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => adjustMutation.mutate({ id: ing.id, adjustment: { type: 'entry', quantity: 10, reason: 'compra', notes: 'Ajuste rápido +10' } })} title="Agregar stock +10">
                          <Package className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setEditingIngredient(ing); setShowForm(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(ing.id)} disabled={deleteMutation.isPending}>
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
      
      {(showForm || editingIngredient) && (
        <IngredientFormModal
          ingredient={editingIngredient}
          onClose={() => { setShowForm(false); setEditingIngredient(null); }}
          onSubmit={data => editingIngredient ? updateMutation.mutate({ id: editingIngredient.id, data }) : createMutation.mutate(data)}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  )
}

function IngredientFormModal({
  ingredient,
  onClose,
  onSubmit,
  isLoading,
}: {
  ingredient: Ingredient | null
  onClose: () => void
  onSubmit: (data: any) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    name: '',
    unit: 'g',
    cost_per_unit: 0,
    current_stock: 0,
    min_stock: 0,
    is_active: true,
  })
  
  useState(() => {
    if (ingredient) {
      setFormData({
        name: ingredient.name,
        unit: ingredient.unit,
        cost_per_unit: ingredient.cost_per_unit,
        current_stock: ingredient.current_stock,
        min_stock: ingredient.min_stock,
        is_active: ingredient.is_active,
      })
    }
  }, [ingredient])
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }
  
  const units = ['g', 'kg', 'ml', 'L', 'unidad', 'cucharada', 'cucharadita', 'taza', 'pizca', 'gotas']
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-card rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">{ingredient ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Unidad *</label>
            <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full border rounded-lg px-3 py-2" required>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Costo por unidad *</label>
              <Input type="number" step="0.0001" min="0" value={formData.cost_per_unit} onChange={e => setFormData({...formData, cost_per_unit: parseFloat(e.target.value)})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock actual</label>
              <Input type="number" step="0.001" min="0" value={formData.current_stock} onChange={e => setFormData({...formData, current_stock: parseFloat(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock mínimo</label>
              <Input type="number" step="0.001" min="0" value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: parseFloat(e.target.value)})} />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="rounded border-input" />
            <label htmlFor="is_active" className="text-sm">Activo</label>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : (ingredient ? 'Actualizar' : 'Crear')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}