# POS System - Inventario & Punto de Venta

Sistema de inventario y punto de venta (POS) para **tiendas de abarrotes** y **restaurantes**, diseñado para ejecutarse completamente en **red local (LAN)** sin acceso a internet.

## 🎯 Características Principales

| Característica | Abarrotes | Restaurante |
|----------------|-----------|-------------|
| **Productos** | Simples (SKU, precio, stock) | Simples + **Compuestos (recetas)** |
| **Inventario** | Nivel producto | Nivel **ingrediente** (g, ml) |
| **POS** | Escanear → Pagar | Seleccionar → **Modificadores** → Pagar |
| **Modificadores** | ❌ | ✅ (queso extra, sin cebolla, término) |
| **Recetas** | ❌ | ✅ (ingredientes + cantidades + costo) |
| **Tickets cocina** | ❌ | ✅ (por estación) |
| **Análisis margen** | Por producto | **Por receta + ingredientes** |

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      LAN (192.168.x.0/24)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Caja 1      │  │  Tablet      │  │  Oficina     │       │
│  │  (Navegador) │  │  (Navegador) │  │  (Navegador) │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           ▼                                   │
│              ┌────────────────────────┐                       │
│              │   SERVIDOR HOST        │                       │
│              │  (Linux/Windows/Mac)   │                       │
│              │  ┌──────────────────┐  │                       │
│              │  │   Caddy :443     │  │  ← HTTPS + mDNS      │
│              │  └────────┬─────────┘  │                       │
│              │           │            │                       │
│              │  ┌────────▼────────┐  │                       │
│              │  │  FastAPI :8000 │  │  ← Backend API         │
│              │  └────────┬────────┘  │                       │
│              │           │            │                       │
│              │  ┌────────▼────────┐  │                       │
│              │  │  MariaDB :3306 │  │  ← Solo LAN (bind)     │
│              │  └────────────────┘  │                       │
│              └────────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## 🔒 Seguridad (Solo LAN)

- **MariaDB**: `bind-address = <LAN_IP>` (nunca `0.0.0.0`)
- **Firewall**: Puerto 3306 solo accesible desde CIDR LAN
- **HTTPS**: Certificados locales con **mkcert** (CA de confianza en navegadores)
- **mDNS**: Descubrimiento automático via `pos.local` (Avahi/Bonjour)
- **Auth**: JWT RS256 (15 min) + Refresh tokens con rotación y detección de reuso
- **Roles**: Admin, Manager, Cashier con matriz de permisos

## 🇨🇴 Facturación Electrónica DIAN (Colombia)

- **PAC certificado**: Integración con TecnoData, Facturación Electrónica.co, SFE
- **UBL 2.1**: Generación XML firmado según especificación DIAN
- **CUFE + QR**: Código único y QR de validación DIAN
- **Tipos**: Factura (01), Nota Crédito (02), Nota Débito (03), Tiquete POS (04)
- **Numeración**: Resolución DIAN con rangos autorizados y control automático
- **Modo offline**: Ventas se guardan localmente (IndexedDB) y sincronizan al reconectar

## 📦 Hardware Soportado

| Dispositivo | API Navegador | Fallback |
|-------------|---------------|----------|
| **Escáner códigos** | WebHID | Teclado wedge (input focus) |
| **Impresora térmica** | WebUSB (ESC/POS) | Bluetooth / Print API |
| **Cajón dinero** | WebUSB (kick signal) | Controlado por impresora |

## 🚀 Despliegue Rápido

### Requisitos
- Docker Engine + Docker Compose v2
- Dispositivo host con IP LAN estática o reserva DHCP
- Puerto 80, 443, 3306 disponibles

### Linux/macOS
```bash
git clone <repo>
cd pos-system
cp .env.example .env
# Editar .env con tus valores
./scripts/deploy.sh
```

### Windows (WSL2 + Docker Desktop)
```powershell
git clone <repo>
cd pos-system
Copy-Item .env.example .env
# Editar .env con tus valores
.\scripts\deploy.ps1
```

### Acceso
- **HTTPS**: `https://pos.local` (mDNS) o `https://<LAN_IP>`
- **CA**: Descargar de `https://<LAN_IP>/ca-cert` e instalar en dispositivos
- **Primera vez**: Registrar admin → define tipo de negocio (abarrotes/restaurante)

## 📁 Estructura del Proyecto

