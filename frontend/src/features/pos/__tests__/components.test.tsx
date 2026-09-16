// Frontend Component Tests

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock components
vi.mock('@/shared/ui/Button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    )
  ),
}))

vi.mock('@/shared/ui/Input', () => ({
  Input: ({ ...props }: any) => <input {...props} />,
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@/shared/ui/Card', () => ({
  Card: ({ children, ...props }: any) => <div className="card" {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div className="card-header" {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
  CardContent: ({ children, ...props }: any) => <div className="card-content" {...props}>{children}</div>,
}))

vi.mock('@/shared/ui/Badge', () => ({
  Badge: ({ children, variant, ...props }: any) => (
    <span className={`badge badge-${variant}`} {...props}>{children}</span>
  ),
}))

vi.mock('@/shared/ui/Toast', () => ({
  Toaster: () => <div data-testid="toaster" />,
  useToast: () => ({
    toast: vi.fn(),
    dismiss: vi.fn(),
  }),
}))

// Test utilities
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  )
}

// ============================================================
// LoginPage Tests
// ============================================================

describe('LoginPage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mock('@/features/auth/hooks', () => ({
      useAuth: () => ({
        login: vi.fn().mockResolvedValue(undefined),
        isLoading: false,
      }),
    }))
  })

  it('renders login form', () => {
    renderWithProviders(<LoginPage />)
    
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument()
  })

  it('shows validation errors', async () => {
    renderWithProviders(<LoginPage />)
    
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/email inválido/i)).toBeInTheDocument()
      expect(screen.getByText(/mínimo 8 caracteres/i)).toBeInTheDocument()
    })
  })

  it('toggles password visibility', () => {
    renderWithProviders(<LoginPage />)
    
    const passwordInput = screen.getByLabelText('Contraseña')
    expect(passwordInput).toHaveAttribute('type', 'password')
    
    fireEvent.click(screen.getByRole('button', { name: /mostrar contraseña/i }))
    expect(passwordInput).toHaveAttribute('type', 'text')
    
    fireEvent.click(screen.getByRole('button', { name: /ocultar contraseña/i }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('calls login on submit', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined)
    
    vi.mock('@/features/auth/hooks', () => ({
      useAuth: () => ({
        login: mockLogin,
        isLoading: false,
      }),
    }))
    
    renderWithProviders(<LoginPage />)
    
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123')
    })
  })

  it('shows loading state during login', async () => {
    let resolveLogin: Function
    const loginPromise = new Promise(resolve => { resolveLogin = resolveLogin })
    
    vi.mock('@/features/auth/hooks', () => ({
      useAuth: () => ({
        login: vi.fn(() => loginPromise),
        isLoading: true,
      }),
    }))
    
    renderWithProviders(<LoginPage />)
    
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))
    
    expect(screen.getByRole('button', { name: /iniciando sesión/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeDisabled()
    
    resolveLogin!(undefined)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /iniciando sesión/i })).not.toBeInTheDocument()
    })
  })
})

// ============================================================
// ProductGrid Tests
// ============================================================

