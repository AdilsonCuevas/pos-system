'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Loader2, Edit, Trash2, SlidersHorizontal, PlusCircle, MinusCircle, GripVertical } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Badge } from '@/shared/ui/Badge'
import { formatCOP } from '@/shared/utils/cn'
import { api } from '@/shared/utils/api'
import type { ModifierGroup, Modifier, Product } from '@/shared/types/pos'

export function ModifiersPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'groups' | 'assign'>('groups')
  const [search, setSearch] = useState('')
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null)
  const [editingModifiers, setEditingModifiers] = useState<Modifier[]>([])
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [availableIngredients, setAvailableIngredients] = useState<any[]>([])
  
  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['modifier-groups', 'list', search],
    queryFn: async () => {
      const { data } = await api.get<ModifierGroup[]>('/modifier-groups', { params: { search, limit: 100 } })
      return data
    },
  })
  
  const { data: productsData } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: async () => {
      const { data } = await api.get<Product[]>('/products', { params: { is_active: true, limit: 200 } })
      return data
    },
  })
  
  const { data: ingredientsData } = useQuery({
    queryKey: ['ingredients', 'all'],
    queryFn: async () => {
      const { data } = await api.get<any[]>('/ingredients', { params: { is_active: true, limit: 200 } })
      return data
    },
  })
  
  const groups = groupsData || []
  
  const createGroupMutation = useMutation({
    mutationFn: (group: Partial<ModifierGroup> & { modifiers: Modifier[] }) => api.post('/modifier-groups', group),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['modifier-groups'] }); setShowGroupForm(false); },
  })
  
  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ModifierGroup> & { modifiers: Modifier[] } }) => api.put(`/modifier-groups/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['modifier-groups'] }); setEditingGroup(null); },
  })
  
  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/modifier-groups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modifier-groups'] }),
  })
  
  const handleNewGroup = () => {
    setEditingGroup(null)
    setEditingModifiers([])
    setShowGroupForm(true)
  }
  
  const handleEditGroup = (group: ModifierGroup) => {
    setEditingGroup(group)
    setEditingModifiers(group.modifiers || [])
    setShowGroupForm(true)
  }
  
  const addModifier = () => {
    setEditingModifiers([...editingModifiers, { group_id: 0, name: '', price_delta: 0, ingredient_id: 0, ingredient_quantity: 0, is_default: false, sort_order: editingModifiers.length }])
  }
  
  const removeModifier = (index: number) => {
    setEditingModifiers(editingModifiers.filter((_, i) => i !== index))
  }
  
  const updateModifier = (index: number, field: string, value: any) => {
    setEditingModifiers(editingModifiers.map((mod, i) => i === index ? { ...mod, [field]: value } : mod))
  }
  
  // Assign tab logic
  const { data: assignmentsData } = useQuery({
    queryKey: ['modifier-groups', 'assignments'],
    queryFn: async () => {
      const { data } = await api.get<{ product_id: number; group_id: number }[]>('/modifier-groups/assignments')
      return data
    },
    enabled: activeTab === 'assign',
  })
  
  const assignMutation = useMutation({
    mutationFn: ({ productId, groupIds }: { productId: number; groupIds: number[] }) => 
      api.post(`/products/${productId}/modifiers`, { group_ids: groupIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modifier-groups', 'assignments'] }),
  })
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modificadores</h1>
          <p className="text-muted-foreground">Crea grupos de opciones para personalizar productos (ej: Queso, Término, Sin cebolla)</p>
        </div>
        <Button onClick={handleNewGroup}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Grupo
        </Button>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'groups' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Grupos
        </button>
        <button
          onClick={() => setActiveTab('assign')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'assign' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Asignar a Productos
        </button>
      </div>
      
      {activeTab === 'groups' && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar grupo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Grupo</th>
                    <th className="pb-3 font-medium">Tipo</th>
                    <th className="pb-3 font-medium">Requerido</th>
                    <th className="pb-3 font-medium">Modificadores</th>
                    <th className="pb-3 font-medium">Estado</th>
                    <th className="pb-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {groupsLoading ? (
                    <tr><td colSpan={6} className="py-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></td></tr>
                  ) : groups.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No hay grupos de modificadores</td></tr>
                  ) : (
                    groups.map(group => (
                      <tr key={group.id} className="border-b hover:bg-muted/50">
                        <td className="py-4 font-medium">{group.name}</td>
                        <td className="py-4">
                          <Badge variant="secondary">{group.selection_type === 'single' ? 'Selección única' : 'Múltiple'}</Badge>
                        </td>
                        <td className="py-4">
                          <Badge variant={group.required ? 'default' : 'secondary'}>{group.required ? 'Sí' : 'No'}</Badge>
                        </td>
                        <td className="py-4 text-center">{group.modifiers?.length || 0}</td>
                        <td className="py-4">
                          <Badge variant={group.is_active ? 'success' : 'secondary'}>{group.is_active ? 'Activo' : 'Inactivo'}</Badge>
                        </td>
                        <td className="py-4 text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEditGroup(group)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteGroupMutation.mutate(group.id)} disabled={deleteGroupMutation.isPending}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          
          {(showGroupForm || editingGroup) && (
            <ModifierGroupFormModal
              group={editingGroup}
              modifiers={editingModifiers}
              setModifiers={setEditingModifiers}
              availableIngredients={availableIngredients}
              addModifier={addModifier}
              removeModifier={removeModifier}
              updateModifier={updateModifier}
              onClose={() => { setShowGroupForm(false); setEditingGroup(null); setEditingModifiers([]); }}
              onSubmit={(data) => editingGroup ? updateGroupMutation.mutate({ id: editingGroup.id, data }) : createGroupMutation.mutate(data)}
              isLoading={createGroupMutation.isPending || updateGroupMutation.isPending}
            />
          )}
        </>
      )}
      
      {activeTab === 'assign' && (
        <ModifierAssignTab
          groups={groups}
          products={availableProducts}
          assignments={assignmentsData || []}
          assignMutation={assignMutation}
          queryClient={queryClient}
        />
      )}
    </div>
  )
}

function ModifierGroupFormModal({
  group,
  modifiers,
  setModifiers,
  availableIngredients,
  addModifier,
  removeModifier,
  updateModifier,
  onClose,
  onSubmit,
  isLoading,
}: any) {
  const [formData, setFormData] = useState({
    name: '',
    selection_type: 'single',
    required: false,
    min_selections: 0,
    max_selections: 1,
    is_active: true,
  })
  
  useState(() => {
    if (group) {
      setFormData({
        name: group.name,
        selection_type: group.selection_type,
        required: group.required,
        min_selections: group.min_selections,
        max_selections: group.max_selections,
        is_active: group.is_active,
      })
    }
  }, [group])
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ ...formData, modifiers })
  }
  
  const addMod = () => {
    setModifiers([...modifiers, { group_id: 0, name: '', price_delta: 0, ingredient_id: 0, ingredient_quantity: 0, is_default: false, sort_order: modifiers.length }])
  }
  
  const removeMod = (index: number) => {
    setModifiers(modifiers.filter((_, i) => i !== index))
  }
  
  const updateMod = (index: number, field: string, value: any) => {
    setModifiers(modifiers.map((mod, i) => i === index ? { ...mod, [field]: value } : mod))
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-card rounded-lg shadow-xl max-h-[95vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">{group ? 'Editar Grupo de Modificadores' : 'Nuevo Grupo'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre del grupo *</label>
            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Ej: Queso, Término, Aderezos" />
          </div>
          
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de selección</label>
              <select value={formData.selection_type} onChange={e => setFormData({...formData, selection_type: e.target.value})} className="w-full border rounded-lg px-3 py-2">
                <option value="single">Una sola opción</option>
                <option value="multiple">Múltiples opciones</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mín. selecciones</label>
              <Input type="number" min="0" value={formData.min_selections} onChange={e => setFormData({...formData, min_selections: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Máx. selecciones</label>
              <Input type="number" min="1" value={formData.max_selections} onChange={e => setFormData({...formData, max_selections: parseInt(e.target.value)})} />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <input type="checkbox" id="required" checked={formData.required} onChange={e => setFormData({...formData, required: e.target.checked})} className="rounded border-input" />
            <label htmlFor="required" className="text-sm">Requerido (el cliente debe elegir al menos una opción)</label>
          </div>
          
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="rounded border-input" />
            <label htmlFor="is_active" className="text-sm">Activo</label>
          </div>
          
          {/* Modifiers */}
          <div className="space-y-4 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Modificadores ({modifiers.length})</h3>
              <Button variant="outline" size="sm" onClick={() => setModifiers([...modifiers, { group_id: 0, name: '', price_delta: 0, ingredient_id: 0, ingredient_quantity: 0, is_default: false, sort_order: modifiers.length }])}>
                <PlusCircle className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
            
            {modifiers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay modificadores. Agrega opciones como "Sin queso", "Queso extra", etc.</p>
            ) : (
              <div className="space-y-2">
                {modifiers.map((mod, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                    <Input value={mod.name} onChange={e => updateModifier(index, 'name', e.target.value)} className="flex-1 min-w-0 border rounded-lg px-3 py-2" placeholder="Nombre (ej: Queso cheddar)" required />
                    <Input type="number" step="0.01" value={mod.price_delta} onChange={e => updateModifier(index, 'price_delta', parseFloat(e.target.value))} className="w-28 border rounded-lg px-3 py-2" placeholder="Precio" />
                    <label className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={mod.is_default} onChange={e => updateModifier(index, 'is_default', e.target.checked)} className="rounded border-input" />
                      Default
                    </label>
                    <Button variant="ghost" size="icon" onClick={() => setModifiers(modifiers.filter((_, i) => i !== index))} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={createGroupMutation.isPending || updateGroupMutation.isPending}>Cancelar</Button>
            <Button type="submit" disabled={createGroupMutation.isPending || updateGroupMutation.isPending}>
              {isLoading ? 'Guardando...' : (group ? 'Actualizar' : 'Crear')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModifierAssignTab({
  groups,
  products,
  assignments,
  assignMutation,
  queryClient,
}: any) {
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null)
  const [assignedGroups, setAssignedGroups] = useState<number[]>([])
  
  useState(() => {
    if (selectedProduct) {
      const assignment = assignments.find(a => a.product_id === selectedProduct)
      setAssignedGroups(assignment ? [assignment.group_id] : [])
    }
  }, [selectedProduct, assignments])
  
  const handleAssign = () => {
    if (!selectedProduct || assignedGroups.length === 0) return
    assignMutation.mutate({ productId: selectedProduct, groupIds: assignedGroups }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['modifier-groups', 'assignments'] })
        setAssignedGroups([])
      }
    })
  }
  
  const productGroups = assignments.filter(a => a.product_id === selectedProduct)
  
  return (
    <div className="space-y-6">
      <Card>
        <div className="p-4">
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Producto *</label>
              <select value={selectedProduct || ''} onChange={e => { setSelectedProduct(e.target.value ? parseInt(e.target.value) : null); setAssignedGroups([]); }} className="w-full border rounded-lg px-3 py-2">
                <option value="">Seleccionar producto</option>
                {availableProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-3">Grupos disponibles</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {groups.map(g => (
                  <label key={g.id} className="flex items-center gap-2 p-2 rounded-lg border hover:bg-accent cursor-pointer">
                    <input type="checkbox" checked={assignedGroups.includes(g.id)} onChange={e => e.target.checked ? setAssignedGroups([...assignedGroups, g.id]) : setAssignedGroups(assignedGroups.filter(id => id !== g.id))} className="rounded border-input" />
                    <span className="font-medium">{g.name}</span>
                    <Badge variant="secondary" className="ml-auto">{g.selection_type === 'single' ? 'Única' : 'Múltiple'}</Badge>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Asignados al producto</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {groups.filter(g => assignedGroups.includes(g.id)).map(g => (
                  <div key={g.id} className="flex items-center justify-between p-2 rounded-lg border bg-green-50">
                    <span className="font-medium">{g.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => setAssignedGroups(assignedGroups.filter(id => id !== g.id))}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {assignedGroups.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Selecciona grupos para asignar</p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-6">
            <Button onClick={handleAssign} disabled={!selectedProduct || assignedGroups.length === 0 || assignMutation.isPending}>
              {assignMutation.isPending ? 'Asignando...' : 'Guardar Asignación'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}