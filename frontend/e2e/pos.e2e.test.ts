// Playwright E2E Tests

import { test, expect } from '@playwright/test'

test.describe('POS System E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to POS
    await page.goto('https://pos.local')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
  })

  test.describe('Authentication', () => {
    test('should show login page', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('Iniciar Sesión')
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
    })

    test('should login successfully', async ({ page }) => {
      await page.fill('input[type="email"]', 'admin@test.com')
      await page.fill('input[type="password"]', 'admin123')
      await page.click('button:has-text("Iniciar Sesión")')
      
      // Should redirect to POS
      await expect(page).toHaveURL(/.*pos/)
      await expect(page.locator('text=Punto de Venta')).toBeVisible()
    })

    test('should show error for invalid credentials', async ({ page }) => {
      await page.fill('input[type="email"]', 'wrong@test.com')
      await page.fill('input[type="password"]', 'wrong')
      await page.click('button:has-text("Iniciar Sesión")')
      
      await expect(page.locator('text=Credenciales inválidas')).toBeVisible()
    })
  })

  test.describe('POS - Grocery Store', () => {
    test.beforeEach(async ({ page }) => {
      // Login as grocery cashier
      await page.goto('https://pos.local/login')
      await page.fill('input[type="email"]', 'grocery@test.com')
      await page.fill('input[type="password"]', 'grocery123')
      await page.click('button:has-text("Iniciar Sesión")')
      await expect(page).toHaveURL(/.*pos/)
    })

    test('should show product grid with categories', async ({ page }) => {
      await expect(page.locator('text=Todos')).toBeVisible()
      await expect(page.locator('text=Abarrotes')).toBeVisible()
      await expect(page.locator('text=Bebidas')).toBeVisible()
    })

    test('should add product to cart by clicking', async ({ page }) => {
      // Click on first product
      await page.click('[data-testid="product-card"]:first-child')
      
      // Check cart drawer opens
      await expect(page.locator('text=Carrito (1)')).toBeVisible()
      await expect(page.locator('text=$10.000')).toBeVisible() // Assuming first product is $10.000
    })

    test('should update quantity in cart', async ({ page }) => {
      // Add product
      await page.click('[data-testid="product-card"]:first-child')
      
      // Increase quantity
      await page.click('button[aria-label="incrementar"]')
      
      // Check quantity updated
      await expect(page.locator('text=2')).toBeVisible()
    })

    test('should complete cash payment', async ({ page }) => {
      // Add product
      await page.click('[data-testid="product-card"]:first-child')
      
      // Click payment
      await page.click('button:has-text("Pagar")')
      
      // Select cash
      await page.click('text=Efectivo')
      
      // Enter amount
      await page.fill('input[placeholder="0"]', '15000')
      await page.click('text=Agregar')
      
      // Complete sale
      await page.click('text=Completar Venta')
      
      // Should show success
      await expect(page.locator('text=Venta completada')).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('POS - Restaurant', () => {
    test.beforeEach(async ({ page }) => {
      // Login as restaurant cashier
      await page.goto('https://pos.local/login')
      await page.fill('input[type="email"]', 'cashier@test.com')
      await page.fill('input[type="password"]', 'cashier123')
      await page.click('button:has-text("Iniciar Sesión")')
      await expect(page).toHaveURL(/.*pos/)
    })

    test('should show restaurant categories', async ({ page }) => {
      await expect(page.locator('text=Entradas')).toBeVisible()
      await expect(page.locator('text=Platos Fuertes')).toBeVisible()
      await expect(page.locator('text=Bebidas')).toBeVisible()
    })

    test('should show modifiers for composite product', async ({ page }) => {
      // Click on composite product (hamburger)
      await page.click('text=Hamburguesa Clásica')
      
      // Modifier modal should open
      await expect(page.locator('text=Personalizar: Hamburguesa Clásica')).toBeVisible()
      await expect(page.locator('text=Queso')).toBeVisible()
      
      // Select modifier
      await page.click('text=Queso extra')
      await page.click('text=Confirmar')
      
      // Should add to cart with modifier
      await expect(page.locator('text=Hamburguesa Clásica')).toBeVisible()
      await expect(page.locator('text=Queso extra')).toBeVisible()
    })

    test('should complete card payment', async ({ page }) => {
      // Add product with modifier
      await page.click('text=Hamburguesa Clásica')
      await page.click('text=Queso extra')
      await page.click('text=Confirmar')
      
      // Payment
      await page.click('text=Pagar')
      await page.click('text=Tarjeta')
      await page.fill('input[placeholder="Últimos 4 dígitos"]', '1234')
      await page.click('text=Agregar')
      await page.click('text=Completar Venta')
      
      await expect(page.locator('text=Venta completada')).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Offline Mode', () => {
    test('should work offline', async ({ page, context }) => {
      // Login first
      await page.goto('https://pos.local/login')
      await page.fill('input[type="email"]', 'cashier@test.com')
      await page.fill('input[type="password"]', 'cashier123')
      await page.click('button:has-text("Iniciar Sesión")')
      
      // Go offline
      await context.setOffline(true)
      
      // Should show offline banner
      await expect(page.locator('text=Fuera de línea')).toBeVisible()
      
      // Should still be able to make sales
      await page.click('[data-testid="product-card"]:first-child')
      await page.click('text=Pagar')
      await page.click('text=Efectivo')
      await page.fill('input[placeholder="0"]', '15000')
      await page.click('text=Agregar')
      await page.click('text=Completar Venta')
      
      // Should queue for sync
      await expect(page.locator('text=pendiente')).toBeVisible()
      
      // Go online
      await context.setOffline(false)
      
      // Should sync
      await expect(page.locator('text=En línea')).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Inventory Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('https://pos.local/login')
      await page.fill('input[type="email"]', 'admin@test.com')
      await page.fill('input[type="password"]', 'admin123')
      await page.click('button:has-text("Iniciar Sesión")')
    })

    test('should create product', async ({ page }) => {
      await page.click('text=Productos')
      await page.click('text=Nuevo Producto')
      
      await page.fill('input[name="name"]', 'Producto Test E2E')
      await page.fill('input[name="sku"]', 'E2E-001')
      await page.fill('input[name="price"]', '15000')
      await page.selectOption('select[name="category_id"]', '1')
      await page.click('text=Crear')
      
      await expect(page.locator('text=Producto Test E2E')).toBeVisible()
    })

    test('should adjust inventory', async ({ page }) => {
      await page.click('text=Inventario')
      await page.click('text=Ajustes')
      
      await page.selectOption('select[name="reference_type"]', 'product')
      await page.selectOption('select[name="reference_id"]', '1')
      await page.selectOption('select[name="type"]', 'entry')
      await page.fill('input[name="quantity"]', '50')
      await page.selectOption('select[name="reason"]', 'compra')
      await page.fill('input[name="reference"]', 'OC-E2E-001')
      await page.click('text=Registrar Ajuste')
      
      await expect(page.locator('text=Ajuste registrado')).toBeVisible()
    })
  })

  test.describe('Reports', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('https://pos.local/login')
      await page.fill('input[type="email"]', 'admin@test.com')
      await page.fill('input[type="password"]', 'admin123')
      await page.click('button:has-text("Iniciar Sesión")')
    })

    test('should show sales report', async ({ page }) => {
      await page.click('text=Reportes')
      await expect(page.locator('text=Ventas Totales')).toBeVisible()
      await expect(page.locator('text=Ingresos Totales')).toBeVisible()
    })

    test('should export sales report', async ({ page }) => {
      await page.click('text=Reportes')
      await page.click('text=Exportar Ventas')
      
      // Should download file
      const downloadPromise = page.waitForEvent('download')
      await page.click('text=Exportar Ventas')
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('ventas')
    })
  })

  test.describe('FDE (Factura Electrónica)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('https://pos.local/login')
      await page.fill('input[type="email"]', 'admin@test.com')
      await page.fill('input[type="password"]', 'admin123')
      await page.click('button:has-text("Iniciar Sesión")')
    })

    test('should configure PAC', async ({ page }) => {
      await page.click('text=Configuración')
      await page.click('text=FDE')
      await page.click('text=Proveedor PAC')
      
      await page.selectOption('select[name="pac_provider"]', 'tecnodata')
      await page.fill('input[name="tecnodata_api_key"]', 'test_key_123')
      await page.click('text=Guardar Configuración PAC')
      
      await expect(page.locator('text=Configuración PAC guardada')).toBeVisible()
    })

    test('should configure company info', async ({ page }) => {
      await page.click('text=Configuración')
      await page.click('text=FDE')
      await page.click('text=Datos Empresa')
      
      await page.fill('input[name="company_nit"]', '900123456')
      await page.fill('input[name="company_name"]', 'EMPRESA E2E SAS')
      await page.fill('input[name="company_address"]', 'Calle 123 #45-67')
      await page.fill('input[name="company_city"]', 'BOGOTA')
      await page.fill('input[name="company_department"]', 'CUNDINAMARCA')
      await page.click('text=Guardar Datos de Empresa')
      
      await expect(page.locator('text=Información de empresa guardada')).toBeVisible()
    })

    test('should configure numbering', async ({ page }) => {
      await page.click('text=Configuración')
      await page.click('text=FDE')
      await page.click('text=Numeración DIAN')
      await page.click('text=Agregar Prefijo')
      
      await page.fill('input[name="prefix"]', 'POS')
      await page.fill('input[name="resolution_number"]', '18760000001')
      await page.fill('input[name="resolution_date"]', '2024-01-15')
      await page.fill('input[name="valid_from"]', '2024-01-15')
      await page.fill('input[name="valid_until"]', '2025-01-15')
      await page.fill('input[name="range_start"]', '1')
      await page.fill('input[name="range_end"]', '999999')
      await page.click('text=Crear')
      
      await expect(page.locator('text=POS')).toBeVisible()
    })
  })

  test.describe('Settings', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('https://pos.local/login')
      await page.fill('input[type="email"]', 'admin@test.com')
      await page.fill('input[type="password"]', 'admin123')
      await page.click('button:has-text("Iniciar Sesión")')
    })

    test('should manage users', async ({ page }) => {
      await page.click('text=Configuración')
      await page.click('text=Usuarios')
      
      await page.click('text=Nuevo Usuario')
      await page.fill('input[name="email"]', 'newuser@test.com')
      await page.fill('input[name="password"]', 'password123')
      await page.fill('input[name="name"]', 'Nuevo Usuario')
      await page.selectOption('select[name="role"]', 'cashier')
      await page.click('text=Crear')
      
      await expect(page.locator('text=Nuevo Usuario')).toBeVisible()
    })

    test('should configure hardware', async ({ page }) => {
      await page.click('text=Configuración')
      await page.click('text=Hardware')
      
      await expect(page.locator('text=Escáner')).toBeVisible()
      expect(screen.getByText('Impresora')).toBeVisible()
      expect(screen.getByText('Cajón')).toBeVisible()
    })

    test('should configure backup', async ({ page }) => {
      await page.click('text=Configuración')
      await page.click('text=Respaldo')
      
      await page.check('input[name="auto_backup"]')
      await page.fill('input[name="backup_time"]', '03:00')
      await page.fill('input[name="retention_days"]', '60')
      await page.click('text=Guardar Configuración de Respaldo')
      
      await expect(page.locator('text=Configuración de Respaldo guardada')).toBeVisible()
    })
  })

  test.describe('User Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('https://pos.local/login')
      await page.fill('input[type="email"]', 'admin@test.com')
      await page.fill('input[type="password"]', 'admin123')
      await page.click('button:has-text("Iniciar Sesión")')
    })

    test('should revoke user sessions', async ({ page }) => {
      await page.click('text=Configuración')
      await page.click('text=Usuarios')
      
      // Find user and click revoke
      await page.click('button[aria-label="Revocar sesiones"]:first-child')
      
      await expect(page.locator('text=Sesiones revocadas')).toBeVisible()
    })

    test('should deactivate user', async ({ page }) => {
      await page.click('text=Configuración')
      await page.click('text=Usuarios')
      
      // Click edit on a user
      await page.click('button[aria-label="Editar"]:first-child')
      
      // Uncheck active
      await page.uncheck('input[name="is_active"]')
      await page.click('text=Actualizar')
      
      await expect(page.locator('text=Usuario actualizado')).toBeVisible()
    })
  })

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      
      await page.goto('https://pos.local/login')
      await page.fill('input[type="email"]', 'cashier@test.com')
      await page.fill('input[type="password"]', 'cashier123')
      await page.click('button:has-text("Iniciar Sesión")')
      
      await expect(page.locator('text=Punto de Venta')).toBeVisible()
      
      // Sidebar should be collapsible
      await page.click('button[aria-label="Toggle menu"]')
      await expect(page.locator('text=Punto de Venta')).toBeVisible()
    })

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })
      
      await page.goto('https://pos.local/login')
      await page.fill('input[type="email"]', 'cashier@test.com')
      await page.fill('input[type="password"]', 'cashier123')
      await page.click('button:has-text("Iniciar Sesión")')
      
      await expect(page.locator('text=Punto de Venta')).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('https://pos.local/login')
      
      // Check form labels
      await expect(page.locator('label[for="email"]')).toBeVisible()
      await expect(page.locator('label[for="password"]')).toBeVisible()
      
      // Check button roles
      await expect(page.locator('button[type="submit"]')).toHaveAttribute('role', 'button')
    })

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('https://pos.local/login')
      
      // Tab through form
      await page.keyboard.press('Tab')
      await expect(page.locator('input[type="email"]')).toBeFocused()
      
      await page.keyboard.press('Tab')
      await expect(page.locator('input[type="password"]')).toBeFocused()
      
      await page.keyboard.press('Tab')
      await expect(page.locator('button[type="submit"]')).toBeFocused()
    })
  })

  test.describe('Performance', () => {
    test('should load POS page within 3 seconds', async ({ page }) => {
      const startTime = Date.now()
      
      await page.goto('https://pos.local/login')
      await page.fill('input[type="email"]', 'cashier@test.com')
      await page.fill('input[type="password"]', 'cashier123')
      await page.click('button:has-text("Iniciar Sesión")')
      
      await expect(page.locator('text=Punto de Venta')).toBeVisible()
      
      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(3000)
    })

    test('should handle rapid clicks', async ({ page }) => {
      await page.goto('https://pos.local/login')
      await page.fill('input[type="email"]', 'cashier@test.com')
      await page.fill('input[type="password"]', 'cashier123')
      await page.click('button:has-text("Iniciar Sesión")')
      
      await expect(page.locator('text=Punto de Venta')).toBeVisible()
      
      // Rapid clicks on product
      for (let i = 0; i < 5; i++) {
        await page.click('[data-testid="product-card"]:first-child')
      }
      
      // Should handle gracefully
      await expect(page.locator('text=Carrito (5)')).toBeVisible()
    })
  })
})

// Test configuration
test.use({
  baseURL: 'https://pos.local',
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
  video: 'on-first-retry',
  screenshot: 'only-on-failure',
  trace: 'on-first-retry',
})

// Global test timeout
test.setTimeout(60000)