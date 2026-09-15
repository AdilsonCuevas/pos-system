import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  Utensils,
  ChefHat,
  SlidersHorizontal,
  ClipboardList,
  FileText,
  Settings,
  Truck,
  Archive,
  HelpCircle,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/features/auth/hooks'
import { usePOS } from '@/features/pos/posStore'
import { cn } from '@/shared/utils/cn'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navigation = [
  { name: 'Dashboard', href: '/pos', icon: LayoutDashboard },
  { name: 'Punto de Venta', href: '/pos', icon: ShoppingCart },
  { name: 'Historial', href: '/pos/history', icon: ClipboardList },
  { name: 'Productos', href: '/products', icon: Package },
  { name: 'Categorías', href: '/categories', icon: Tags },
  // Restaurant only - conditionally rendered
  { name: 'Ingredientes', href: '/ingredients', icon: Utensils, businessType: 'restaurant' },
  { name: 'Recetas', href: '/recipes', icon: ChefHat, businessType: 'restaurant' },
  { name: 'Modificadores', href: '/modifiers', icon: SlidersHorizontal, businessType: 'restaurant' },
  { name: 'Inventario', href: '/inventory', icon: Archive },
  { name: 'Compras', href: '/inventory/purchase-orders', icon: Truck },
  { name: 'Conteos', href: '/inventory/counts', icon: ClipboardList },
  { name: 'Reportes', href: '/reports', icon: FileText },
  { name: 'Documentos FDE', href: '/fde/documents', icon: FileText },
  { name: 'Configuración', href: '/settings', icon: Settings },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const { user } = useAuth()
  const businessType = user?.businessType || 'grocery'
  
  return (
    <>
      {/* Mobile overlay handled in Layout */}
      
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Sidebar navigation"
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center justify-center border-b border-border px-4">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">POS</span>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1" role="navigation" aria-label="Main navigation">
          {navigation.map((item) => {
            // Filter by business type
            if (item.businessType && item.businessType !== businessType) {
              return null
            }
            
            const Icon = item.icon
            const isActive = location.pathname === item.href || 
              (item.href !== '/pos' && location.pathname.startsWith(item.href))
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors touch-target',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{item.name}</span>
                {isActive && <ChevronRight className="h-4 w-4 ml-auto" aria-hidden="true" />}
              </NavLink>
            )
          })}
        </nav>
        
        {/* Footer */}
        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted-foreground text-center">
            <p>Sistema POS v1.0.0</p>
            <p className="mt-1">LAN-only · HTTPS · FDE DIAN</p>
          </div>
        </div>
      </aside>
    </>
  )
}