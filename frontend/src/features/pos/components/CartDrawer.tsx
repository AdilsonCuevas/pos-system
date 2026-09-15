'use client'

import { X, Plus, Minus, Trash2, CreditCard, Cash, Loader2 } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { formatCOP } from '@/shared/utils/cn'
import type { CartItem } from '@/shared/types/pos'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  onPayment: () => void
  cart: CartItem[]
  subtotal: number
  taxAmount: number
  total: number
  itemCount: number
  isEmpty: boolean
  onUpdateQuantity: (tempId: string, quantity: number) => void
  onApplyModifiers: (tempId: string, modifiers: any[]) => void
  onRemove: (tempId: string) => void
  onClear: () => void
  businessType: string
}

export function CartDrawer({
  isOpen,
  onClose,
  onPayment,
  cart,
  subtotal,
  taxAmount,
  total,
  itemCount,
  isEmpty,
  onUpdateQuantity,
  onApplyModifiers,
  onRemove,
  onClear,
  businessType,
}: CartDrawerProps) {
  if (!isOpen) return null
  
  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer */}
      <aside
        className={`
          fixed right-0 top-0 z-50 h-screen w-full max-w-[380px] bg-card border-l shadow-xl
          flex flex-col transition-transform duration-300 lg:translate-x-0
        `}
        role="dialog"
        aria-label="Carrito de compras"
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <h2 className="font-semibold">Carrito ({itemCount})</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <Cash className="h-10 w-10" />
              </div>
              <p className="text-center">Carrito vacío</p>
              <p className="text-sm">Agrega productos para comenzar</p>
            </div>
          ) : (
            <>
              {cart.map(item => (
                <CartItemCard
                  key={item.tempId}
                  item={item}
                  onUpdateQuantity={onUpdateQuantity}
                  onApplyModifiers={onApplyModifiers}
                  onRemove={onRemove}
                  businessType={businessType}
                />
              ))}
              
              {cart.length > 0 && (
                <Button variant="outline" className="w-full mt-2" onClick={onClear}>
                  Limpiar carrito
                </Button>
              )}
            </>
          )}
        </div>
        
        {/* Totals */}
        <div className="border-t p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatCOP(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>IVA (19%)</span>
            <span>{formatCOP(taxAmount)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-3">
            <span>TOTAL</span>
            <span>{formatCOP(total)}</span>
          </div>
          
          <Button
            className="w-full"
            size="lg"
            onClick={onPayment}
            disabled={isEmpty}
          >
            Pagar {formatCOP(total)}
          </Button>
        </div>
      </aside>
    </>
  )
}

function CartItemCard({
  item,
  onUpdateQuantity,
  onApplyModifiers,
  onRemove,
  businessType,
}: {
  item: CartItem
  onUpdateQuantity: (tempId: string, quantity: number) => void
  onApplyModifiers: (tempId: string, modifiers: any[]) => void
  onRemove: (tempId: string) => void
  businessType: string
}) {
  const hasModifiers = item.modifiers && item.modifiers.length > 0
  const modifierTotal = item.modifiers?.reduce((sum, m) => sum + (m.priceDelta || 0), 0) || 0
  
  return (
    <Card className="p-3">
      <div className="flex gap-3">
        {/* Image */}
        <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-muted-foreground">📦</span>
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-medium text-sm truncate">{item.productName}</h4>
              {item.variantName && (
                <span className="text-xs text-muted-foreground">{item.variantName}</span>
              )}
              
              {/* Modifiers */}
              {hasModifiers && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.modifiers!.map((mod: any) => (
                    <Badge key={`${mod.group_id}-${mod.modifier_id}`} variant="secondary" className="text-xs">
                      {mod.name} {mod.priceDelta >= 0 ? '+' : ''}{formatCOP(mod.priceDelta)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => onRemove(item.tempId)}
              className="text-muted-foreground hover:text-destructive p-1"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          
          {/* Quantity & Price */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUpdateQuantity(item.tempId, item.quantity - 1)}
                disabled={item.quantity <= 1}
                className="p-1 rounded border hover:bg-accent disabled:opacity-50"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
              <button
                onClick={() => onUpdateQuantity(item.tempId, item.quantity + 1)}
                className="p-1 rounded border hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <span className="font-medium text-sm">
              {formatCOP(item.totalPrice)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount)
}