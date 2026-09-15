import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks'
import { Layout } from './layout/Layout'
import { LoginPage } from '@/features/auth/LoginPage'
import { PosPage } from '@/features/pos/pages/PosPage'
import { SaleHistoryPage } from '@/features/pos/pages/SaleHistoryPage'
import { ProductsPage } from '@/features/catalog/ProductsPage'
import { CategoriesPage } from '@/features/catalog/CategoriesPage'
import { IngredientsPage } from '@/features/catalog/IngredientsPage'
import { RecipesPage } from '@/features/catalog/RecipesPage'
import { ModifiersPage } from '@/features/catalog/ModifiersPage'
import { InventoryPage } from '@/features/inventory/InventoryPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { FDEDocumentsPage } from '@/features/fde/FDEDocumentsPage'
import { FDESettingsPage } from '@/features/fde/FDESettingsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { OfflineBanner } from './layout/OfflineBanner'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    )
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function BusinessTypeRoute({ allowedTypes, children }: { allowedTypes: string[]; children: React.ReactNode }) {
  const { user } = useAuth()
  
  if (!user || !allowedTypes.includes(user.businessType)) {
    return <Navigate to="/pos" replace />
  }
  
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/ca-cert/*" element={<Navigate to="/ca-cert" replace />} />
      
      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <Layout>
              <OfflineBanner />
              <Outlet />
            </Layout>
          </ProtectedRoute>
        }
      >
        {/* POS */}
        <Route path="/pos" element={<PosPage />} />
        <Route path="/pos/history" element={<SaleHistoryPage />} />
        
        {/* Catalog */}
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        
        {/* Restaurant only */}
        <Route
          element={
            <BusinessTypeRoute allowedTypes={['restaurant']}>
              <Outlet />
            </BusinessTypeRoute>
          }
        >
          <Route path="/ingredients" element={<IngredientsPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/modifiers" element={<ModifiersPage />} />
        </Route>
        
        {/* Inventory */}
        <Route path="/inventory" element={<InventoryPage />} />
        
        {/* Reports */}
        <Route path="/reports" element={<ReportsPage />} />
        
        {/* FDE */}
        <Route path="/fde/documents" element={<FDEDocumentsPage />} />
        <Route path="/fde/settings" element={<FDESettingsPage />} />
        
        {/* Settings */}
        <Route path="/settings" element={<SettingsPage />} />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/pos" replace />} />
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Route>
    </Routes>
  )
}