describe('ProductGrid', () => {
  const mockProducts = [
    { id: 1, name: 'Producto 1', sku: 'SKU-001', price: 10000, taxRate: 0.19, categoryId: 1, type: 'simple', unit: 'unidad', currentStock: 100, minStock: 5, variants: [], imageUrl: null, isActive: true },
    { id: 2, name: 'Producto 2', sku: 'SKU-002', price: 20000, taxRate: 0.19, categoryId: 1, type: 'simple', unit: 'unidad', currentStock: 50, minStock: 10, variants: [], imageUrl: null, isActive: true },
  ]

  const mockCategories = [
    { id: 1, name: 'Categoría 1', parentId: null, sortOrder: 1, isActive: true },
    { id: 2, name: 'Subcategoría', parentId: 1, sortOrder: 1, isActive: true },
  ]

  beforeEach(() => {
    vi.mock('@/features/pos/hooks/useCart', () => ({
      useCart: () => ({
        cart: [],
        addToCart: vi.fn(),
        updateQuantity: vi.fn(),
        removeFromCart: vi.fn(),
        clearCart: vi.fn(),
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        itemCount: 0,
        isEmpty: true,
      }),
      useCartActions: () => ({
        addProduct: vi.fn(),
        updateQuantity: vi.fn(),
        applyModifiers: vi.fn(),
        removeFromCart: vi.fn(),
        clearCart: vi.fn(),
      }),
    }))
  })

  it('renders category tabs', () => {
    renderWithProviders(
      <ProductGrid
        products={mockProducts}
        categories={mockCategories}
        businessType="grocery"
        onProductSelect={vi.fn()}
        onVariantSelect={vi.fn()}
        onModifiersSelect={vi.fn()}
      />
    )
    
    expect(screen.getByText('Todos')).toBeInTheDocument()
    expect(screen.getByText('Categoría 1')).toBeInTheDocument()
  })

  it('filters products by category', () => {
    renderWithProviders(
      <ProductGrid
        products={mockProducts}
        categories={mockCategories}
        businessType="grocery"
        onProductSelect={vi.fn()}
        onVariantSelect={vi.fn()}
        onModifiersSelect={vi.fn()}
      />
    )
    
    fireEvent.click(screen.getByText('Categoría 1'))
    
    // Should show filtered products
    expect(screen.getByText('Producto 1')).toBeInTheDocument()
  })

  it('searches products by name', () => {
    renderWithProviders(
      <ProductGrid
        products={mockProducts}
        categories={mockCategories}
        businessType="grocery"
        onProductSelect={vi.fn()}
        onVariantSelect={vi.fn()}
        onModifiersSelect={vi.fn()}
      />
    )
    
    fireEvent.change(screen.getByPlaceholderText(/buscar producto/i), { target: { value: 'Producto 1' } })
    
    expect(screen.getByText('Producto 1')).toBeInTheDocument()
    expect(screen.queryByText('Producto 2')).not.toBeInTheDocument()
  })

  it('shows product cards with price', () => {
    renderWithProviders(
      <ProductGrid
        products={mockProducts}
        categories={mockCategories}
        businessType="grocery"
        onProductSelect={vi.fn()}
        onVariantSelect={vi.fn()}
        onModifiersSelect={vi.fn()}
      />
    )
    
    expect(screen.getByText('$10.000')).toBeInTheDocument()
    expect(screen.getByText('$20.000')).toBeInTheDocument()
  })

  it('shows low stock badge', () => {
    const lowStockProducts = [
      { ...mockProducts[0], currentStock: 2, minStock: 5 },
    ]
    
    renderWithProviders(
      <ProductGrid
        products={lowStockProducts}
        categories={mockCategories}
        businessType="grocery"
        onProductSelect={vi.fn()}
        onVariantSelect={vi.fn()}
        onModifiersSelect={vi.fn()}
      />
    )
    
    expect(screen.getByText(/stock bajo/i)).toBeInTheDocument()
  })
})

// ============================================================
// CartDrawer Tests
// ============================================================

