'use client'

import { useSync } from '@/features/pos/hooks/useSync'
import { Wifi, WifiOff, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { cn } from '@/shared/utils/cn'

export function OfflineBanner() {
  const { isOnline, pendingCount, lastSync, triggerSync, retryFailed } = useSync()
  
  if (isOnline) return null
  
  return (
    <div className={cn(
      'fixed top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-200',
      'animate-slide-in-right'
    )}>
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">Modo fuera de línea</p>
              <p className="text-sm text-amber-700">
                {pendingCount > 0 && `Tienes ${pendingCount} venta${pendingCount > 1 ? 's' : ''} pendiente${pendingCount > 1 ? 's' : ''} de sincronizar`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {lastSync && (
              <span className="text-xs text-amber-700">
                Última sync: {new Date(lastSync).toLocaleTimeString('es-CO')}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={triggerSync} disabled={pendingCount === 0}>
              <Loader2 className="mr-1.5 h-3.5 w-3.5" />
              Sincronizar ahora
            </Button>
            <Button variant="ghost" size="sm" onClick={retryFailed} disabled={!pendingCount}>
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              Reintentar fallidos
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}