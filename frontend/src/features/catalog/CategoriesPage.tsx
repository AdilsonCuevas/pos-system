'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Loader2, Edit, Trash2, ChevronRight } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Badge } from '@/shared/ui/Badge'
import { formatCOP } from '@/shared/utils/cn'
import { api } from '@/shared/utils/api'
import type { Category } from '@/shared/types/pos'

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  
  const { data, isLoading } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: async () => {
      const { data } = await api.get<Category[]>('/categories/tree')
      return data
    },
  })
  
  const createMutation = useMutation({
    mutationFn: (category: Partial<Category>) => api.post('/categories', category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setShowForm(false)
    },
  })
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Category> }) => api.put(`/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setEditingCategory(null)
    },
  })
  
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })
  
  const categories = data || []
  
  const flattenCategories = (cats: Category[], level = 0): (Category & { level: number })[] => {
    return cats.flatMap(cat => [
      { ...cat, level },
      ...flattenCategories(cat.children || [], level + 1),
    ])
  }
  
  const flatCategories = flattenCategories(categories)
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categorías</h1>
          <p className="text-muted-foreground">Organiza tus productos en categorías y subcategorías</p>
        </div>
        <Button onClick={() => { setEditingCategory(null); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Categoría
        </Button>
      </div>
      
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Categoría</th>
                <th className="pb-3 font-medium">Orden</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="py-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></td></tr>
              ) : flatCategories.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No hay categorías</td></tr>
              ) : (
                flatCategories.map(cat => (
                  <tr key={cat.id} className="border-b hover:bg-muted/50">
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{'  '.repeat(cat.level)}</span>
                        {cat.level > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-medium">{cat.name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-center text-sm">{cat.sort_order}</td>
                    <td className="py-4">
                      <Badge variant={cat.is_active ? 'success' : 'secondary'}>
                        {cat.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingCategory(cat); setShowForm(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(cat.id)} disabled={deleteMutation.isPending}>
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
      
      {(showForm || editingCategory) && (
        <CategoryFormModal
          category={editingCategory}
          categories={categories}
          onClose={() => { setShowForm(false); setEditingCategory(null); }}
          onSubmit={category => editingCategory ? updateMutation.mutate({ id: editingCategory.id, data: category }) : createMutation.mutate(category)}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  )
}

function CategoryFormModal({
  category,
  categories,
  onClose,
  onSubmit,
  isLoading,
}: {
  category: Category | null
  categories: Category[]
  onClose: () => void
  onSubmit: (data: any) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    name: '',
    parent_id: '',
    sort_order: 0,
    is_active: true,
  })
  
  useState(() => {
    if (category) {
      setFormData({
        name: category.name,
        parent_id: String(category.parent_id || ''),
        sort_order: category.sort_order,
        is_active: category.is_active,
      })
    }
  }, [category])
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ ...formData, parent_id: formData.parent_id ? parseInt(formData.parent_id) : null })
  }
  
  const topCategories = categories.filter(c => !c.parent_id)
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card rounded-lg shadow-xl">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">{category ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Categoría padre</label>
            <select value={formData.parent_id} onChange={e => setFormData({...formData, parent_id: e.target.value})} className="w-full border rounded-lg px-3 py-2">
              <option value="">Ninguna (categoría principal)</option>
              {topCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Orden</label>
            <Input type="number" min="0" value={formData.sort_order} onChange={e => setFormData({...formData, sort_order: parseInt(e.target.value)})} />
          </div>
          
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="rounded border-input" />
            <label htmlFor="is_active" className="text-sm">Activa</label>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : (category ? 'Actualizar' : 'Crear')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}