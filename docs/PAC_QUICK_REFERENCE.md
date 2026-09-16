# PAC Configuration Quick Reference

## Environment Variables (.env)

```bash
# FDE Configuration
FDE_PAC_PROVIDER=tecnodata                    # tecnodata | facturacion_electronica_co | sfe
FDE_TEST_MODE=true                            # true=homologación, false=producción

# API Keys (obtener del portal del PAC)
TECNODATA_API_KEY=your_tecnodata_key
FACTURACION_ELECTRONICA_CO_API_KEY=your_fe_key
SFE_API_KEY=your_sfe_key

# Company Data
COMPANY_NIT=900123456                         # Sin dígito verificación
COMPANY_NAME=MI EMPRESA SAS
COMPANY_ADDRESS=Calle 123 #45-67
COMPANY_CITY=BOGOTA
COMPANY_DEPARTMENT=CUNDINAMARCA
COMPANY_PHONE=+57 1 2345678
COMPANY_EMAIL=facturacion@miempresa.com

FDE_TEST_MODE=true                            # true=homologación, false=producción
```

## DIAN Resolution Setup (por prefijo)

| Prefijo | Tipo | Código DIAN | Uso |
|---------|------|-------------|-----|
| POS | Tiquete POS | 04 | Ventas POS |
| FAC | Factura Venta | 01 | Facturas B2B |
| NC | Nota Crédito | 02 | Devoluciones |
| ND | Nota Débito | 03 | Ajustes |

## DIAN Resolution Data (por prefijo)

```sql
INSERT INTO fde_numbering (prefix, current_number, resolution_number, resolution_date, 
  valid_from, valid_until, range_start, range_end, is_active) 
VALUES 
('POS', 0, '18760000001', '2024-01-15', '2024-01-15', '2025-01-15', 1, 999999, true),
('FAC', 0, '18760000002', '2024-01-15', '2024-01-15', '2025-01-15', 1, 999999, true),
('NC', 0, '18760000003', '2024-01-15', '2024-01-15', '2025-01-15', 1, 999999, true),
('ND', 0, '18760000004', '2024-01-15', '2024-01-15', '2025-01-15', 1, 999999, true);
```

## Document Types (Códigos DIAN)

| Código | Documento | Uso |
|--------|-----------|-----|
| 01 | Factura de Venta | B2B, exportación |
| 02 | Nota Crédito | Devoluciones, descuentos |
| 03 | Nota Débito | Intereses, ajustes |
| 04 | Tiquete POS | Ventas al consumidor final |

## PAC Provider URLs

| Proveedor | Producción | Homologación (Test) |
|-----------|------------|---------------------|
| TecnoData | https://api.tecnodata.com.co/v1 | https://api-hab.tecnodata.com.co/v1 |
| Facturación Electrónica.co | https://api.facturacionelectronica.co/v1 | https://api-hab.facturacionelectronica.co/v1 |
| SFE | https://api.sfe.com.co/v1 | https://api-hab.sfe.com.co/v1 |

## DIAN Validation URLs

| Ambiente | URL |
|----------|-----|
| Producción | https://catalogo-vpfe.dian.gov.co/Document/Validate?cufe={CUFE} |
| Homologación | https://catalogo-vpfe-hab.dian.gov.co/Document/Validate?cufe={CUFE} |

## Document Type Codes (Códigos DIAN)

| Código | Documento | Prefijo Sugerido |
|--------|-----------|------------------|
| 01 | Factura de Venta | FAC |
| 02 | Nota Crédito | NC |
| 03 | Nota Débito | ND |
| 04 | Tiquete POS | POS |
| 05 | Documento Soporte | DS |
| 06 | Factura Exportación | FE |
| 07 | Nota Crédito Exportación | NCE |
| 08 | Nota Débito Exportación | NDE |
| 09 | Tiquete POS Exportación | POSE |

## CUFE Generation Fields (SHA-384)

Concatenar en orden:
```
NIT + DocType + Prefix + Number(10d) + IssueDate(YYYYMMDD) + 
IssueTime(HHMMSS) + TotalAmount(cents) + CustomerNIT + TechnicalKey
```

Ejemplo:
```
900123456 + 01 + FAC + 0000000001 + 20260915 + 143000 + 
12345600 + 800123456 + TECHNICAL_KEY
```

## Health Check Endpoints

```bash
# Verificar configuración FDE
curl -k https://pos.local/api/config/fde/health

# Verificar PAC
curl -k https://pos.local/api/config/fde/pac

# Verificar numeración
curl -k https://pos.local/api/config/fde/numbering

# Verificar documentos pendientes
curl -k "https://pos.local/api/fde/documents?status=pending"
```

## Verificación DIAN

### Homologación (Test)
```
https://catalogo-vpfe-hab.dian.gov.co/Document/Validate?cufe={CUFE}
```

### Producción
```
https://catalogo-vpfe.dian.gov.co/Document/Validate?cufe={CUFE}
```

## Códigos de Error Comunes

| Código | Causa | Solución |
|--------|-------|----------|
| PAC_UNAUTHORIZED | API Key inválida | Verificar API Key en .env |
| RESOLUTION_EXPIRED | Resolución vencida | Renovar en DIAN |
| RANGE_EXCEEDED | Rango agotado | Solicitar nuevo rango |
| INVALID_NIT | NIT inválido | Verificar NIT sin dígito verificación |
| XML_INVALID | XML mal formado | Verificar datos empresa/cliente |
| DUPLICATE_CUFE | CUFE duplicado | Revisar numeración |
| PAC_TIMEOUT | Timeout PAC | Reintentar / verificar red |
| INVALID_CUFE | CUFE inválido | Verificar generación CUFE |

## Comandos Útiles

```bash
# Ver logs FDE
docker compose logs -f backend | grep -i fde

# Verificar PAC desde contenedor
docker exec pos-backend curl -v https://api.tecnodata.com.co/v1/factura

# Health check FDE
curl -k https://pos.local/api/config/fde/health

# Reiniciar backend tras cambios FDE
docker compose restart backend

# Verificar numeración vigente
curl -k https://pos.local/api/config/fde/numbering | jq '.[] | select(.is_valid==true)'

# Ver documentos pendientes
curl -k "https://pos.local/api/fde/documents?status=pending" | jq '.[] | {id, prefix, number, status, cufe}'
```