import { useMemo } from 'react'
import { usePOSStore } from '../posStore'
import type { CartItem, Product } from '@/shared/types/pos'

export function useCart() {
  const {
    cart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    registerId,
    setRegisterId,
    businessType,
  } = usePOSStore()
  
  // We need to get businessType from auth store
  // For now, we'll pass it or get from context
  
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.totalPrice, 0),
    [cart]
  )
  
  const taxAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.totalPrice * (item.taxRate || 0), 0),
    [cart]
  )
  
  const total = useMemo(
    () => subtotal + taxAmount,
    [subtotal, taxAmount]
  )
  
  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  )
  
  const isEmpty = cart.length === 0
  
  return {
    cart,
    subtotal,
    taxAmount,
    total,
    itemCount,
    isEmpty,
    registerId,
    setRegisterId,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
  }
}

export function useCartActions() {
  const { addToCart, updateCartItem, removeFromCart, clearCart } = usePOSStore()
  
  const addProduct = (product: Product, quantity: number = 1, modifiers: CartItem['modifiers'] = []) => {
    const variant = product.variants?.find((v) => v.isDefault) || null
    const price = variant ? product.price + variant.priceDelta : product.price
    
    addToCart({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      variantId: variant?.id,
      variantName: variant?.name,
      quantity,
      unitPrice: price,
      taxRate: product.taxRate,
      modifiers,
      imageUrl: product.imageUrl,
    })
  }
  
  const updateQuantity = (tempId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(tempId)
    } else {
      updateCartItem(tempId, { quantity, totalPrice: quantity * usePOSStore.getState().cart.find(c => c.tempId === tempId)?.unitPrice || 0 })
    }
  }
  
  const applyModifiers = (tempId: string, modifiers: CartItem['modifiers']) => {
    const item = usePOSStore.getState().cart.find(c => c.tempId === tempId)
    if (!item) return
    
    const modifierTotal = modifiers.reduce((sum, m) => sum + (m.priceDelta || 0), 0)
    const basePrice = item.unitPrice - (item.modifiers?.reduce((sum, m) => sum + (m.priceDelta || 0), 0) || 0)
    
    updateCartItem(tempId, {
      modifiers,
      unitPrice: basePrice + modifierTotal,
      totalPrice: (basePrice + modifierTotal) * item.quantity,
    })
  }
  
  return {
    addProduct,
    updateQuantity,
    applyModifiers,
    removeFromCart,
    clearCart,
  }
}