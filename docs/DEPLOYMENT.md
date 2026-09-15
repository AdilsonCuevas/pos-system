# Guía de Despliegue - Sistema POS

## Requisitos Previos

### Hardware Mínimo (Servidor Host)
- **CPU**: 2 cores (recomendado 4)
- **RAM**: 2 GB (recomendado 4 GB)
- **Almacenamiento**: 10 GB libres
- **Red**: IP LAN estática o reserva DHCP
- **Puertos**: 80, 443, 3306 disponibles

### Software
- **Docker Engine** 24.0+
- **Docker Compose** v2.20+
- **Sistema Operativo**: Ubuntu 22.04+, Windows 10/11 (WSL2), macOS 12+

### Cliente (Dispositivos de Caja)
- Navegador moderno: Chrome 100+, Firefox 100+, Edge 100+, Safari 15+
- Resolución mínima: 1024x768
- Conexión LAN al servidor host

---

## Instalación Rápida

### 1. Clonar y Configurar

```bash
git clone <repository-url> pos-system
cd pos-system

# Copiar configuración de ejemplo
cp .env.example .env

# Editar variables obligatorias
nano .env
```

### 2. Variables Obligatorias (.env)

```bash
# Red (OBLIGATORIO)
LAN_IP=auto                    # o IP fija: 192.168.1.50
LAN_CIDR=192.168.1.0/24        # Tu red local

# Base de Datos (OBLIGATORIO - generar con: openssl rand -base64 32)
DB_ROOT_PASSWORD=tu_password_root_32_chars
DB_APP_PASSWORD=tu_password_app_32_chars

# Autenticación (OBLIGATORIO - generar con: openssl rand -base64 48)
JWT_SECRET=tu_jwt_secret_48_chars

# Negocio (OBLIGATORIO)
BUSINESS_TYPE=restaurant       # grocery | restaurant

# FDE DIAN (para facturación electrónica Colombia)
FDE_PAC_PROVIDER=tecnodata
TECNODATA_API_KEY=tu_api_key_pac
COMPANY_NIT=900123456          # Sin dígito de verificación
FDE_TEST_MODE=true
```

### 3. Generar Contraseñas Seguras

```bash
# DB passwords (32+ chars)
openssl rand -base64 32

# JWT secret (48+ chars)
openssl rand -base64 48
```

### 4. Desplegar

**Linux/macOS:**
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

**Windows (PowerShell como Administrador):**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\deploy.ps1
```

---

## Verificación Post-Despliegue

### 1. Verificar Servicios

```bash
# Estado de contenedores
docker compose ps

# Verificar salud
./scripts/health-check.sh
```

**Salida esperada:**
```
✅ MariaDB
✅ Backend API
✅ Caddy HTTPS
✅ pos.local resolves (Linux)
```

### 2. Acceder al Sistema

- **HTTPS (mDNS)**: `https://pos.local`
- **HTTPS (IP directa)**: `https://192.168.1.50` (tu LAN_IP)
- **Descargar CA**: `https://192.168.1.50/ca-cert`

### 3. Instalar Certificado CA (Clientes)

**Linux:**
```bash
./scripts/install-ca.sh
```

**macOS:**
```bash
./scripts/install-ca.sh
```

**Windows (PowerShell Admin):**
```powershell
certutil -addstore Root "C:\path\to\rootCA.pem"
```

**Móvil (iOS/Android):**
1. Abrir `https://192.168.1.50/ca-cert` en el navegador
2. Descargar `rootCA.pem`
3. iOS: Configuración → General → VPN y Gestión de Dispositivos
4. Android: Configuración → Seguridad → Instalar desde almacenamiento → Certificado CA

### 4. Primer Acceso

1. Abrir `https://pos.local` en el navegador
2. Registrar primer administrador (define tipo de negocio)
3. Configurar: Productos, Categorías, (Ingredientes/Recetas si restaurante)
4. Configurar FDE en Ajustes → FDE
5. Probar venta completa

---

## Configuración de Hardware

### Escáner de Código de Barras
- **WebHID** (recomendado): Conectar USB → El sistema detecta automáticamente
- **Teclado Wedge** (fallback): Funciona como teclado, enfocar campo de búsqueda

### Impresora Térmica (ESC/POS)
- **WebUSB** (recomendado): Conectar USB → Configurar en Ajustes → Hardware
- **Bluetooth**: Emparejar → Seleccionar en configuración
- Modelos probados: Epson TM-T20/T88, Star TSP100, Bixolon SRP-350

### Cajón de Dinero
- **Por impresora** (RJ12): Se abre automático al imprimir recibo
- **USB directo**: WebUSB kick signal

### Configurar en Ajustes → Hardware
1. Conectar dispositivos
2. Clic en "Detectar Hardware"
3. Probar cada dispositivo
4. Guardar configuración

---

## Configuración FDE (Factura Electrónica DIAN)

### Requisitos Previos
1. Resolución DIAN activa
2. Certificado digital DIAN
3. Cuenta en PAC autorizado (TecnoData, Facturación Electrónica.co, SFE)

### Configurar en Ajustes → FDE

**Datos de la Empresa:**
- NIT (sin dígito verificación)
- Razón Social
- Dirección completa
- Ciudad, Departamento
- Teléfono, Email

**Configuración PAC:**
- Proveedor: `tecnodata` | `facturacion_electronica_co` | `sfe`
- API Key del PAC
- Modo Prueba: `true` (inicial) → `false` (producción)

