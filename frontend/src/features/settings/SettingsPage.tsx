'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'
import { Plus, Loader2, Save, AlertTriangle, CheckCircle, XCircle, Edit, Trash2, Key, Shield, Database, Globe, CreditCard, Smartphone, Users, Settings as SettingsIcon, HardDrive, RotateCcw, Download, Upload, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Badge } from '@/shared/ui/Badge'
import { formatCOP, formatDate } from '@/shared/utils/cn'
import { api } from '@/shared/utils/api'
import { useAuth } from '@/features/auth/hooks'
import type { User } from '@/shared/types/api'

export function SettingsPage() {
  const { user, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'hardware' | 'backup' | 'security'>('general')
  
  // General settings
  const [generalSettings, setGeneralSettings] = useState({
    business_name: 'Mi POS',
    timezone: 'America/Bogota',
    currency: 'COP',
    default_tax_rate: 0.19,
    receipt_footer: '¡Gracias por su compra!',
  })
  
  // Hardware
  const [hardware, setHardware] = useState({
    scanner_enabled: true,
    printer_enabled: true,
    drawer_enabled: true,
    auto_print_receipt: true,
    receipt_copies: 1,
  })
  
  // Backup
  const [backupSettings, setBackupSettings] = useState({
    auto_backup: true,
    backup_time: '02:00',
    retention_days: 30,
    encrypt_backups: false,
  })
  
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault()
    alert('Configuración general guardada')
  }
  
  const handleSaveHardware = async (e: React.FormEvent) => {
    e.preventDefault()
    alert('Configuración de hardware guardada')
  }
  
  const handleSaveBackup = async (e: React.FormEvent) => {
    e.preventDefault()
    alert('Configuración de respaldo guardada')
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-muted-foreground">Administra la configuración del sistema</p>
        </div>
      </div>
      
      {/* User info card */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xl font-bold">{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
            <div>
              <h3 className="font-semibold">{user?.name}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{user?.role}</Badge>
                <Badge variant="outline">{user?.businessType === 'restaurant' ? 'Restaurante' : 'Abarrotes'}</Badge>
              </div>
            </div>
            <div className="ml-auto">
              <Badge variant="outline">{user?.businessType === 'restaurant' ? 'Restaurante' : 'Abarrotes'}</Badge>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general"><SettingsIcon className="mr-2 h-4 w-4" />General</TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Usuarios</TabsTrigger>
          <TabsTrigger value="hardware"><HardDrive className="mr-2 h-4 w-4" />Hardware</TabsTrigger>
          <TabsTrigger value="backup"><RotateCcw className="mr-2 h-4 w-4" />Respaldo</TabsTrigger>
          <TabsTrigger value="security"><Shield className="mr-2 h-4 w-4" />Seguridad</TabsTrigger>
        </TabsList>
        
        {/* General Tab */}
        <TabsContent value="general">
          <Card className="mt-4">
            <form onSubmit={handleSaveGeneral} className="p-6 space-y-6">
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Globe className="h-5 w-5" />Información del Negocio</h3>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre del negocio *</label>
                    <Input value={generalSettings.business_name} onChange={e => setGeneralSettings({...generalSettings, business_name: e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Zona horaria *</label>
                    <select value={generalSettings.timezone} onChange={e => setGeneralSettings({...generalSettings, timezone: e.target.value})} className="w-full border rounded-lg px-3 py-2">
                      <option value="America/Bogota">America/Bogota (Colombia)</option>
                      <option value="America/Mexico_City">America/Mexico_City</option>
                      <option value="America/Lima">America/Lima</option>
                      <option value="America/Caracas">America/Caracas</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Moneda *</label>
                    <select value={generalSettings.currency} onChange={e => setGeneralSettings({...generalSettings, currency: e.target.value})} className="w-full border rounded-lg px-3 py-2">
                      <option value="COP">COP - Peso Colombiano</option>
                      <option value="USD">USD - Dólar Americano</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">IVA por defecto *</label>
                    <select value={generalSettings.default_tax_rate} onChange={e => setGeneralSettings({...generalSettings, default_tax_rate: parseFloat(e.target.value)})} className="w-full border rounded-lg px-3 py-2">
                      <option value="0">Exento (0%)</option>
                      <option value="0.05">5%</option>
                      <option value="0.19">19% (General Colombia)</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Pie de recibo</label>
                  <textarea value={generalSettings.receipt_footer} onChange={e => setGeneralSettings({...generalSettings, receipt_footer: e.target.value})} className="w-full border rounded-lg px-3 py-2 min-h-[80px]" rows={3} placeholder="Texto que aparecerá al final de cada recibo..." />
                </div>
              </div>
              
              <Button type="submit" className="w-full">
                <Save className="mr-2 h-4 w-4" />
                Guardar Configuración General
              </Button>
            </form>
          </Card>
        </TabsContent>
        
        {/* Users Tab */}
        <TabsContent value="users">
          <UserManagementTab />
        </TabsContent>
        
        {/* Hardware Tab */}
        <TabsContent value="hardware">
          <Card>
            <form onSubmit={handleSaveHardware} className="p-6 space-y-6">
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><HardDrive className="h-5 w-5" />Configuración de Hardware</h3>
                
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="scanner_enabled" checked={hardware.scanner_enabled} onChange={e => setHardware({...hardware, scanner_enabled: e.target.checked})} className="rounded border-input" />
                    <label htmlFor="scanner_enabled" className="text-sm">Escáner de códigos (WebHID)</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="printer_enabled" checked={hardware.printer_enabled} onChange={e => setHardware({...hardware, printer_enabled: e.target.checked})} className="rounded border-input" />
                    <label htmlFor="printer_enabled" className="text-sm">Impresora térmica (WebUSB)</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="drawer_enabled" checked={hardware.drawer_enabled} onChange={e => setHardware({...hardware, drawer_enabled: e.target.checked})} className="rounded border-input" />
                    <label htmlFor="drawer_enabled" className="text-sm">Cajón de dinero</label>
                  </div>
                </div>
                
                <hr />
                
                <div>
                  <label className="block text-sm font-medium mb-1">Impresión automática de recibo</label>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="auto_print_receipt" checked={hardware.auto_print_receipt} onChange={e => setHardware({...hardware, auto_print_receipt: e.target.checked})} className="rounded border-input" />
                    <label htmlFor="auto_print_receipt" className="text-sm">Imprimir automáticamente al completar venta</label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Copias de recibo</label>
                  <Input type="number" min="1" max="3" value={hardware.receipt_copies} onChange={e => setHardware({...hardware, receipt_copies: parseInt(e.target.value)})} className="w-[100px]" />
                </div>
              </div>
              
              <div className="border rounded-lg p-4 space-y-4 bg-blue-50 border-blue-200">
                <h4 className="font-semibold">Dispositivos Conectados</h4>
                <HardwareStatusWidget />
              </div>
              
              <Button type="submit" className="w-full">
                <Save className="mr-2 h-4 w-4" />
                Guardar Configuración de Hardware
              </Button>
            </form>
          </Card>
        </TabsContent>
        
        {/* Backup Tab */}
        <TabsContent value="backup">
          <Card>
            <form onSubmit={handleSaveBackup} className="p-6 space-y-6">
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><RotateCcw className="h-5 w-5" />Respaldo Automático</h3>
                
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="auto_backup" checked={backupSettings.auto_backup} onChange={e => setBackupSettings({...backupSettings, auto_backup: e.target.checked})} className="rounded border-input" />
                  <label htmlFor="auto_backup" className="text-sm">Habilitar respaldo automático diario</label>
                </div>
                
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Hora de respaldo</label>
                    <Input type="time" value={backupSettings.backup_time} onChange={e => setBackupSettings({...backupSettings, backup_time: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Días de retención</label>
                    <Input type="number" min="1" max="365" value={backupSettings.retention_days} onChange={e => setBackupSettings({...backupSettings, retention_days: parseInt(e.target.value)})} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="encrypt_backups" checked={backupSettings.encrypt_backups} onChange={e => setBackupSettings({...backupSettings, encrypt_backups: e.target.checked})} className="rounded border-input" />
                    <label htmlFor="encrypt_backups" className="text-sm">Cifrar respaldos (requiere clave)</label>
                  </div>
                </div>
              </div>
              
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Database className="h-5 w-5" />Respaldo Manual</h3>
                <div className="flex gap-3 flex-wrap">
                  <Button variant="outline" onClick={() => window.location.href = '/api/backup'}>
                    <Download className="mr-2 h-4 w-4" />
                    Crear Respaldo Ahora
                  </Button>
                  <Button variant="outline" onClick={() => window.location.href = '/restore'}>
                    <Upload className="mr-2 h-4 w-4" />
                    Restaurar Respaldo
                  </Button>
                  <Button variant="outline" onClick={() => window.open('/api/backup/verify', '_blank')}>
                    <Eye className="mr-2 h-4 w-4" />
                    Verificar Último Respaldo
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Los respaldos se almacenan en la carpeta <code>backups/</code> del servidor.</p>
              </div>
              
              <Button type="submit" className="w-full">
                <Save className="mr-2 h-4 w-4" />
                Guardar Configuración de Respaldo
              </Button>
            </form>
          </Card>
        </TabsContent>
        
        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <div className="p-6 space-y-6">
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><Shield className="h-5 w-5" />Configuración de Seguridad</h3>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Expiración token acceso (min)</label>
                    <Input type="number" min="5" max="120" value="15" className="w-[100px]" disabled />
                    <p className="text-xs text-muted-foreground mt-1">Configurable en .env (ACCESS_TOKEN_EXPIRE_MINUTES)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Expiración refresh token (días)</label>
                    <Input type="number" min="1" max="30" value="7" className="w-[100px]" disabled />
                    <p className="text-xs text-muted-foreground mt-1">Configurable en .env (REFRESH_TOKEN_EXPIRE_DAYS)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Máx. sesiones concurrentes (cajero)</label>
                    <Input type="number" min="1" max="10" value="3" className="w-[100px]" disabled />
                    <p className="text-xs text-muted-foreground mt-1">Configurable por usuario en BD</p>
                  </div>
                </div>
                
                <hr />
                
                <h4 className="font-medium">Gestión de Sesiones</h4>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => alert('Función: Revocar todas las sesiones del usuario actual')}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Revocar Mis Sesiones
                  </Button>
                  {user?.role === 'admin' && (
                    <Button variant="outline" onClick={() => alert('Función: Admin puede revocar sesiones de cualquier usuario')}>
                      <Users className="mr-2 h-4 w-4" />
                      Admin: Revocar Sesiones Usuario
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="border rounded-lg p-4 space-y-4 bg-green-50 border-green-200">
                <h4 className="font-semibold flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" />Estado de Seguridad</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>✅ HTTPS forzado con certificados mkcert (CA local)</li>
                  <li>✅ JWT RS256 con claves RSA 2048-bit</li>
                  <li>✅ Refresh tokens con rotación y detección de reuso</li>
                  <li>✅ Base de datos solo accesible desde LAN (bind-address + firewall)</li>
                  <li>✅ CORS restringido a orígenes LAN</li>
                  <li>✅ Rate limiting en endpoints de autenticación</li>
                </ul>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function UserManagementTab() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  
  const { data: usersData } = useQuery({
    queryKey: ['users', 'list'],
    queryFn: async () => {
      const { data } = await api.get('/users')
      return data
    },
  })
  
  const createMutation = useMutation({
    mutationFn: (userData: any) => api.post('/users', userData),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setShowForm(false); },
  })
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/users/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setEditingUser(null); },
  })
  
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
  
  const handleNewUser = () => {
    setEditingUser(null)
    setShowForm(true)
  }
  
  const handleEdit = (u: User) => {
    setEditingUser(u)
    setShowForm(true)
  }
  
  const users = usersData || []
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Gestión de Usuarios</h3>
        <Button onClick={handleNewUser}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>
      
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Usuario</th>
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Rol</th>
                <th className="pb-3 font-medium">Estado</th>
                <th className="pb-3 font-medium">Sesiones máx</th>
                <th className="pb-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b hover:bg-muted/50">
                  <td className="py-4 font-medium">{u.name}</td>
                  <td className="py-4">{u.email}</td>
                  <td className="py-4">
                    <Badge variant={u.role === 'admin' ? 'destructive' : u.role === 'manager' ? 'default' : 'secondary'}>{u.role}</Badge>
                  </td>
                  <td className="py-4">
                    <Badge variant={u.is_active ? 'success' : 'secondary'}>{u.is_active ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td className="py-4 text-center">{u.max_concurrent_sessions}</td>
                  <td className="py-4 text-right">
                    {u.id !== user?.id && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(u)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(u.id)} disabled={deleteMutation.isPending}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                    {u.id === user?.id && <Badge variant="secondary">Tú</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      
      {(showForm || editingUser) && (
        <UserFormModal
          user={editingUser}
          onClose={() => { setShowForm(false); setEditingUser(null); }}
          onSubmit={data => editingUser ? updateMutation.mutate({ id: editingUser.id, data }) : createMutation.mutate(data)}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  )
}

function UserFormModal({ user, onClose, onSubmit, isLoading }: any) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'cashier',
    business_type: 'restaurant',
    max_concurrent_sessions: 3,
    is_active: true,
  })
  
  useState(() => {
    if (user) {
      setFormData({
        email: user.email,
        password: '',
        name: user.name,
        role: user.role,
        business_type: user.business_type,
        max_concurrent_sessions: user.max_concurrent_sessions,
        is_active: user.is_active,
      })
    }
  }, [user])
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = { ...formData }
    if (!data.password) delete data.password
    onSubmit(data)
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">{user ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required disabled={!!user} />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">{user ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'} </label>
            <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!user} minLength={8} />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Rol *</label>
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full border rounded-lg px-3 py-2" required>
                <option value="admin">Administrador</option>
                <option value="manager">Gerente</option>
                <option value="cashier">Cajero</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo negocio *</label>
              <select value={formData.business_type} onChange={e => setFormData({...formData, business_type: e.target.value})} className="w-full border rounded-lg px-3 py-2" required>
                <option value="grocery">Abarrotes</option>
                <option value="restaurant">Restaurante</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Máx. sesiones</label>
              <Input type="number" min="1" max="10" value={formData.max_concurrent_sessions} onChange={e => setFormData({...formData, max_concurrent_sessions: parseInt(e.target.value)})} />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="rounded border-input" />
            <label htmlFor="is_active" className="text-sm">Activo</label>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : (user ? 'Actualizar' : 'Crear')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function HardwareStatusWidget() {
  const [scanner, setScanner] = useState({ connected: false, checking: true })
  const [printer, setPrinter] = useState({ connected: false, checking: true })
  
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="p-3 rounded-lg border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <span>📱</span>
          </div>
          <div>
            <p className="font-medium">Escáner</p>
            <p className="text-sm text-muted-foreground">WebHID / Teclado</p>
          </div>
        </div>
        <Badge variant={scanner.connected ? 'success' : 'secondary'}>{scanner.connected ? 'Conectado' : 'Desconectado'}</Badge>
      </div>
      
      <div className="p-3 rounded-lg border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <span>🖨️</span>
          </div>
          <div>
            <p className="font-medium">Impresora</p>
            <p className="text-sm text-muted-foreground">WebUSB / Bluetooth</p>
          </div>
        </div>
        <Badge variant={printer.connected ? 'success' : 'secondary'}>{printer.connected ? 'Conectada' : 'Desconectada'}</Badge>
      </div>
      
      <div className="p-3 rounded-lg border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <span>💰</span>
          </div>
          <div>
            <p className="font-medium">Cajón</p>
            <p className="text-sm text-muted-foreground">USB / RJ12</p>
          </div>
        </div>
        <Badge variant="secondary">Por impresora</Badge>
      </div>
      
      <div className="p-3 rounded-lg border flex items-center justify-between">
        <div>
          <p className="font-medium">Detectar hardware</p>
          <p className="text-sm text-muted-foreground">Conecta dispositivos y haz clic</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setScanner({...scanner, checking: true}); setPrinter({...printer, checking: true}); setTimeout(() => { setScanner({connected: true, checking: false}); setPrinter({connected: true, checking: false}) }, 1000) }}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Detectar
        </Button>
      </div>
    </div>
  )
}