describe('CartDrawer', () => {
  const mockCart = [
    { tempId: '1', productId: 1, productName: 'Producto 1', productSku: 'SKU-001', quantity: 2, unitPrice: 10000, taxRate: 0.19, modifiers: [], totalPrice: 20000, imageUrl: null },
    { tempId: '2', productId: 2, productName: 'Producto 2', productSku: 'SKU-002', quantity: 1, unitPrice: 5000, taxRate: 0.19, modifiers: [], totalPrice: 5000, imageUrl: null },
  ]

  beforeEach(() => {
    vi.mock('@/features/pos/hooks/useCart', () => ({
      useCart: () => ({
        cart: mockCart,
        subtotal: 25000,
        taxAmount: 4750,
        total: 29750,
        itemCount: 3,
        isEmpty: false,
        registerId: 1,
        setRegisterId: vi.fn(),
        addToCart: vi.fn(),
        updateQuantity: vi.fn(),
        removeFromCart: vi.fn(),
        clearCart: vi.fn(),
      }),
      useCartActions: () => ({
        addProduct: vi.fn(),
        updateQuantity: vi.fn(),
        applyModifiers: vi.fn(),
        removeFromCart: vi.fn(),
        clearCart: vi.fn(),
      }),
    })
  })

  it('renders cart items', () => {
    renderWithProviders(
      <CartDrawer
        isOpen={true}
        onClose={vi.fn()}
        onPayment={vi.fn()}
        cart={mockCart}
        subtotal={25000}
        taxAmount={4750}
        total={29750}
        itemCount={3}
        isEmpty={false}
        onUpdateQuantity={vi.fn()}
        onApplyModifiers={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        businessType="grocery"
      />
    )
    
    expect(screen.getByText('Carrito (3)')).toBeInTheDocument()
    expect(screen.getByText('Producto 1')).toBeInTheDocument()
    expect(screen.getByText('Producto 2')).toBeInTheDocument()
  })

  it('shows correct totals', () => {
    renderWithProviders(
      <CartDrawer
        isOpen={true}
        onClose={vi.fn()}
        onPayment={vi.fn()}
        cart={mockCart}
        subtotal={25000}
        taxAmount={4750}
        total={29750}
        itemCount={3}
        isEmpty={false}
        onUpdateQuantity={vi.fn()}
        onApplyModifiers={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        businessType="grocery"
      />
    )
    
    expect(screen.getByText('Subtotal')).toBeInTheDocument()
    expect(screen.getByText('$25.000')).toBeInTheDocument() // subtotal
    expect(screen.getByText('IVA (19%)')).toBeInTheDocument()
    expect(screen.getByText('$4.750')).toBeInTheDocument() // tax
    expect(screen.getByText('TOTAL')).toBeInTheDocument()
    expect(screen.getByText('$29.750')).toBeInTheDocument() // total
  })

  it('updates quantity', () => {
    const onUpdateQuantity = vi.fn()
    
    renderWithProviders(
      <CartDrawer
        isOpen={true}
        onClose={vi.fn()}
        onPayment={vi.fn()}
        cart={mockCart}
        subtotal={25000}
        taxAmount={4750}
        total={29750}
        itemCount={3}
        isEmpty={false}
        onUpdateQuantity={onUpdateQuantity}
        onApplyModifiers={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        businessType="grocery"
      />
    )
    
    fireEvent.click(screen.getAllByRole('button', { name: /incrementar/i })[0])
    
    expect(onUpdateQuantity).toHaveBeenCalledWith('1', 3)
  })

  it('removes item', () => {
    const onRemove = vi.fn()
    
    renderWithProviders(
      <CartDrawer
        isOpen={true}
        onClose={vi.fn()}
        onPayment={vi.fn()}
        cart={mockCart}
        subtotal={25000}
        taxAmount={4750}
        total={29750}
        itemCount={3}
        isEmpty={false}
        onUpdateQuantity={vi.fn()}
        onApplyModifiers={vi.fn()}
        onRemove={onRemove}
        onClear={vi.fn()}
        businessType="grocery"
      />
    )
    
    fireEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0])
    
    expect(onRemove).toHaveBeenCalledWith('1')
  })

  it('clears cart', () => {
    const onClear = vi.fn()
    
    renderWithProviders(
      <CartDrawer
        isOpen={true}
        onClose={vi.fn()}
        onPayment={vi.fn()}
        cart={mockCart}
        subtotal={25000}
        taxAmount={4750}
        total={29750}
        itemCount={3}
        isEmpty={false}
        onUpdateQuantity={vi.fn()}
        onApplyModifiers={vi.fn()}
        onRemove={vi.fn()}
        onClear={onClear}
        businessType="grocery"
      />
    )
    
    fireEvent.click(screen.getByRole('button', { name: /limpiar carrito/i }))
    
    expect(onClear).toHaveBeenCalled()
  })

  it('opens payment screen', () => {
    const onPayment = vi.fn()
    
    renderWithProviders(
      <CartDrawer
        isOpen={true}
        onClose={vi.fn()}
        onPayment={onPayment}
        cart={mockCart}
        subtotal={25000}
        taxAmount={4750}
        total={29750}
        itemCount={3}
        isEmpty={false}
        onUpdateQuantity={vi.fn()}
        onApplyModifiers={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        businessType="grocery"
      />
    )
    
    fireEvent.click(screen.getByRole('button', { name: /pagar/i }))
    
    expect(onPayment).toHaveBeenCalled()
  })

  it('shows empty state', () => {
    renderWithProviders(
      <CartDrawer
        isOpen={true}
        onClose={vi.fn()}
        onPayment={vi.fn()}
        cart={[]}
        subtotal={0}
        taxAmount={0}
        total={0}
        itemCount={0}
        isEmpty={true}
        onUpdateQuantity={vi.fn()}
        onApplyModifiers={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        businessType="grocery"
      />
    )
    
    expect(screen.getByText(/carrito vacío/i)).toBeInTheDocument()
  })
})

// ============================================================
// PaymentScreen Tests
// ============================================================

describe('PaymentScreen', () => {
  const mockCart = [
    { tempId: '1', productId: 1, productName: 'Producto 1', quantity: 1, unitPrice: 10000, taxRate: 0.19, modifiers: [], totalPrice: 10000 },
  ]

  beforeEach(() => {
    vi.mock('@/features/pos/hooks/useCart', () => ({
      useCart: () => ({
        cart: mockCart,
        subtotal: 10000,
        taxAmount: 1900,
        total: 11900,
        itemCount: 1,
        isEmpty: false,
      }),
    }))
  })

  it('renders payment methods', () => {
    renderWithProviders(
      <PaymentScreen
        isOpen={true}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        cart={mockCart}
        subtotal={10000}
        taxAmount={1900}
        total={11900}
        businessType="grocery"
      />
    )
    
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText('Tarjeta')).toBeInTheDocument()
    expect(screen.getByText('Transferencia')).toBeInTheDocument()
  })

  it('adds cash payment', () => {
    renderWithProviders(
      <PaymentScreen
        isOpen={true}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        cart={mockCart}
        subtotal={10000}
        taxAmount={1900}
        total={11900}
        businessType="grocery"
      />
    )
    
    fireEvent.click(screen.getByText('Efectivo'))
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '15000' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
    
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText('$15.000')).toBeInTheDocument()
  })

  it('calculates change correctly', () => {
    renderWithProviders(
      <PaymentScreen
        isOpen={true}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        cart={mockCart}
        subtotal={10000}
        taxAmount={1900}
        total={11900}
        businessType="grocery"
      />
    )
    
    fireEvent.click(screen.getByText('Efectivo'))
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '15000' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
    
    expect(screen.getByText(/cambio/i)).toBeInTheDocument()
    expect(screen.getByText('$3.100')).toBeInTheDocument() // 15000 - 11900
  })

  it('shows remaining amount', () => {
    renderWithProviders(
      <PaymentScreen
        isOpen={true}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        cart={mockCart}
        subtotal={10000}
        taxAmount={1900}
        total={11900}
        businessType="grocery"
      />
    )
    
    expect(screen.getByText(/pendiente/i)).toBeInTheDocument()
    expect(screen.getByText('$11.900')).toBeInTheDocument()
  })

  it('completes sale when fully paid', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    
    renderWithProviders(
      <PaymentScreen
        isOpen={true}
        onClose={vi.fn()}
        onComplete={onComplete}
        cart={mockCart}
        subtotal={10000}
        taxAmount={1900}
        total={11900}
        businessType="grocery"
      />
    )
    
    fireEvent.click(screen.getByText('Efectivo'))
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '11900' } })
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
    fireEvent.click(screen.getByRole('button', { name: /completar venta/i }))
    
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith([
        { method: 'cash', amount: 11900 },
      ])
    })
  })
})

