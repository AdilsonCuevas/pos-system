'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Save, AlertTriangle, CheckCircle, XCircle, Edit, Trash2, Key, Shield, Database, Globe, CreditCard, Smartphone } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Input } from '@/shared/ui/Input'
import { Badge } from '@/shared/ui/Badge'
import { formatCOP, formatDate } from '@/shared/utils/cn'
import { api } from '@/shared/utils/api'
import type { FDENumbering } from '@/shared/types/pos'
import { toast } from '@/shared/hooks/useToast'

export function FDESettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'pac' | 'numbering' | 'company'>('pac')
  
  // PAC Config
  const [pacConfig, setPacConfig] = useState({
    pac_provider: 'tecnodata',
    test_mode: true,
    tecnodata_api_key: '',
    facturacion_electronica_co_api_key: '',
    sfe_api_key: '',
  })
  
  // Company Info
  const [companyInfo, setCompanyInfo] = useState({
    company_nit: '',
    company_name: '',
    company_address: '',
    company_city: 'BOGOTA',
    company_department: 'CUNDINAMARCA',
    company_phone: '',
    company_email: '',
  })
  
  // Numbering
  const { data: numberingData } = useQuery({
    queryKey: ['fde', 'numbering'],
    queryFn: async () => {
      const { data } = await api.get<FDENumbering[]>('/config/fde/numbering')
      return data
    },
  })
  
  const numbering = numberingData || []
  
  // Mutations
  const savePacConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      const { data } = await api.put('/config/fde/pac', config)
      return data
    },
    onSuccess: () => {
      toast.success('Configuración PAC guardada. Reinicie el backend para aplicar cambios.')
      queryClient.invalidateQueries({ queryKey: ['config', 'fde', 'pac'] })
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.response?.data?.detail || 'Error al guardar'}`)
    },
  })
  
  const saveCompanyInfoMutation = useMutation({
    mutationFn: async (info: any) => {
      const { data } = await api.put('/config/fde/company', info)
      return data
    },
    onSuccess: () => {
      toast.success('Información de empresa guardada. Reinicie el backend para aplicar cambios.')
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.response?.data?.detail || 'Error al guardar'}`)
    },
  })
  
  const createNumberingMutation = useMutation({
    mutationFn: async (numbering: any) => {
      const { data } = await api.post('/config/fde/numbering', numbering)
      return data
    },
    onSuccess: () => {
      toast.success('Numeración creada')
      queryClient.invalidateQueries({ queryKey: ['fde', 'numbering'] })
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.response?.data?.detail || 'Error al crear'}`)
    },
  })
  
  const updateNumberingMutation = useMutation({
    mutationFn: async ({ prefix, data }: { prefix: string; data: any }) => {
      const { data } = await api.put(`/config/fde/numbering/${prefix}`, data)
      return data
    },
    onSuccess: () => {
      toast.success('Numeración actualizada')
      queryClient.invalidateQueries({ queryKey: ['fde', 'numbering'] })
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.response?.data?.detail || 'Error al actualizar'}`)
    },
  })
  
  const deleteNumberingMutation = useMutation({
    mutationFn: async (prefix: string) => {
      await api.delete(`/config/fde/numbering/${prefix}`)
    },
    onSuccess: () => {
      toast.success('Numeración eliminada')
      queryClient.invalidateQueries({ queryKey: ['fde', 'numbering'] })
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.response?.data?.detail || 'Error al eliminar'}`)
    },
  })
  
  const [showNumberingForm, setShowNumberingForm] = useState(false)
  const [editingNumbering, setEditingNumbering] = useState<FDENumbering | null>(null)
  const [numberingForm, setNumberingForm] = useState({
    prefix: '',
    resolution_number: '',
    resolution_date: '',
    valid_from: '',
    valid_until: '',
    range_start: 1,
    range_end: 999999,
    is_active: true,
  })
  
  // Load initial config
  const { data: pacConfigData } = useQuery({
    queryKey: ['config', 'fde', 'pac'],
    queryFn: async () => {
      const { data } = await api.get('/config/fde/pac')
      return data
    },
  })
  
  const { data: companyData } = useQuery({
    queryKey: ['config', 'fde', 'company'],
    queryFn: async () => {
      const { data } = await api.get('/config/fde/company')
      return data
    },
  })
  
  // Initialize form state from loaded data
  const initializeForms = () => {
    if (pacConfigData) {
      setPacConfig({
        pac_provider: pacConfigData.pac_provider,
        test_mode: pacConfigData.test_mode,
        tecnodata_api_key: '',
        facturacion_electronica_co_api_key: '',
        sfe_api_key: '',
      })
    }
    if (companyData) {
      setCompanyInfo({
        company_nit: companyData.company_nit,
        company_name: companyData.company_name,
        company_address: companyData.company_address,
        company_city: companyData.company_city,
        company_department: companyData.company_department,
        company_phone: companyData.company_phone || '',
        company_email: companyData.company_email || '',
      })
    }
  }
  
  // Initialize on data load
  if (pacConfigData || companyData) {
    initializeForms()
  }
  
  const handleSavePacConfig = (e: React.FormEvent) => {
    e.preventDefault()
    savePacConfigMutation.mutate(pacConfig)
  }
  
  const handleSaveCompanyInfo = (e: React.FormEvent) => {
    e.preventDefault()
    saveCompanyInfoMutation.mutate(companyInfo)
  }
  
  const handleNumberingSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingNumbering) {
      updateNumberingMutation.mutate({ prefix: editingNumbering.prefix, data: numberingForm })
    } else {
      createNumberingMutation.mutate(numberingForm)
    }
    setShowNumberingForm(false)
    setEditingNumbering(null)
  }
  
  const handleEditNumbering = (n: FDENumbering) => {
    setEditingNumbering(n)
    setNumberingForm({
      prefix: n.prefix,
      resolution_number: n.resolution_number,
      resolution_date: n.resolution_date.split('T')[0],
      valid_from: n.valid_from.split('T')[0],
      valid_until: n.valid_until.split('T')[0],
      range_start: n.range_start,
      range_end: n.range_end,
      is_active: n.is_active,
    })
    setShowNumberingForm(true)
  }
  
  const handleNewNumbering = () => {
    setEditingNumbering(null)
    setNumberingForm({
      prefix: '',
      resolution_number: '',
      resolution_date: '',
      valid_from: '',
      valid_until: '',
      range_start: 1,
      range_end: 999999,
      is_active: true,
    })
    setShowNumberingForm(true)
  }
  
  const handleNumberingSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingNumbering) {
      updateNumberingMutation.mutate({ prefix: editingNumbering.prefix, data: numberingForm })
    } else {
      createNumberingMutation.mutate(numberingForm)
    }
    setShowNumberingForm(false)
    setEditingNumbering(null)
  }
  
  const handleDeleteNumbering = (prefix: string) => {
    if (confirm(`¿Eliminar numeración ${prefix}?`)) {
      deleteNumberingMutation.mutate(prefix)
    }
  }
  
  const numbering = numberingData || []
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración FDE (DIAN)</h1>
          <p className="text-muted-foreground">Configura facturación electrónica según normativa colombiana</p>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        <button
          onClick={() => setActiveTab('pac')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'pac' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Shield className="mr-2 h-4 w-4" />
          Proveedor PAC
        </button>
        <button
          onClick={() => setActiveTab('numbering')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'numbering' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Database className="mr-2 h-4 w-4" />
          Numeración DIAN
        </button>
        <button
          onClick={() => setActiveTab('company')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'company' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Globe className="mr-2 h-4 w-4" />
          Datos Empresa
        </button>
      </div>
      
      {/* PAC Config Tab */}
      {activeTab === 'pac' && (
        <Card className="mt-4">
          <form onSubmit={handleSavePacConfig} className="p-6 space-y-6">
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Shield className="h-5 w-5" />Proveedor de Certificación (PAC)</h3>
              
              <div>
                <label className="block text-sm font-medium mb-1">Proveedor PAC *</label>
                <select value={pacConfig.pac_provider} onChange={e => setPacConfig({...pacConfig, pac_provider: e.target.value})} className="w-full border rounded-lg px-3 py-2">
                  <option value="tecnodata">TecnoData</option>
                  <option value="facturacion_electronica_co">Facturación Electrónica.co</option>
                  <option value="sfe">S.F.E. (Sistemas de Facturación Electrónica)</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <input type="checkbox" id="test_mode" checked={pacConfig.test_mode} onChange={e => setPacConfig({...pacConfig, test_mode: e.target.checked})} className="rounded border-input" />
                <label htmlFor="test_mode" className="text-sm">
                  Modo Prueba (Homologación DIAN) - Desactivar para producción
                </label>
              </div>
              
              <hr />
              
              <div>
                <label className="block text-sm font-medium mb-1">API Key TecnoData</label>
                <div className="relative">
                  <Input type="password" value={pacConfig.tecnodata_api_key} onChange={e => setPacConfig({...pacConfig, tecnodata_api_key: e.target.value})} placeholder="Ingresa tu API Key" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">Obtén tu API Key en el portal de TecnoData</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">API Key Facturación Electrónica.co</label>
                <Input type="password" value={pacConfig.facturacion_electronica_co_api_key} onChange={e => setPacConfig({...pacConfig, facturacion_electronica_co_api_key: e.target.value})} placeholder="API Key" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">API Key S.F.E.</label>
                <Input type="password" value={pacConfig.sfe_api_key} onChange={e => setPacConfig({...pacConfig, sfe_api_key: e.target.value})} placeholder="API Key" />
              </div>
            </div>
            
            <div className="border rounded-lg p-4 space-y-4 bg-amber-50 border-amber-200">
              <h4 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />Notas Importantes</h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• El modo prueba usa el entorno de homologación DIAN (no genera documentos válidos legalmente)</li>
                <li>• Para producción, desactiva "Modo Prueba" y usa credenciales de producción del PAC</li>
                <li>• Los cambios requieren reiniciar el backend: <code className="px-1 bg-amber-100 rounded">docker compose restart backend</code></li>
                <li>• Verifica que tu resolución DIAN esté vigente en la pestaña "Numeración DIAN"</li>
              </ul>
            </div>
            
            <Button type="submit" className="w-full" disabled={savePacConfigMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {savePacConfigMutation.isPending ? 'Guardando...' : 'Guardar Configuración PAC'}
            </Button>
          </form>
        </Card>
      )}
      
      {/* Numbering Tab */}
      {activeTab === 'numbering' && (
        <div className="mt-4 space-y-4">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold">Numeración DIAN (Resolución)</h3>
                <Button variant="outline" onClick={handleNewNumbering} disabled={numbering.length >= 4}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Prefijo
                </Button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="pb-3 font-medium">Prefijo</th>
                      <th className="pb-3 font-medium">Número Actual</th>
                      <th className="pb-3 font-medium">Resolución</th>
                      <th className="pb-3 font-medium">Fecha Resolución</th>
                      <th className="pb-3 font-medium">Rango</th>
                      <th className="pb-3 font-medium">Vigencia</th>
                      <th className="pb-3 font-medium">Estado</th>
                      <th className="pb-3 font-medium text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {numbering.length === 0 ? (
                      <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No hay numeración configurada. Agrega tu resolución DIAN.</td></tr>
                    ) : (
                      numbering.map(n => (
                        <tr key={n.prefix} className="border-b hover:bg-muted/50">
                          <td className="py-4 font-mono font-bold">{n.prefix}</td>
                          <td className="py-4 text-right font-mono">{n.current_number.toLocaleString()} / {n.range_end.toLocaleString()}</td>
                          <td className="py-4">{n.resolution_number}</td>
                          <td className="py-4">{formatDate(n.resolution_date)}</td>
                          <td className="py-4">{n.range_start.toLocaleString()} - {n.range_end.toLocaleString()}</td>
                          <td className="py-4">{formatDate(n.valid_from)} a {formatDate(n.valid_until)}</td>
                          <td className="py-4">
                            <Badge variant={n.is_active && new Date(n.valid_until) >= new Date() ? 'success' : 'destructive'}>
                              {n.is_active && new Date(n.valid_until) >= new Date() ? 'Vigente' : 'Vencida/Inactiva'}
                            </Badge>
                          </td>
                          <td className="py-4 text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleEditNumbering(n)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteNumbering(n.prefix)} disabled={deleteNumberingMutation.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
          
          {(showNumberingForm || editingNumbering) && (
            <Card className="mt-4">
              <form onSubmit={handleNumberingSubmit} className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{editingNumbering ? 'Editar Numeración' : 'Nueva Numeración DIAN'}</h3>
                  <button type="button" onClick={() => { setShowNumberingForm(false); setEditingNumbering(null); }} className="p-2 rounded-lg hover:bg-accent">✕</button>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Prefijo * (ej: POS, FAC, NC, ND)</label>
                    <Input value={numberingForm.prefix} onChange={e => setNumberingForm({...numberingForm, prefix: e.target.value.toUpperCase()})} required maxLength={4} disabled={!!editingNumbering} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Número de Resolución *</label>
                    <Input value={numberingForm.resolution_number} onChange={e => setNumberingForm({...numberingForm, resolution_number: e.target.value})} required placeholder="18760000001" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fecha Resolución *</label>
                    <Input type="date" value={numberingForm.resolution_date} onChange={e => setNumberingForm({...numberingForm, resolution_date: e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Válido Desde *</label>
                    <Input type="date" value={numberingForm.valid_from} onChange={e => setNumberingForm({...numberingForm, valid_from: e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Válido Hasta *</label>
                    <Input type="date" value={numberingForm.valid_until} onChange={e => setNumberingForm({...numberingForm, valid_until: e.target.value})} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Rango Inicio *</label>
                    <Input type="number" min="1" value={numberingForm.range_start} onChange={e => setNumberingForm({...numberingForm, range_start: parseInt(e.target.value)})} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Rango Fin *</label>
                    <Input type="number" min="1" value={numberingForm.range_end} onChange={e => setNumberingForm({...numberingForm, range_end: parseInt(e.target.value)})} required />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="is_active" checked={numberingForm.is_active} onChange={e => setNumberingForm({...numberingForm, is_active: e.target.checked})} className="rounded border-input" />
                  <label htmlFor="is_active" className="text-sm">Activa</label>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => { setShowNumberingForm(false); setEditingNumbering(null); }}>Cancelar</Button>
                  <Button type="submit" disabled={createNumberingMutation.isPending || updateNumberingMutation.isPending}>
                    {createNumberingMutation.isPending || updateNumberingMutation.isPending ? 'Guardando...' : (editingNumbering ? 'Actualizar' : 'Crear')}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}
      
      {/* Company Tab */}
      {activeTab === 'company' && (
        <Card>
          <form onSubmit={handleSaveCompanyInfo} className="p-6 space-y-6">
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Globe className="h-5 w-5" />Datos de la Empresa (para facturas)</h3>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">NIT * (sin dígito verificación)</label>
                  <Input value={companyInfo.company_nit} onChange={e => setCompanyInfo({...companyInfo, company_nit: e.target.value})} placeholder="900123456" required pattern="[0-9]{8,11}" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Razón Social *</label>
                  <Input value={companyInfo.company_name} onChange={e => setCompanyInfo({...companyInfo, company_name: e.target.value})} placeholder="MI EMPRESA SAS" required />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Dirección *</label>
                  <Input value={companyInfo.company_address} onChange={e => setCompanyInfo({...companyInfo, company_address: e.target.value})} placeholder="Calle 123 #45-67" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ciudad *</label>
                  <Input value={companyInfo.company_city} onChange={e => setCompanyInfo({...companyInfo, company_city: e.target.value})} placeholder="BOGOTA" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Departamento *</label>
                  <Input value={companyInfo.company_department} onChange={e => setCompanyInfo({...companyInfo, company_department: e.target.value})} placeholder="CUNDINAMARCA" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Teléfono</label>
                  <Input value={companyInfo.company_phone} onChange={e => setCompanyInfo({...companyInfo, company_phone: e.target.value})} placeholder="+57 1 2345678" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email facturación</label>
                  <Input type="email" value={companyInfo.company_email} onChange={e => setCompanyInfo({...companyInfo, company_email: e.target.value})} placeholder="facturacion@miempresa.com" />
                </div>
              </div>
            </div>
            
            <Button type="submit" className="w-full" disabled={saveCompanyInfoMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {saveCompanyInfoMutation.isPending ? 'Guardando...' : 'Guardar Datos de Empresa'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  )
}