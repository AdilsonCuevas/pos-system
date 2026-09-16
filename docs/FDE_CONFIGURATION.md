# Guía de Configuración FDE (Factura Electrónica DIAN)

## Resumen

Este documento explica cómo configurar la Factura Electrónica (FDE) para DIAN Colombia en el sistema POS. El sistema soporta tres proveedores PAC (Proveedores Autorizados de Certificación):

1. **TecnoData** (implementación completa)
2. **Facturación Electrónica.co** (implementación completa)
3. **SFE** (implementación completa)

---

## Requisitos Previos

Antes de configurar FDE, necesitas:

1. **Cuenta activa** en uno de los PAC autorizados por DIAN:
   - [TecnoData](https://tecnodata.com.co/)
   - [Facturación Electrónica.co](https://facturacionelectronica.co/)
   - [SFE](https://sfe.com.co/)

2. **Resolución DIAN** vigente con:
   - Número de resolución
   - Fecha de resolución
   - Prefijo autorizado (ej: POS, FAC, NC, ND)
   - Rango de numeración (inicio - fin)
   - Fechas de vigencia (desde - hasta)

3. **Certificado digital DIAN** (archivo .p12 o .pfx con contraseña)

4. **Datos de la empresa**:
   - NIT (sin dígito de verificación)
   - Razón social
   - Dirección completa
   - Ciudad y departamento
   - Teléfono y email

---

## Paso 1: Configurar Variables de Entorno

Edita el archivo `.env` en la raíz del proyecto:

```bash
# FDE (Factura Electrónica DIAN) Configuration
FDE_PAC_PROVIDER=tecnodata          # tecnodata | facturacion_electronica_co | sfe
FDE_TEST_MODE=true                  # true = homologación, false = producción

# API Key de tu proveedor PAC
TECNODATA_API_KEY=tu_api_key_aqui
# FACTURACION_ELECTRONICA_CO_API_KEY=tu_api_key_aqui
# SFE_API_KEY=tu_api_key_aqui

# Datos de la empresa
COMPANY_NIT=900123456               # NIT sin dígito de verificación
COMPANY_NAME=MI EMPRESA SAS
COMPANY_ADDRESS=Calle 123 #45-67
COMPANY_CITY=BOGOTA
COMPANY_DEPARTMENT=CUNDINAMARCA
COMPANY_PHONE=+57 1 2345678
COMPANY_EMAIL=facturacion@miempresa.com

# Modo de operación
FDE_TEST_MODE=true                  # true = homologación, false = producción
```

### Configuración Específica por Proveedor

#### TecnoData
```env
FDE_PAC_PROVIDER=tecnodata
TECNODATA_API_KEY=tu_api_key_de_tecnodata
FDE_TEST_MODE=true  # Cambiar a false para producción
```

#### Facturación Electrónica.co
```env
FDE_PAC_PROVIDER=facturacion_electronica_co
FACTURACION_ELECTRONICA_CO_API_KEY=tu_api_key
FDE_TEST_MODE=true
```

#### SFE
```env
FDE_PAC_PROVIDER=sfe
SFE_API_KEY=tu_api_key_de_sfe
FDE_TEST_MODE=true
```

---

## Paso 2: Configurar Numeración DIAN

Después del primer despliegue, accede a **Configuración → FDE → Numeración DIAN** y agrega cada prefijo autorizado en tu resolución:

### Campos Requeridos:
| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Prefijo** | Código de 1-4 caracteres | `POS`, `FAC`, `NC`, `ND` |
| **Número de Resolución** | Número de resolución DIAN | `18760000001` |
| **Fecha Resolución** | Fecha de la resolución | `2024-01-15` |
| **Rango Inicio** | Primer número autorizado | `1` |
| **Rango Fin** | Último número autorizado | `999999` |
| **Válido Desde** | Fecha inicio vigencia | `2024-01-15` |
| **Válido Hasta** | Fecha fin vigencia | `2025-01-15` |

### Prefijos Comunes:
| Prefijo | Tipo de Documento | Código DIAN |
|---------|-------------------|-------------|
| `POS` | Tiquete POS (máquina registradora) | 04 |
| `FAC` | Factura de Venta | 01 |
| `NC` | Nota Crédito | 02 |
| `ND` | Nota Débito | 03 |

> **Importante**: Cada prefijo debe tener su propia resolución DIAN. No mezcles rangos.

---

## Paso 3: Configurar Datos de la Empresa

En **Configuración → FDE → Datos Empresa**, completa:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **NIT** | Sin dígito de verificación | `900123456` |
| **Razón Social** | Nombre legal de la empresa | `MI EMPRESA SAS` |
| **Dirección** | Dirección completa | `Calle 123 #45-67` |
| **Ciudad** | Ciudad en mayúsculas | `BOGOTA` |
| **Departamento** | Departamento en mayúsculas | `CUNDINAMARCA` |
| **Teléfono** | Con código de país | `+57 1 2345678` |
| **Email** | Para envío de facturas | `facturacion@miempresa.com` |

> **Nota**: El NIT debe ser **sin dígito de verificación** (ej: `900123456`, no `900.123.456-7`)

---

## Paso 4: Configurar Proveedor PAC

En **Configuración → FDE → Proveedor PAC**:

1. Selecciona tu proveedor PAC
2. Activa/desactiva **Modo Prueba**:
   - ✅ **Activado** = Homologación DIAN (pruebas, no válido legalmente)
   - ❌ **Desactivado** = Producción DIAN (documentos válidos legalmente)
3. Ingresa tu **API Key** del proveedor seleccionado
3. Guarda y **reinicia el backend**:
   ```bash
   docker compose restart backend
   ```

---

## Paso 5: Probar la Configuración

### 1. Verificar Salud FDE
En **Configuración → FDE → Numeración DIAN**, verifica que:
- El estado sea "Vigente" (verde)
- El rango tenga números disponibles
- Las fechas de vigencia sean correctas

### 2. Health Check FDE
Ejecuta el health check:
```bash
./scripts/health-check.sh
```
Debe mostrar "FDE Configuration: OK" sin issues.

### 3. Prueba de Facturación
1. Realiza una venta en el POS
2. En el historial de ventas, verifica que aparezca el botón "FDE"
3. Genera el documento FDE
4. Verifica el estado: debe pasar de "Pendiente" a "Autorizado"

### 4. Verificar en Portal DIAN (Modo Prueba)
- Accede al portal de homologación DIAN: https://catalogo-vpfe-hab.dian.gov.co/
- Busca el CUFE generado
- Verifica que el XML sea válido

---

## Paso 6: Pasar a Producción

Cuando todo funcione en modo prueba:

1. **Desactiva Modo Prueba** en Configuración → FDE → Proveedor PAC
2. **Actualiza .env**:
   ```env
   FDE_TEST_MODE=false
   ```
3. **Reinicia backend**:
   ```bash
   docker compose restart backend
   ```
4. **Verifica en producción**:
   - Realiza una venta real
   - Verifica en portal DIAN producción: https://catalogo-vpfe.dian.gov.co/
   - El QR debe llevar a la validación oficial

---

## Endpoints de API FDE

### Configuración
```
GET    /api/config/fde/pac          # Obtener config PAC
PUT    /api/config/fde/pac          # Actualizar config PAC
GET    /api/config/fde/company      # Obtener datos empresa
PUT    /api/config/fde/company      # Actualizar datos empresa
GET    /api/config/fde/numbering    # Listar numeraciones
POST   /api/config/fde/numbering    # Crear numeración
PUT    /api/config/fde/numbering/{prefix}
DELETE /api/config/fde/numbering/{prefix}
GET    /api/config/fde/health       # Health check FDE
```

### Documentos FDE
```
GET    /api/fde/documents           # Listar documentos
POST   /api/fde/documents           # Solicitar autorización
GET    /api/fde/documents/{id}      # Obtener documento
GET    /api/fde/documents/{id}/status  # Verificar estado
POST   /api/fde/documents/{id}/cancel  # Anular (nota crédito)
```

### Reportes
```
GET    /api/reports/fde/export      # Exportar a Excel
```

---

## Códigos de Error Comunes

| Código | Significado | Solución |
|--------|-------------|----------|
| `PAC_UNAUTHORIZED` | API Key inválida | Verificar API Key en .env |
| `RESOLUTION_EXPIRED` | Resolución vencida | Renovar resolución DIAN |
| `RANGE_EXCEEDED` | Rango agotado | Solicitar nuevo rango a DIAN |
| `INVALID_NIT` | NIT inválido | Verificar NIT sin dígito verificación |
| `XML_INVALID` | XML mal formado | Verificar datos empresa/cliente |
| `DUPLICATE_CUFE` | CUFE duplicado | Revisar numeración duplicada |
| `PAC_TIMEOUT` | Timeout PAC | Reintentar / verificar conectividad |
| `INVALID_CUFE` | CUFE inválido | Verificar generación CUFE |

---

## Troubleshooting

### Error: "PAC_UNAUTHORIZED"
```bash
# Verificar API Key en .env
grep TECNODATA_API_KEY .env
# Debe tener valor real, no placeholder
```

### Error: "RESOLUTION_EXPIRED"
- Verificar fechas en Configuración → FDE → Numeración DIAN
- Renovar resolución en portal DIAN si vencida

### Error: "RANGE_EXCEEDED"
- Verificar números restantes en Configuración → FDE → Numeración DIAN
- Solicitar ampliación de rango a DIAN

### Error: "XML_INVALID"
- Verificar datos de empresa completos (NIT, dirección, ciudad, depto)
- Verificar datos de cliente (NIT/CC válido para facturas)

### Error: "PAC_TIMEOUT"
```bash
# Verificar conectividad desde contenedor
docker exec pos-backend curl -v https://api.tecnodata.com.co/v1/factura
# Debe responder (incluso con error 401 si key inválida)
```

### Verificar Logs
```bash
# Logs del backend
docker compose logs -f backend | grep -i fde

# Logs de Caddy (para ver requests HTTP)
docker compose logs -f caddy
```

---

## Checklist de Producción

- [ ] Cuenta PAC activa con credenciales de producción
- [ ] Resolución DIAN vigente con rangos disponibles
- [ ] Certificado digital DIAN instalado en PAC
- [ ] Datos de empresa completos y correctos
- [ ] Numeración DIAN configurada para cada prefijo
- [ ] Modo prueba **DESACTIVADO** (`FDE_TEST_MODE=false`)
- [ ] API Key de producción configurada
- [ ] Health check FDE pasa sin issues
- [ ] Prueba de factura real exitosa
- [ ] Documento visible en portal DIAN producción
- [ ] QR en recibo valida en https://catalogo-vpfe.dian.gov.co/
- [ ] Backup automático configurado y verificado

---

## Contacto y Soporte

- **DIAN**: https://www.dian.gov.co/ - Tel: 018000 123 456
- **TecnoData**: https://tecnodata.com.co/ - Soporte técnico
- **Facturación Electrónica.co**: https://facturacionelectronica.co/
- **SFE**: https://sfe.com.co/

---

## Referencias

- [Esquemas UBL 2.1 DIAN](https://www.dian.gov.co/impuestos/factura-electronica/esquemas)
- [Resolución 000042 de 2020](https://www.dian.gov.co/impuestos/factura-electronica/normatividad)
- [Catálogo VPFE DIAN](https://catalogo-vpfe.dian.gov.co/)
- [Guía Técnica Factura Electrónica](https://www.dian.gov.co/impuestos/factura-electronica/guia-tecnica)