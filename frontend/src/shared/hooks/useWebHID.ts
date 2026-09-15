import { useEffect, useRef, useState, useCallback } from 'react'

interface BarcodeScannerOptions {
  onScan: (code: string, format: string) => void
  onError?: (error: Error) => void
  filters?: HIDDeviceFilter[]
}

interface ScannerState {
  isConnected: boolean
  isScanning: boolean
  device: HIDDevice | null
  error: string | null
}

export function useBarcodeScanner({
  onScan,
  onError,
  filters = [{ usagePage: 0x0C, usage: 0x01 }], // Generic desktop / barcode scanner
}: BarcodeScannerOptions) {
  const [state, setState] = useState<ScannerState>({
    isConnected: false,
    isScanning: false,
    device: null,
    error: null,
  })
  
  const deviceRef = useRef<HIDDevice | null>(null)
  const reportBufferRef = useRef<string>('')
  
  const parseReport = useCallback((report: DataView) => {
    // Parse HID keyboard report for barcode scanners
    // Most scanners act as keyboards and send key codes
    const bytes = new Uint8Array(report.buffer)
    
    // Simple parser for common HID keyboard usage
    // This is a basic implementation - real scanners may need more complex parsing
    let code = ''
    for (let i = 2; i < bytes.length; i++) {
      const key = bytes[i]
      if (key === 0) continue
      if (key === 40) { // Enter key - end of scan
        if (code) {
          onScan(code, 'EAN13') // Default format
          code = ''
        }
        break
      }
      // Map HID key codes to characters (simplified)
      if (key >= 4 && key <= 29) { // a-z
        code += String.fromCharCode(93 + key)
      } else if (key >= 30 && key <= 38) { // 1-9,0
        code += String.fromCharCode(19 + key)
      } else if (key === 39) { // 0
        code += '0'
      }
    }
  }, [onScan])
  
  const handleInputReport = useCallback((event: HIDInputReportEvent) => {
    if (event.device === deviceRef.current) {
      parseReport(event.report)
    }
  }, [parseReport])
  
  const connect = useCallback(async () => {
    try {
      if (!('hid' in navigator)) {
        throw new Error('WebHID no soportado en este navegador')
      }
      
      const devices = await (navigator as any).hid.requestDevice({ filters })
      if (devices.length === 0) {
        throw new Error('No se seleccionó ningún dispositivo')
      }
      
      const device = devices[0]
      await device.open()
      
      deviceRef.current = device
      device.addEventListener('inputreport', handleInputReport)
      
      setState({
        isConnected: true,
        isScanning: true,
        device,
        error: null,
      })
      
      // Listen for disconnect
      device.addEventListener('disconnect', () => {
        disconnect()
      })
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error al conectar escáner')
      setState((prev) => ({ ...prev, error: error.message, isConnected: false }))
      onError?.(error)
    }
  }, [filters, handleInputReport, onError])
  
  const disconnect = useCallback(async () => {
    if (deviceRef.current) {
      try {
        deviceRef.current.removeEventListener('inputreport', handleInputReport)
        await deviceRef.current.close()
      } catch {}
      deviceRef.current = null
    }
    
    setState({
      isConnected: false,
      isScanning: false,
      device: null,
      error: null,
    })
  }, [handleInputReport])
  
  const toggle = useCallback(() => {
    if (state.isConnected) {
      disconnect()
    } else {
      connect()
    }
  }, [state.isConnected, connect, disconnect])
  
  // Auto-connect if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      if (!('hid' in navigator)) return
      
      try {
        const devices = await (navigator as any).hid.getDevices()
        const scanner = devices.find((d: HIDDevice) => 
          filters.some(f => d.productId === f.productId || d.vendorId === f.vendorId)
        )
        
        if (scanner) {
          await scanner.open()
          deviceRef.current = scanner
          scanner.addEventListener('inputreport', handleInputReport)
          
          setState({
            isConnected: true,
            isScanning: true,
            device: scanner,
            error: null,
          })
        }
      } catch {}
    }
    
    autoConnect()
    
    return () => {
      disconnect()
    }
  }, [filters, handleInputReport, disconnect])
  
  return {
    ...state,
    connect,
    disconnect,
    toggle,
  }
}

// Keyboard fallback for scanners that don't support WebHID
export function useKeyboardWedgeScanner(onScan: (code: string) => void) {
  const bufferRef = useRef<string>('')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      
      // Handle printable characters
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        bufferRef.current += event.key
      }
      
      // Enter key = end of scan
      if (event.key === 'Enter' && bufferRef.current.length > 0) {
        onScan(bufferRef.current)
        bufferRef.current = ''
      }
      
      // Clear buffer after pause (scanners send quickly)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        bufferRef.current = ''
      }, 100)
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onScan])
}