import { Menu, Bell, LogOut, User, ChevronDown, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks'
import { usePOS } from '@/features/pos/posStore'
import { cn } from '@/shared/utils/cn'
import { useSync } from '@/features/pos/hooks/useSync'

interface HeaderProps {
  onMenuClick: () => void
  user: { name: string; role: string; businessType: string } | null
  onLogout: () => void
}

export function Header({ onMenuClick, user, onLogout }: HeaderProps) {
  const { isOnline, pendingCount, lastSync } = useSync()
  const { isSidebarOpen } = usePOS()
  
  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-accent transition-colors touch-target"
            aria-label="Toggle menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">POS</span>
            </div>
            <span className="font-semibold text-lg">Sistema POS</span>
          </div>
        </div>
        
        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Online/Offline status */}
          <div className="flex items-center gap-2">
            <span className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
              isOnline
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 animate-pulse'
            )}>
              {isOnline ? (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  En línea
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  Fuera de línea
                </>
              )}
            </span>
            
            {/* Pending sync count */}
            {!isOnline && pendingCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 text-xs font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
              </span>
            )}
            
            {/* Last sync */}
            {isOnline && lastSync && (
              <span className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Última sync: {new Date(lastSync).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          
          {/* User menu */}
          <div className="relative">
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors touch-target"
              id="user-menu-button"
              aria-expanded="false"
              aria-haspopup="true"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-medium">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium truncate max-w-[150px]">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            
            {/* Dropdown menu */}
            <div
              className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-popover border border-border shadow-lg py-1 animate-fade-in"
              role="menu"
              aria-orientation="vertical"
            >
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role} · {user?.businessType === 'restaurant' ? 'Restaurante' : 'Abarrotes'}</p>
              </div>
              
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}