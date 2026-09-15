import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAuth } from '@/features/auth/hooks'
import { usePOS } from '@/features/pos/posStore'
import { cn } from '@/shared/utils/cn'

export function Layout() {
  const { user, logout } = useAuth()
  const { isSidebarOpen, toggleSidebar } = usePOS()
  
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} />
      
      {/* Main content */}
      <div className={cn(
        'flex-1 flex flex-col min-w-0',
        isSidebarOpen ? 'lg:pl-64' : 'lg:pl-16'
      )}>
        {/* Header */}
        <Header onMenuClick={toggleSidebar} user={user} onLogout={logout} />
        
        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
      
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
    </div>
  )
}