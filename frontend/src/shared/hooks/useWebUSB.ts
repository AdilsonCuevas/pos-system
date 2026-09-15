import { useEffect, useRef, useState, useCallback } from 'react'
import { EscPosBuilder } from '@/shared/utils/escpos'

interface PrinterOptions {
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
}

interface PrinterState {
  isConnected: boolean
  device: USBDevice | null
  error: string | null
}

export function useThermalPrinter({
  onConnect,
  onDisconnect,
  onError,
}: PrinterOptions = {}) {
  const [state, setState] = useState<PrinterState>({
    isConnected: false,
    device: null,
    error: null,
  })
  
  const deviceRef = useRef<USBDevice | null>(null)
  const interfaceNumberRef = useRef<number>(0)
  const endpointOutRef = useRef<number>(0)
  
  const connect = useCallback(async () => {
    try {
      if (!('usb' in navigator)) {
        throw new Error('WebUSB no soportado en este navegador')
      }
      
      // Request device - thermal printers typically use class 0x07 (Printer)
      const device = await (navigator as any).usb.requestDevice({
        filters: [{ classCode: 0x07 }], // Printer class
      })
      
      await device.open()
      
      // Find printer interface and endpoint
      const configuration = device.configuration || (await device.selectConfiguration(1))
      const interface = configuration.interfaces.find((iface: any) => 
        iface.alternates.some((alt: any) => 
          alt.endpoints.some((ep: any) => ep.direction === 'out' && ep.type === 'bulk')
        )
      )
      
      if (!interface) {
        throw new Error('No se encontró interfaz de impresora válida')
      }
      
      const alternate = interface.alternates[0]
      const endpointOut = alternate.endpoints.find((ep: any) => ep.direction === 'out' && ep.type === 'bulk')
      
      if (!endpointOut) {
        throw new Error('No se encontró endpoint de salida')
      }
      
      await device.claimInterface(interface.interfaceNumber)
      await device.selectAlternateInterface(interface.interfaceNumber, 0)
      
      deviceRef.current = device
      interfaceNumberRef.current = interface.interfaceNumber
      endpointOutRef.current = endpointOut.endpointNumber
      
      setState({
        isConnected: true,
        device,
        error: null,
      })
      
      onConnect?.()
      
      // Listen for disconnect
      device.addEventListener('disconnect', () => {
        disconnect()
      })
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error al conectar impresora')
      setState((prev) => ({ ...prev, error: error.message, isConnected: false }))
      onError?.(error)
    }
  }, [onConnect, onError])
  
  const disconnect = useCallback(async () => {
    if (deviceRef.current) {
      try {
        await deviceRef.current.releaseInterface(interfaceNumberRef.current)
        await deviceRef.current.close()
      } catch {}
      deviceRef.current = null
    }
    
    setState({
      isConnected: false,
      device: null,
      error: null,
    })
    
    onDisconnect?.()
  }, [onDisconnect])
  
  const print = useCallback(async (commands: Uint8Array) => {
    if (!deviceRef.current || !state.isConnected) {
      throw new Error('Impresora no conectada')
    }
    
    try {
      // Split large commands into chunks (max 64KB per transfer)
      const CHUNK_SIZE = 65536
      for (let i = 0; i < commands.length; i += CHUNK_SIZE) {
        const chunk = commands.slice(i, i + CHUNK_SIZE)
        await deviceRef.current.transferOut(endpointOutRef.current, chunk)
      }
    } catch (err) {
      throw new Error(`Error al imprimir: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }, [state.isConnected])
  
  const printReceipt = useCallback(async (receiptData: ReceiptData) => {
    const builder = new EscPosBuilder()
      .init()
      .text(receiptData.businessName || '', { align: 'center', bold: true, size: 2 })
      .text(receiptData.businessAddress || '', { align: 'center' })
      .text(`NIT: ${receiptData.businessTaxId || ''}`, { align: 'center' })
      .text('────────────────────────')
      .text(`${receiptData.saleNumber}  ${new Date(receiptData.timestamp).toLocaleString('es-CO')}`)
      .text(`Cajero: ${receiptData.cashierName}`)
      .text('────────────────────────')
    
    // Items
    receiptData.items.forEach((item) => {
      builder.text(`${item.name}  ${item.quantity} x ${formatCOP(item.unitPrice)}`)
      builder.text(`${formatCOP(item.totalPrice)}`, { align: 'right' })
      
      if (item.modifiers?.length) {
        item.modifiers.forEach((mod) => {
          builder.text(`  + ${mod.name} ${mod.priceDelta >= 0 ? '+' : ''}${formatCOP(mod.priceDelta)}`)
        })
      }
    })
    
    builder.text('────────────────────────')
    builder.text(`Subtotal: ${formatCOP(receiptData.subtotal)}`, { align: 'right' })
    builder.text(`IVA (${receiptData.taxRate * 100}%): ${formatCOP(receiptData.taxAmount)}`, { align: 'right' })
    builder.text(`TOTAL: ${formatCOP(receiptData.total)}`, { align: 'right', bold: true, size: 2 })
    builder.text('────────────────────────')
    
    // Payments
    receiptData.payments.forEach((p) => {
      builder.text(`${p.method}: ${formatCOP(p.amount)}`, { align: 'right' })
    })
    
    if (receiptData.changeAmount > 0) {
      builder.text(`Cambio: ${formatCOP(receiptData.changeAmount)}`, { align: 'right' })
    }
    
    builder.text('────────────────────────')
    builder.text('¡Gracias por su compra!', { align: 'center' })
    
    // FDE info if available
    if (receiptData.cufe) {
      builder.text(`CUFE: ${receiptData.cufe}`)
      builder.text(`Validar en: https://catalogo-vpfe.dian.gov.co`)
    }
    
    builder.cut()
    builder.kickDrawer()
    
    await print(builder.build())
  }, [print])
  
  const kickDrawer = useCallback(async () => {
    const builder = new EscPosBuilder().kickDrawer()
    await print(builder.build())
  }, [print])
  
  // Auto-connect if previously authorized
  useEffect(() => {
    const autoConnect = async () => {
      if (!('usb' in navigator)) return
      
      try {
        const devices = await (navigator as any).usb.getDevices()
        const printer = devices.find((d: USBDevice) => d.deviceClass === 0x07)
        
        if (printer) {
          await printer.open()
          // Re-claim interface...
          // This is simplified - full implementation would restore state
        }
      } catch {}
    }
    
    autoConnect()
    
    return () => {
      disconnect()
    }
  }, [disconnect])
  
  return {
    ...state,
    connect,
    disconnect,
    print,
    printReceipt,
    kickDrawer,
  }
}

// Cash drawer (often connected via printer or separate USB)
export function useCashDrawer() {
  const { print, isConnected } = useThermalPrinter()
  
  const open = useCallback(async () => {
    if (isConnected) {
      await print(new EscPosBuilder().kickDrawer().build())
    }
  }, [print, isConnected])
  
  return { open, isConnected }
}

// Receipt data types
interface ReceiptData {
  businessName: string
  businessAddress: string
  businessTaxId: string
  saleNumber: string
  timestamp: string
  cashierName: string
  items: ReceiptItem[]
  subtotal: number
  taxAmount: number
  total: number
  taxRate: number
  payments: { method: string; amount: number }[]
  changeAmount: number
  cufe?: string
}

interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  modifiers?: { name: string; priceDelta: number }[]
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount)
}