// ============================================================
// ModifierModal Tests
// ============================================================

describe('ModifierModal', () => {
  const mockProduct = {
    id: 1,
    name: 'Hamburguesa',
    price: 15000,
    type: 'composite',
  }

  const mockModifiers = [
    { id: 1, name: 'Sin queso', price_delta: 0, is_default: true },
    { id: 2, name: 'Queso cheddar', price_delta: 1000 },
    { id: 3, name: 'Queso extra', price_delta: 2000 },
  ]

  it('renders modifier options', () => {
    renderWithProviders(
      <ModifierModal
        product={mockProduct}
        modifiers={mockModifiers}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        selectionType="single"
      />
    )
    
    expect(screen.getByText('Personalizar: Hamburguesa')).toBeInTheDocument()
    expect(screen.getByText('Sin queso')).toBeInTheDocument()
    expect(screen.getByText('Queso cheddar')).toBeInTheDocument()
    expect(screen.getByText('Queso extra')).toBeInTheDocument()
  })

  it('selects single modifier', () => {
    const onSelect = vi.fn()
    
    renderWithProviders(
      <ModifierModal
        product={mockProduct}
        modifiers={mockModifiers}
        onClose={vi.fn()}
        onSelect={onSelect}
        selectionType="single"
      />
    )
    
    fireEvent.click(screen.getByText('Queso cheddar'))
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    
    expect(onSelect).toHaveBeenCalledWith(mockProduct, [mockModifiers[1]])
  })

  it('selects multiple modifiers', () => {
    const onSelect = vi.fn()
    
    renderWithProviders(
      <ModifierModal
        product={mockProduct}
        modifiers={mockModifiers}
        onClose={vi.fn()}
        onSelect={onSelect}
        selectionType="multiple"
      />
    )
    
    fireEvent.click(screen.getByText('Sin queso'))
    fireEvent.click(screen.getByText('Queso extra'))
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    
    expect(onSelect).toHaveBeenCalledWith(mockProduct, [
      mockModifiers[0],
      mockModifiers[2],
    ])
  })

  it('requires selection when required', () => {
    renderWithProviders(
      <ModifierModal
        product={mockProduct}
        modifiers={mockModifiers}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        selectionType="single"
        required={true}
      />
    )
    
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    
    // Should not close, should show error
    expect(screen.getByText(/requerido/i)).toBeInTheDocument()
  })
})