**Numeración DIAN:**
```
Prefijo: POS (para tiquetes) / FAC (facturas)
Resolución: 18760000001
Fecha Resolución: 2024-01-15
Rango: 1 - 999999
Vigencia: 2024-01-15 a 2025-01-15
```

### Probar FDE
1. Realizar venta con cliente (NIT/CC)
2. Ir a Documentos FDE
3. Verificar estado: "Autorizado" ✅
4. Ver CUFE y QR de validación DIAN

---

## Backup y Restauración

### Backup Automático (Cron)
```bash
# Editar crontab
crontab -e

# Backup diario a las 02:00
0 2 * * * /ruta/pos-system/scripts/backup.sh
```

### Backup Manual
```bash
./scripts/backup.sh
```

### Verificar Backup
```bash
./scripts/verify-backup.sh
```

### Restaurar
```bash
./scripts/restore.sh
# Seleccionar backup de la lista
# Confirmar con "YES"
```

### Backup Offsite (Opcional)
```bash
# Configurar rclone
rclone config
# Nombre: nas
# Tipo: sftp / s3 / etc.

# Agregar a .env
RCLONE_REMOTE=nas:pos-backups
```

---

## Mantenimiento

### Actualizar Sistema
```bash
git pull origin main
docker compose pull
docker compose up -d --build
./scripts/health-check.sh
```

### Logs
```bash
# Todos los servicios
docker compose logs -f

# Servicio específico
docker compose logs -f backend
docker compose logs -f mariadb
docker compose logs -f caddy
```

### Reiniciar Servicios
```bash
docker compose restart
# O servicio específico
docker compose restart backend
```

### Limpiar (CUIDADO: Borra Datos)
```bash
# Solo contenedores
docker compose down

# Contenedores + volúmenes (DATOS PERDIDOS)
docker compose down -v
```

---

## Solución de Problemas

### Error: "No se puede acceder a pos.local"
1. Verificar Avahi (Linux): `systemctl status avahi-daemon`
2. Verificar Bonjour (Windows/macOS)
3. Usar IP directa: `https://192.168.1.50`
4. Verificar firewall

### Error: Certificado no confiable
1. Instalar CA en dispositivo cliente
2. Reiniciar navegador
3. Verificar que Caddy generó cert: `ls caddy/ca/rootCA.pem`

### Error: Base de datos no conecta
```bash
# Verificar contenedor
docker compose logs mariadb

# Probar conexión
docker exec pos-mariadb mysqladmin ping -h 127.0.0.1 -u root -p
```

### Error: FDE "No autorizado"
1. Verificar credenciales PAC en .env
2. Verificar modo prueba vs producción
3. Verificar resolución DIAN vigente
4. Revisar logs: `docker compose logs backend | grep -i fde`

### Rendimiento Lento
1. Verificar recursos: `docker stats`
2. Aumentar memoria en docker-compose.yml
3. Verificar índices BD: `docker exec pos-mariadb mysql -e "SHOW INDEX FROM sales"`

---

## Seguridad

### Firewall (Solo LAN)
- Puerto 3306 (MariaDB): Solo `LAN_CIDR`
- Puerto 80/443 (Caddy): Solo `LAN_CIDR`
- SSH: Acceso admin únicamente

### Actualizaciones de Seguridad
```bash
# Base images
docker compose pull
docker compose up -d --build

# Dependencias
cd backend && poetry update
cd frontend && npm audit fix
```

### Rotación de Secrets
```bash
# Generar nuevos
openssl rand -base64 32  # DB passwords
openssl rand -base64 48  # JWT secret

# Actualizar .env y reiniciar
docker compose restart backend
```

---

## Estructura de Directorios

```
pos-system/
├── .env                 # Configuración (NO commitear)
├── docker-compose.yml   # Orquestación
├── backend/             # FastAPI + SQLAlchemy
├── frontend/            # React + Vite + TS
├── caddy/               # Reverse proxy + HTTPS
├── avahi/               # mDNS (Linux)
├── database/init/       # Schema + seeds SQL
├── scripts/             # Deploy, backup, restore
├── docs/                # Documentación
└── .github/workflows/   # CI/CD
```

---

## Soporte

### Logs Útiles
```bash
# Backend errors
docker compose logs backend | grep -i error

# FDE requests
docker compose logs backend | grep -i fde

# Sync offline
docker compose logs backend | grep -i sync

# MariaDB slow queries
docker exec pos-mariadb mysql -e "SHOW VARIABLES LIKE 'slow_query_log'"
```

### Contacto
- **Issues**: GitHub Issues
- **Logs**: Adjuntar `docker compose logs --tail=100` en reportes
- **Versión**: `git describe --tags`

---

## Checklist de Producción

- [ ] `.env` configurado con valores reales (no defaults)
- [ ] Contraseñas DB y JWT generadas con `openssl rand`
- [ ] IP LAN estática o reserva DHCP configurada
- [ ] Firewall configurado (solo LAN_CIDR)
- [ ] CA instalado en todos los dispositivos cliente
- [ ] FDE configurado con PAC real y resolución DIAN vigente
- [ ] Hardware probado (escáner, impresora, cajón)
- [ ] Backup automático programado (crontab/Task Scheduler)
- [ ] Backup verificado con `verify-backup.sh`
- [ ] Prueba de venta completa (online + offline)
- [ ] Documentación de recuperación ante desastres