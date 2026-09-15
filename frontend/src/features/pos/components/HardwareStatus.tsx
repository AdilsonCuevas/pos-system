'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, Usb, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { useBarcodeScanner } from '@/shared/hooks/useWebHID'
import { useThermalPrinter, useCashDrawer } from '@/shared/hooks/useWebUSB'

export function HardwareStatus() {
  const [isOnline, setIsOnline] = useState(true)
  
  const scanner = useBarcodeScanner({
    onScan: (code) => {
      // Scanner events are handled by POS page via keyboard wedge
      console.log('Scanner:', code)
    },
  })
  
  const printer = useThermalPrinter()
  const cashDrawer = useCashDrawer()
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  
  return (
    <div className="fixed bottom-4 right-4 z-40 lg:hidden">
      <Card className="w-72">
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Hardware</span>
            <Badge variant={isOnline ? 'success' : 'warning'}>
              {isOnline ? 'En línea' : 'Fuera de línea'}
            </Badge>
          </div>
          
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span>Escáner</span>
              <Badge variant={scanner.isConnected ? 'success' : 'secondary'}>
                {scanner.isConnected ? 'Conectado' : 'Desconectado'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Impresora</span>
              <Badge variant={printer.isConnected ? 'success' : 'secondary'}>
                {printer.isConnected ? 'Conectada' : 'Desconectada'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Cajón</span>
              <Badge variant={cashDrawer.isConnected ? 'success' : 'secondary'}>
                {cashDrawer.isConnected ? 'Conectado' : 'Desconectado'}
              </Badge>
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => scanner.toggle()}>
              {scanner.isConnected ? 'Desconectar escáner' : 'Conectar escáner'}
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => printer.connect()}>
              Conectar impresora
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}