```
pos-system/
├── docker-compose.yml          # Orquestación completa
├── .env.example                # Configuración de ejemplo
├── Makefile                    # Comandos comunes
├── backend/                    # FastAPI + SQLAlchemy 2.0
│   ├── app/
│   │   ├── api/v1/routes/      # Endpoints REST
│   │   ├── models/             # Modelos SQLAlchemy
│   │   ├── schemas/            # Esquemas Pydantic v2
│   │   ├── services/           # Lógica de negocio
│   │   │   ├── auth.py         # JWT + refresh rotation
│   │   │   ├── pos.py          # Ventas, stock, offline sync
│   │   │   ├── fde/            # Facturación DIAN
│   │   │   └── hardware.py     # Impresora, cajón
│   │   └── tasks/              # Tareas async (Celery/ARQ)
│   └── tests/
├── frontend/                   # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/           # Login, permisos, roles
│   │   │   ├── pos/            # POS, carrito, modifiers, offline
│   │   │   ├── catalog/        # Productos, ingredientes, recetas
│   │   │   ├── inventory/      # Stock, ajustes, conteos
│   │   │   ├── reports/        # Ventas, valuación, costos
│   │   │   ├── fde/            # Documentos DIAN, configuración
│   │   │   └── settings/       # Usuarios, hardware, backup
│   │   ├── shared/
│   │   │   ├── ui/             # Componentes shadcn/ui
│   │   │   ├── hooks/          # useIndexedDB, useWebHID, useWebUSB
│   │   │   └── utils/          # ESC/POS, validación NIT/CC
│   │   └── app/                # Routing, providers, layout
│   └── public/
├── caddy/                      # Reverse proxy + HTTPS + mkcert
├── avahi/                      # mDNS service (Linux)
├── database/
│   └── init/                   # Schema + seed + FDE numbering
├── scripts/
│   ├── deploy.sh / deploy.ps1  # Despliegue automatizado
│   ├── backup.sh / backup.ps1  # Backup automático
│   ├── restore.sh / restore.ps1 # Restore interactivo
│   ├── health-check.sh         # Verificación de salud
│   └── install-ca.sh           # Instalar CA en clientes
└── docs/
    ├── DEPLOYMENT.md
    ├── HARDWARE_SETUP.md
    ├── FDE_CONFIGURATION.md
    └── OFFLINE_MODE.md
```

## 🛠️ Desarrollo

```bash
# Iniciar solo BD y proxy
docker compose up -d mariadb caddy

# Backend con hot reload
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend con hot reload
cd frontend && npm run dev

# Tests
make test           # Todos
make test-backend   # Solo backend
make test-frontend  # Solo frontend
make test-e2e       # Playwright E2E

# Linting
make lint           # Ruff (Python) + ESLint (TS)

# Migraciones
make migrate-create MSG="add new field"
make migrate
```

## 📋 Comandos Útiles

```bash
make up             # Iniciar todo
make down           # Detener todo
make restart        # Reiniciar
make logs           # Ver logs
make backup         # Backup manual
make restore        # Restore interactivo
make health         # Verificar salud
make clean          # Limpiar todo (CUIDADO: borra datos)
```

## ⚙️ Configuración Crítica (.env)

```bash
# Red (OBLIGATORIO)
LAN_IP=auto                 # o IP fija: 192.168.1.50
LAN_CIDR=192.168.1.0/24     # Tu red local

# Base de datos (OBLIGATORIO - generar con openssl rand -base64 32)
DB_ROOT_PASSWORD=...
DB_APP_PASSWORD=...

# Auth (OBLIGATORIO - generar con openssl rand -base64 48)
JWT_SECRET=...

# Negocio (OBLIGATORIO)
BUSINESS_TYPE=restaurant    # grocery | restaurant

# FDE DIAN (para facturación electrónica)
FDE_PAC_PROVIDER=tecnodata
TECNODATA_API_KEY=...
COMPANY_NIT=900123456
FDE_TEST_MODE=true
# FDE_RESOLUTION_NUMBER=...
# FDE_PREFIX=POS
# FDE_RANGE_START=1
# FDE_RANGE_END=999999
```

## 📚 Documentación

- [Guía de Despliegue](docs/DEPLOYMENT.md)
- [Configuración Hardware](docs/HARDWARE_SETUP.md)
- [Configuración FDE DIAN](docs/FDE_CONFIGURATION.md)
- [Modo Offline](docs/OFFLINE_MODE.md)
- [API Reference](docs/API.md) (generado desde OpenAPI)

## 🤝 Contribuir

1. Fork del repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Add: nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

Proprietary - Todos los derechos reservados.

## 🆘 Soporte

- **Issues**: GitHub Issues para bugs y feature requests
- **Docs**: Ver carpeta `docs/` para guías detalladas
- **Logs**: `docker compose logs -f <servicio>` para debugging