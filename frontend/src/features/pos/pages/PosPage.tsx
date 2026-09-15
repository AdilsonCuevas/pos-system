'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Barcode, CreditCard, Cash, RefreshCw, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks'
import { useCart, useCartActions } from '../hooks/useCart'
import { usePOSStore } from '../posStore'
import { useSync } from '../hooks/useSync'
import { ProductGrid } from '../components/ProductGrid'
import { CartDrawer } from '../components/CartDrawer'
import { PaymentScreen } from '../components/PaymentScreen'
import { HardwareStatus } from '../components/HardwareStatus'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { api } from '@/shared/utils/api'
import type { Product } from '@/shared/types/pos'

interface ProductsResponse {
  products: Product[]
  categories: Category[]
}

interface Category {
  id: number
  name: string
  parent_id: number | null
}

export function PosPage() {
  const { user, businessType } = useAuth()
  const { isOnline, pendingCount, lastSync, triggerSync, retryFailed } = useSync()
  const { isSidebarOpen, setSidebarOpen } = usePOSStore()
  const { cart, subtotal, taxAmount, total, itemCount, isEmpty, clearCart } = useCart()
  const { addProduct, updateQuantity, applyModifiers, removeFromCart } = useCartActions()
  const [showCart, setShowCart] = useState(true)
  const [showPayment, setShowPayment] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  
  // Fetch products
  const { data: productsData, isLoading, error, refetch } = useQuery({
    queryKey: ['products', businessType],
    queryFn: async () => {
      const { data } = await api.get<ProductsResponse>('/products', {
        params: { business_type: businessType },
      })
      return data
    },
    staleTime: 60000,
  })
  
  // Handle online/offline sync
  useEffect(() => {
    const handleSync = () => triggerSync()
    window.addEventListener('pos-sync', handleSync)
    return () => window.removeEventListener('pos-sync', handleSync)
  }, [triggerSync])
  
  const products = productsData?.products || []
  const categories = productsData?.categories || []
  
  const handleProductSelect = (product: Product) => {
    if (businessType === 'restaurant' && product.type === 'composite') {
      setSelectedProduct(product)
    } else {
      addProduct(product)
    }
  }
  
  const handleVariantSelect = (product: Product, variantId: number) => {
    const variant = product.variants?.find(v => v.id === variantId)
    if (variant) {
      addProduct(product, 1, [], variant)
    }
  }
  
  const handleModifiersSelect = (product: Product, modifiers: any[]) => {
    addProduct(product, 1, modifiers)
    setSelectedProduct(null)
  }
  
  const handleCompleteSale = async (payments: any[]) => {
    try {
      const sale = {
        items: cart.map(item => ({
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          modifiers: item.modifiers,
        })),
        payments,
        customer: null, // TODO: add customer selection
      }
      
      // Check if online
      if (isOnline) {
        const { data } = await api.post('/sales', sale)
        // Print receipt
        // TODO: call print API
        clearCart()
        setShowPayment(false)
        setShowCart(true)
      } else {
        // Queue for offline sync
        const { usePOSStore } = await import('../posStore')
        usePOSStore.getState().addToQueue({
          entityType: 'sale',
          operation: 'create',
          payload: sale,
        })
        clearCart()
        setShowPayment(false)
        setShowCart(true)
      }
    } catch (error) {
      console.error('Sale error:', error)
      alert('Error al procesar la venta')
    }
  }
  
  return (
    <div className="flex h-screen flex-col">
      {/* Top bar with status */}
      <div className="flex h-10 items-center justify-between border-b bg-background/95 backdrop-blur-sm px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Punto de Venta</span>
          <Badge variant={businessType === 'restaurant' ? 'default' : 'secondary'}>
            {businessType === 'restaurant' ? 'Restaurante' : 'Abarrotes'}
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Sync status */}
          <div className="flex items-center gap-2">
            {!isOnline && (
              <Badge variant="warning" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Fuera de línea
                {pendingCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-background/50 rounded">{pendingCount}</span>
                )}
              </Badge>
            )}
            {isOnline && lastSync && (
              <span className="text-xs text-muted-foreground">
                Última sync: {new Date(lastSync).toLocaleTimeString('es-CO')}
              </span>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={triggerSync}
              disabled={!isOnline || pendingCount === 0}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={retryFailed}
              disabled={!isOnline}
            >
              <AlertTriangle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <Loader2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Product Grid - Left side */}
        <div className={`
          flex-1 overflow-y-auto p-4 transition-all duration-300
          ${showCart ? 'lg:pr-96' : ''}
        `}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-destructive">
              <p>Error al cargar productos: {getErrorMessage(error)}</p>
            </div>
          ) : (
            <ProductGrid
              products={products}
              categories={categories}
              businessType={businessType}
              onProductSelect={handleProductSelect}
              onVariantSelect={handleVariantSelect}
              onModifiersSelect={handleModifiersSelect}
            />
          )}
        </div>
        
        {/* Cart Drawer - Right side */}
        <CartDrawer
          isOpen={showCart}
          onClose={() => setShowCart(false)}
          onPayment={() => setShowPayment(true)}
          cart={cart}
          subtotal={subtotal}
          taxAmount={taxAmount}
          total={total}
          itemCount={itemCount}
          isEmpty={isEmpty}
          onUpdateQuantity={updateQuantity}
          onApplyModifiers={applyModifiers}
          onRemove={removeFromCart}
          onClear={clearCart}
          businessType={businessType}
        />
      </div>
      
      {/* Payment Modal */}
      {showPayment && (
        <PaymentScreen
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          onComplete={handleCompleteSale}
          cart={cart}
          subtotal={subtotal}
          taxAmount={taxAmount}
          total={total}
          businessType={businessType}
        />
      )}
      
      {/* Modifier/Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onVariantSelect={handleVariantSelect}
          onModifiersSelect={handleModifiersSelect}
          businessType={businessType}
        />
      )}
      
      {/* Hardware Status */}
      <HardwareStatus />
    </div>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Error desconocido'
}

// Simple Product Detail Modal for variants/modifiers
function ProductDetailModal({
  product,
  onClose,
  onVariantSelect,
  onModifiersSelect,
  businessType,
}: {
  product: Product
  onClose: () => void
  onVariantSelect: (product: Product, variantId: number) => void
  onModifiersSelect: (product: Product, modifiers: any[]) => void
  businessType: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{product.name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">{product.description}</p>
        <p className="text-xl font-bold text-primary mb-4">{formatCOP(product.price)}</p>
        
        {product.variants?.length && (
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Tamaño / Variante</h3>
            <div className="grid gap-2 grid-cols-3">
              {product.variants.map(variant => (
                <button
                  key={variant.id}
                  onClick={() => onVariantSelect(product, variant.id)}
                  className="px-3 py-2 border rounded-lg hover:bg-accent text-sm"
                >
                  <div className="font-medium">{variant.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCOP(product.price + variant.priceDelta)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {businessType === 'restaurant' && product.type === 'composite' && (
          <button
            onClick={() => onModifiersSelect(product, [])}
            className="w-full py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Personalizar
          </button>
        )}
      </div>
    </div>
  )
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount)
}