'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Loader2, Edit, Trash2, ChefHat, Package, PlusCircle, MinusCircle, GripVertical } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Badge } from '@/shared/ui/Badge'
import { formatCOP } from '@/shared/utils/cn'
import { api } from '@/shared/utils/api'
import type { Recipe, RecipeIngredient, Product } from '@/shared/types/pos'

interface RecipeWithProduct extends Recipe {
  product: Product
}

export function RecipesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<RecipeWithProduct | null>(null)
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [availableIngredients, setAvailableIngredients] = useState<any[]>([])
  
  const { data: recipesData, isLoading: recipesLoading } = useQuery({
    queryKey: ['recipes', 'list', search],
    queryFn: async () => {
      const { data } = await api.get<RecipeWithProduct[]>('/recipes', { params: { search, limit: 50 } })
      return data
    },
  })
  
  const { data: productsData } = useQuery({
    queryKey: ['products', 'composite', 'available'],
    queryFn: async () => {
      const { data } = await api.get<Product[]>('/products', { params: { type: 'composite', is_active: true, limit: 200 } })
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
  
  useState(() => {
    if (productsData) setAvailableProducts(productsData.filter(p => !recipesData?.some(r => r.product_id === p.id)))
    if (ingredientsData) setAvailableIngredients(ingredientsData)
  }, [productsData, ingredientsData, recipesData])
  
  const createMutation = useMutation({
    mutationFn: (recipe: Partial<Recipe> & { ingredients: RecipeIngredient[] }) => api.post('/recipes', recipe),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recipes'] }); setShowForm(false); },
  })
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Recipe> & { ingredients: RecipeIngredient[] } }) => api.put(`/recipes/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recipes'] }); setEditingRecipe(null); },
  })
  
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/recipes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  })
  
  const recipes = recipesData || []
  
  const handleEdit = (recipe: RecipeWithProduct) => {
    setIngredients(recipe.ingredients || [])
    setEditingRecipe(recipe)
    setShowForm(true)
  }
  
  const handleNew = () => {
    setIngredients([])
    setEditingRecipe(null)
    setShowForm(true)
  }
  
  const addIngredient = () => {
    setIngredients([...ingredients, { recipe_id: 0, ingredient_id: 0, quantity: 0, unit: 'g', is_optional: false, sort_order: ingredients.length }])
  }
  
  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }
  
  const updateIngredient = (index: number, field: string, value: any) => {
    setIngredients(ingredients.map((ing, i) => i === index ? { ...ing, [field]: value } : ing))
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const product = availableProducts.find(p => p.id === parseInt(formData.product_id))
    const data = {
      product_id: parseInt(formData.product_id),
      name: formData.name,
      instructions: formData.instructions,
      prep_time_minutes: parseInt(formData.prep_time_minutes) || 0,
      cook_time_minutes: parseInt(formData.cook_time_minutes) || 0,
      yield_quantity: parseFloat(formData.yield_quantity) || 1,
      yield_unit: formData.yield_unit,
      ingredients: ingredients.map((ing, i) => ({
        ...ing,
        ingredient_id: parseInt(ing.ingredient_id),
        quantity: parseFloat(ing.quantity),
        sort_order: i,
      })).filter(ing => ing.ingredient_id > 0 && ing.quantity > 0),
    }
    if (editingRecipe) {
      updateMutation.mutate({ id: editingRecipe.id, data })
    } else {
      createMutation.mutate(data)
    }
  }
  
  const [formData, setFormData] = useState({
    product_id: '',
    name: '',
    instructions: '',
    prep_time_minutes: 0,
    cook_time_minutes: 0,
    yield_quantity: 1,
    yield_unit: 'porcion',
  })
  
  useState(() => {
    if (editingRecipe) {
      setFormData({
        product_id: String(editingRecipe.product_id),
        name: editingRecipe.name,
        instructions: editingRecipe.instructions || '',
        prep_time_minutes: editingRecipe.prep_time_minutes,
        cook_time_minutes: editingRecipe.cook_time_minutes,
        yield_quantity: editingRecipe.yield_quantity,
        yield_unit: editingRecipe.yield_unit,
      })
    } else {
      setFormData({ product_id: '', name: '', instructions: '', prep_time_minutes: 0, cook_time_minutes: 0, yield_quantity: 1, yield_unit: 'porcion' })
    }
  }, [editingRecipe])
  
  const compositeProducts = availableProducts.filter(p => p.type === 'composite')
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recetas</h1>
          <p className="text-muted-foreground">Define ingredientes y cantidades para productos compuestos</p>
        </div>
        <Button onClick={handleNew} disabled={compositeProducts.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Receta
        </Button>
      </div>
      
      {compositeProducts.length === 0 && (
        <Card className="border-destructive/50">
          <div className="p-6 text-center">
            <ChefHat className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No hay productos compuestos disponibles</h3>
            <p className="text-muted-foreground mb-4">Crea productos de tipo "Compuesto" en la página de Productos para poder definir sus recetas.</p>
            <Button variant="outline" onClick={() => window.location.href = '/products'}>Ir a Productos</Button>
          </div>
        </Card>
      )}
      
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Producto</th>
                <th className="pb-3 font-medium">Rendimiento</th>
                <th className="pb-3 font-medium">Tiempo Prep.</th>
                <th className="pb-3 font-medium">Tiempo Cocción</th>
                <th className="pb-3 font-medium">Ingredientes</th>
                <th className="pb-3 font-medium">Costo Total</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {recipesLoading ? (
                <tr><td colSpan={7} className="py-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></td></tr>
              ) : recipes.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No hay recetas definidas</td></tr>
              ) : (
                recipes.map(recipe => (
                  <tr key={recipe.id} className="border-b hover:bg-muted/50">
                    <td className="py-4 font-medium">{recipe.product?.name || recipe.name}</td>
                    <td className="py-4">{recipe.yield_quantity} {recipe.yield_unit}</td>
                    <td className="py-4">{recipe.prep_time_minutes} min</td>
                    <td className="py-4">{recipe.cook_time_minutes} min</td>
                    <td className="py-4">{recipe.ingredients?.length || 0} items</td>
                    <td className="py-4 text-right font-mono">
                      {formatCOP(recipe.ingredients?.reduce((sum, ing) => sum + (ing.quantity * 0), 0))}
                    </td>
                    <td className="py-4 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(recipe)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(recipe.id)} disabled={deleteMutation.isPending}>
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
      
      {(showForm || editingRecipe) && (
        <RecipeFormModal
          recipe={editingRecipe}
          ingredients={ingredients}
          setIngredients={setIngredients}
          availableProducts={compositeProducts}
          availableIngredients={availableIngredients}
          formData={formData}
          setFormData={setFormData}
          addIngredient={addIngredient}
          removeIngredient={removeIngredient}
          updateIngredient={updateIngredient}
          onClose={() => { setShowForm(false); setEditingRecipe(null); setIngredients([]); }}
          onSubmit={handleSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  )
}

function RecipeFormModal({
  recipe,
  ingredients,
  setIngredients,
  availableProducts,
  availableIngredients,
  formData,
  setFormData,
  addIngredient,
  removeIngredient,
  updateIngredient,
  onClose,
  onSubmit,
  isLoading,
}: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-card rounded-lg shadow-xl max-h-[95vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">{recipe ? 'Editar Receta' : 'Nueva Receta'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent">✕</button>
        </div>
        
        <form onSubmit={onSubmit} className="p-6 space-y-6">
          {/* Product Selection */}
          <div className="space-y-4 border rounded-lg p-4">
            <h3 className="font-semibold">Producto</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Producto *</label>
                <select value={formData.product_id} onChange={e => setFormData({...formData, product_id: e.target.value})} className="w-full border rounded-lg px-3 py-2" required disabled={!!recipe}>
                  <option value="">Seleccionar producto compuesto</option>
                  {availableProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nombre receta</label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Hamburguesa Clásica" />
              </div>
            </div>
          </div>
          
          {/* Recipe Details */}
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium mb-1">Rendimiento</label>
              <div className="flex gap-2">
                <Input type="number" step="0.01" min="0.01" value={formData.yield_quantity} onChange={e => setFormData({...formData, yield_quantity: parseFloat(e.target.value)})} className="w-24" />
                <select value={formData.yield_unit} onChange={e => setFormData({...formData, yield_unit: e.target.value})} className="w-full border rounded-lg px-3 py-2">
                  <option value="porcion">Porción</option>
                  <option value="plato">Plato</option>
                  <option value="unidad">Unidad</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tiempo prep. (min)</label>
              <Input type="number" min="0" value={formData.prep_time_minutes} onChange={e => setFormData({...formData, prep_time_minutes: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tiempo cocción (min)</label>
              <Input type="number" min="0" value={formData.cook_time_minutes} onChange={e => setFormData({...formData, cook_time_minutes: parseInt(e.target.value)})} />
            </div>
          </div>
          
          {/* Ingredients */}
          <div className="space-y-4 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Ingredientes ({ingredients.length})</h3>
              <Button variant="outline" size="sm" onClick={addIngredient}><PlusCircle className="h-4 w-4 mr-1" />Agregar</Button>
            </div>
            
            {ingredients.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay ingredientes. Agrega al menos uno.</p>
            ) : (
              <div className="space-y-2">
                {ingredients.map((ing, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                    <select value={ing.ingredient_id} onChange={e => updateIngredient(index, 'ingredient_id', e.target.value)} className="flex-1 min-w-0 border rounded-lg px-3 py-2" required>
                      <option value="0">Seleccionar ingrediente</option>
                      {availableIngredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit}) - ${formatCOP(i.cost_per_unit)}/{i.unit}</option>)}
                    </select>
                    <Input type="number" step="0.001" min="0.001" value={ing.quantity} onChange={e => updateIngredient(index, 'quantity', e.target.value)} className="w-24" placeholder="Cant." required />
                    <select value={ing.unit} onChange={e => updateIngredient(index, 'unit', e.target.value)} className="w-24 border rounded-lg px-2 py-1">
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="kg">kg</option>
                      <option value="L">L</option>
                      <option value="unidad">unidad</option>
                    </select>
                    <label className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={ing.is_optional} onChange={e => updateIngredient(index, 'is_optional', e.target.checked)} className="rounded border-input" />
                      Opcional
                    </label>
                    <Button variant="ghost" size="icon" onClick={() => removeIngredient(index)} className="text-destructive">
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Instructions */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Instrucciones</label>
            <textarea value={formData.instructions} onChange={e => setFormData({...formData, instructions: e.target.value})} className="w-full border rounded-lg px-3 py-2 min-h-[100px]" rows={4} placeholder="Pasos de preparación..." />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : (recipe ? 'Actualizar' : 'Crear')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}