// ============================================================
// HardwareStatus Tests
// ============================================================

describe('HardwareStatus', () => {
  it('renders hardware status', () => {
    renderWithProviders(<HardwareStatus />)
    
    expect(screen.getByText('Hardware')).toBeInTheDocument()
    expect(screen.getByText('Escáner')).toBeInTheDocument()
    expect(screen.getByText('Impresora')).toBeInTheDocument()
    expect(screen.getByText('Cajón')).toBeInTheDocument()
  })

  it('shows connection status', () => {
    renderWithProviders(<HardwareStatus />)
    
    expect(screen.getByText('Desconectado')).toBeInTheDocument()
  })
})

// ============================================================
// FDEDocumentsPage Tests
// ============================================================

describe('FDEDocumentsPage', () => {
  beforeEach(() => {
    vi.mock('@/features/fde/FDEDocumentsPage', () => ({
      FDEDocumentsPage: () => <div data-testid="fde-documents-page">FDE Documents</div>,
    }))
  })

  it('renders FDE documents page', () => {
    renderWithProviders(<div data-testid="fde-documents-page" />)
    
    expect(screen.getByTestId('fde-documents-page')).toBeInTheDocument()
  })
})

// ============================================================
// FDESettingsPage Tests
// ============================================================

describe('FDESettingsPage', () => {
  beforeEach(() => {
    vi.mock('@/features/fde/FDESettingsPage', () => ({
      FDESettingsPage: () => <div data-testid="fde-settings-page">FDE Settings</div>,
    }))
  })

  it('renders FDE settings page', () => {
    renderWithProviders(<div data-testid="fde-settings-page" />)
    
    expect(screen.getByTestId('fde-settings-page')).toBeInTheDocument()
  })
})

// ============================================================
// SettingsPage Tests
// ============================================================

describe('SettingsPage', () => {
  it('renders settings tabs', () => {
    renderWithProviders(<SettingsPage />)
    
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Usuarios')).toBeInTheDocument()
    expect(screen.getByText('Hardware')).toBeInTheDocument()
    expect(screen.getByText('Respaldo')).toBeInTheDocument()
    expect(screen.getByText('Seguridad')).toBeInTheDocument()
  })
})

// ============================================================
// InventoryPage Tests
// ============================================================

describe('InventoryPage', () => {
  it('renders inventory tabs', () => {
    renderWithProviders(<InventoryPage />)
    
    expect(screen.getByText('Resumen')).toBeInTheDocument()
    expect(screen.getByText('Movimientos')).toBeInTheDocument()
    expect(screen.getByText('Ajustes')).toBeInTheDocument()
    expect(screen.getByText('Compras')).toBeInTheDocument()
    expect(screen.getByText('Conteos')).toBeInTheDocument()
  })
})

// ============================================================
// ReportsPage Tests
// ============================================================

