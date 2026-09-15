'use client'

import { useState, useMemo } from 'react'
import { ChevronRight, Loader2, Package, Utensils } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { Card } from '@/shared/ui/Card'
import { formatCOP } from '@/shared/utils/cn'
import type { Product, Category } from '@/shared/types/pos'

interface ProductGridProps {
  products: Product[]
  categories: Category[]
  businessType: 'grocery' | 'restaurant'
  onProductSelect: (product: Product) => void
  onVariantSelect: (product: Product, variantId: number) => void
  onModifiersSelect: (product: Product, modifiers: any[]) => void
}

export function ProductGrid({
  products,
  categories,
  businessType,
  onProductSelect,
  onVariantSelect,
  onModifiersSelect,
}: ProductGridProps) {
  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  
  // Build category tree
  const topCategories = useMemo(() => 
    categories.filter(c => !c.parent_id && c.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  )
  
  const getSubcategories = (parentId: number) => 
    categories.filter(c => c.parent_id === parentId && c.is_active).sort((a, b) => a.sort_order - b.sort_order)
  
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => p.is_active)
    
    if (activeCategory !== 'all') {
      const subCatIds = getSubcategories(activeCategory).map(c => c.id)
      result = result.filter(p => p.category_id === activeCategory || subCatIds.includes(p.category_id))
    }
    
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.sku.toLowerCase().includes(searchLower)
      )
    }
    
    return result
  }, [products, categories, activeCategory, search, getSubcategories])
  
  return (
    <div className="flex flex-col h-full gap-4">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar producto (SKU, nombre)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background"
        />
        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>
      
      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setActiveCategory('all')}
          className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeCategory === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-accent'
          }`}
        >
          Todos
        </button>
        {topCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-accent'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
      
      {/* Subcategory Tabs */}
      {activeCategory !== 'all' && getSubcategories(activeCategory).length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {getSubcategories(activeCategory).map(subcat => (
            <button
              key={subcat.id}
              onClick={() => setActiveCategory(subcat.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === subcat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-accent'
              }`}
            >
              {subcat.name}
            </button>
          ))}
        </div>
      )}
      
      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto">
        {filteredProducts.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <Package className="h-12 w-12 mb-2 opacity-50" />
            <p>No hay productos en esta categoría</p>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                businessType={businessType}
                onSelect={onProductSelect}
                onVariantSelect={onVariantSelect}
                onModifiersSelect={onModifiersSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProductCard({
  product,
  businessType,
  onSelect,
  onVariantSelect,
  onModifiersSelect,
}: {
  product: Product
  businessType: string
  onSelect: (product: Product) => void
  onVariantSelect: (product: Product, variantId: number) => void
  onModifiersSelect: (product: Product, modifiers: any[]) => void
}) {
  const hasVariants = product.variants && product.variants.length > 0
  const isComposite = product.type === 'composite'
  
  return (
    <Card
      className="flex flex-col h-full cursor-pointer transition-all hover:shadow-md active:scale-[0.98]"
      onClick={() => {
        if (hasVariants) {
          // Show variant selection
        } else if (businessType === 'restaurant' && isComposite) {
          onModifiersSelect(product, [])
        } else {
          onSelect(product)
        }
      }}
    >
      {/* Product Image */}
      <div className="aspect-square relative bg-muted flex items-center justify-center overflow-hidden rounded-t-lg">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {businessType === 'restaurant' ? <Utensils className="h-12 w-12 text-muted-foreground/50" /> : <Package className="h-12 w-12 text-muted-foreground/50" />}
          </div>
        )}
        
        {isComposite && (
          <Badge className="absolute top-2 left-2" variant="secondary">
            Receta
          </Badge>
        )}
        
        {product.track_stock && product.current_stock <= product.min_stock && product.min_stock > 0 && (
          <Badge className="absolute top-2 right-2" variant="destructive">
            Stock bajo
          </Badge>
        )}
      </div>
      
      {/* Product Info */}
      <div className="flex-1 flex flex-col p-3 gap-2">
        <h3 className="font-medium text-sm truncate">{product.name}</h3>
        <p className="text-xs text-muted-foreground truncate">{product.sku}</p>
        
        <div className="mt-auto flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            {formatCOP(product.price)}
          </span>
          {hasVariants && (
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}