'use client'

import { useState } from 'react'
import { X, Cash, CreditCard, Banknote, Smartphone, Check, Loader2, Minus, Plus } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import { formatCOP, parseCOP } from '@/shared/utils/cn'

interface PaymentScreenProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (payments: any[]) => Promise<void>
  cart: any[]
  subtotal: number
  taxAmount: number
  total: number
  businessType: string
}

export function PaymentScreen({
  isOpen,
  onClose,
  onComplete,
  cart,
  subtotal,
  taxAmount,
  total,
  businessType,
}: PaymentScreenProps) {
  if (!isOpen) return null
  
  const [payments, setPayments] = useState<Array<{ method: string; amount: number; reference?: string }>>([])
  const [cashInput, setCashInput] = useState('')
  const [cardReference, setCardReference] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [change, setChange] = useState(0)
  
  const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = total - paidTotal
  const calculatedChange = Math.max(0, paidTotal - total)
  
  setChange(calculatedChange)
  
  const paymentMethods = [
    { id: 'cash', label: 'Efectivo', icon: Cash, color: 'text-green-600' },
    { id: 'card', label: 'Tarjeta', icon: CreditCard, color: 'text-blue-600' },
    { id: 'transfer', label: 'Transferencia', icon: Banknote, color: 'text-purple-600' },
    { id: 'mobile', label: 'Móvil (Nequi/Davi)', icon: Smartphone, color: 'text-orange-600' },
  ]
  
  const handleAddPayment = (method: string) => {
    let amount = 0
    
    if (method === 'cash') {
      amount = parseCOP(cashInput) || remaining
    } else if (method === 'card') {
      amount = remaining
    } else {
      amount = remaining
    }
    
    if (amount <= 0) return
    
    const newPayment = {
      method,
      amount,
      reference: method === 'card' ? cardReference : undefined,
    }
    
    setPayments([...payments, newPayment])
    setCashInput('')
    setCardReference('')
  }
  
  const handleRemovePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index))
  }
  
  const handleComplete = async () => {
    if (paidTotal < total - 1) {
      alert('El monto pagado es insuficiente')
      return
    }
    
    setIsProcessing(true)
    try {
      await onComplete(payments)
      onClose()
    } catch (error) {
      console.error('Payment error:', error)
      alert('Error al procesar el pago')
    } finally {
      setIsProcessing(false)
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Pagar {formatCOP(total)}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Order Summary */}
        <Card className="mb-4">
          <div className="p-4 space-y-2">
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
          </div>
        </Card>
        
        {/* Payment Methods */}
        <div className="mb-4">
          <h3 className="font-medium mb-3">Métodos de pago</h3>
          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map(method => (
              <button
                key={method.id}
                type="button"
                onClick={() => handleAddPayment(method.id)}
                disabled={paidTotal >= total && method !== 'cash'}
                className={`
                  flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-all
                  ${paidTotal >= total && method !== 'cash' ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}
                `}
              >
                <method.icon className={`h-6 w-6 ${method.color}`} />
                <span className="text-sm font-medium">{method.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Cash Input */}
        {(payments.some(p => p.method === 'cash') || remaining > 0) && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <Cash className="h-5 w-5 text-green-600" />
              <Label className="font-medium">Efectivo recibido</Label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">$</span>
              <Input
                type="text"
                value={cashInput}
                onChange={e => setCashInput(e.target.value)}
                placeholder="0"
                className="flex-1 text-right text-xl font-mono"
                inputMode="numeric"
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground mt-1">
              <span>Pendiente: {formatCOP(remaining)}</span>
              <span>Cambio: {formatCOP(Math.max(0, parseCOP(cashInput) - total))}</span>
            </div>
          </div>
        )}
        
        {/* Card Reference */}
        {payments.some(p => p.method === 'card') && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <Label className="font-medium">Referencia tarjeta</Label>
            </div>
            <Input
              value={cardReference}
              onChange={e => setCardReference(e.target.value)}
              placeholder="Últimos 4 dígitos / código autorización"
              className="text-center"
            />
          </div>
        )}
        
        {/* Added Payments */}
        {payments.length > 0 && (
          <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
            <h4 className="font-medium mb-2">Pagos registrados</h4>
            {payments.map((payment, index) => (
              <Card key={index} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {paymentMethods.find(m => m.id === payment.method)?.icon && (
                    <paymentMethods.find(m => m.id === payment.method)!.icon className={`h-5 w-5 ${paymentMethods.find(m => m.id === payment.method)!.color}`} />
                  )}
                  <div>
                    <p className="font-medium capitalize">{payment.method}</p>
                    <p className="text-sm text-muted-foreground">{formatCOP(payment.amount)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemovePayment(index)}
                  className="text-destructive hover:text-destructive/80 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </Card>
            ))}
            
            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Pagado</span>
                <span className="font-medium">{formatCOP(paidTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pendiente</span>
                <span className="font-medium text-destructive">{formatCOP(Math.max(0, remaining))}</span>
              </div>
              {change > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Cambio</span>
                  <span className="font-medium">{formatCOP(change)}</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            size="lg"
            onClick={handleComplete}
            disabled={isProcessing || paidTotal < total - 1}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              'Completar Venta'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}