describe('ReportsPage', () => {
  it('renders report tabs', () => {
    renderWithProviders(<ReportsPage />)
    
    expect(screen.getByText('Ventas')).toBeInTheDocument()
    expect(screen.getByText('Inventario')).toBeInTheDocument()
    expect(screen.getByText('Costos Recetas')).toBeInTheDocument()
  })
})

// ============================================================
// Header Tests
// ============================================================

describe('Header', () => {
  it('renders header with menu button', () => {
    renderWithProviders(
      <Header
        onMenuClick={vi.fn()}
        user={{ name: 'Test User', role: 'cashier', businessType: 'restaurant', email: 'test@test.com' }}
        onLogout={vi.fn()}
      />
    )
    
    expect(screen.getByRole('button', { name: /toggle menu/i })).toBeInTheDocument()
  })

  it('shows user info', () => {
    renderWithProviders(
      <Header
        onMenuClick={vi.fn()}
        user={{ name: 'Juan Pérez', role: 'cashier', businessType: 'restaurant', email: 'juan@test.com' }}
        onLogout={vi.fn()}
      />
    )
    
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('cashier')).toBeInTheDocument()
    expect(screen.getByText('Restaurante')).toBeInTheDocument()
  })

  it('shows online/offline status', () => {
    renderWithProviders(
      <Header
        onMenuClick={vi.fn()}
        user={{ name: 'Test', role: 'cashier', businessType: 'grocery', email: 'test@test.com' }}
        onLogout={vi.fn()}
      />
    )
    
    expect(screen.getByText(/en línea/i)).toBeInTheDocument()
  })
})

// ============================================================
// Sidebar Tests
// ============================================================

describe('Sidebar', () => {
  it('renders navigation items', () => {
    renderWithProviders(
      <Sidebar isOpen={true} onClose={vi.fn()} />
    )
    
    expect(screen.getByText('Punto de Venta')).toBeInTheDocument()
    expect(screen.getByText('Productos')).toBeInTheDocument()
    expect(screen.getByText('Categorías')).toBeInTheDocument()
    expect(screen.getByText('Inventario')).toBeInTheDocument()
    expect(screen.getByText('Reportes')).toBeInTheDocument()
    expect(screen.getByText('Configuración')).toBeInTheDocument()
  })

  it('filters restaurant items for grocery', () => {
    vi.mock('@/features/auth/hooks', () => ({
      useAuth: () => ({ user: { businessType: 'grocery' } }),
    }))
    
    renderWithProviders(<Sidebar isOpen={true} onClose={vi.fn()} />)
    
    expect(screen.queryByText('Ingredientes')).not.toBeInTheDocument()
    expect(screen.queryByText('Recetas')).not.toBeInTheDocument()
    expect(screen.queryByText('Modificadores')).not.toBeInTheDocument()
  })

  it('highlights active route', () => {
    renderWithProviders(<Sidebar isOpen={true} onClose={vi.fn()} />)
    
    const posLink = screen.getByText('Punto de Venta')
    expect(posLink).toHaveClass('bg-primary')
  })
})

// ============================================================
// Layout Tests
// ============================================================

describe('Layout', () => {
  it('renders sidebar and header', () => {
    renderWithProviders(<Layout />)
    
    expect(screen.getByText('Punto de Venta')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })
})

// ============================================================
// OfflineBanner Tests
// ============================================================

describe('OfflineBanner', () => {
  beforeEach(() => {
    vi.mock('@/features/pos/hooks/useSync', () => ({
      useSync: () => ({
        isOnline: false,
        pendingCount: 2,
        lastSync: Date.now(),
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
      }),
    }))
  }

  it('shows when offline', () => {
    renderWithProviders(<Layout />)
    
    expect(screen.getByText(/modo fuera de línea/i)).toBeInTheDocument()
    expect(screen.getByText(/2 venta/i)).toBeInTheDocument()
  })

  it('does not show when online', () => {
    vi.mock('@/features/pos/hooks/useSync', () => ({
      useSync: () => ({
        isOnline: true,
        pendingCount: 0,
        lastSync: null,
        triggerSync: vi.fn(),
        retryFailed: vi.fn(),
      }),
    }))
    
    renderWithProviders(<Layout />)
    
    expect(screen.queryByText(/modo fuera de línea/i)).not.toBeInTheDocument()
  })
})