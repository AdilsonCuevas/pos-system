-- =============================================================================
-- POS System - FDE Numbering Configuration (DIAN Colombia)
-- =============================================================================

SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- FDE Numbering Ranges
-- These MUST be configured with your DIAN resolution data
-- Get these from: https://catalogo-vpfe.dian.gov.co/ or your accountant
-- -----------------------------------------------------------------------------

-- Example configuration (REPLACE WITH YOUR ACTUAL DIAN DATA):
-- 
-- Resolution Number: 18760000001 (from DIAN)
-- Resolution Date: 2024-01-15
-- Prefix: POS (for POS tickets) or FAC (for full invoices)
-- Range: 1 to 999999
-- Valid From: 2024-01-15
-- Valid Until: 2025-01-15 (or as per resolution)

INSERT IGNORE INTO `fde_numbering` (`prefix`, `current_number`, `resolution_number`, `resolution_date`, `valid_from`, `valid_until`, `range_start`, `range_end`, `is_active`) VALUES
-- POS Tickets (tiquete POS máquina registradora)
('POS', 0, 'TU_RESOLUCION_POS', '2024-01-15', '2024-01-15', '2025-01-15', 1, 999999, TRUE),
-- Full Invoices (factura electrónica)
('FAC', 0, 'TU_RESOLUCION_FAC', '2024-01-15', '2024-01-15', '2025-01-15', 1, 999999, TRUE),
-- Credit Notes (nota crédito)
('NC', 0, 'TU_RESOLUCION_NC', '2024-01-15', '2024-01-15', '2025-01-15', 1, 999999, TRUE),
-- Debit Notes (nota débito)
('ND', 0, 'TU_RESOLUCION_ND', '2024-01-15', '2024-01-15', '2025-01-15', 1, 999999, TRUE);

-- -----------------------------------------------------------------------------
-- IMPORTANT NOTES:
-- 1. Each prefix (POS, FAC, NC, ND) requires its own DIAN resolution
-- 2. The range_start and range_end MUST match your authorized range
-- 3. current_number starts at 0; first invoice will be 1
-- 4. When current_number reaches range_end, NO MORE invoices can be issued
-- 5. Monitor via: SELECT prefix, current_number, range_end FROM fde_numbering;
-- 6. Renew resolution BEFORE valid_until expires
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- DIAN Document Types (for reference in code)
-- -----------------------------------------------------------------------------
-- 01 = Factura de Venta
-- 02 = Nota Crédito
-- 03 = Nota Débito
-- 04 = Tiquete POS
-- 05 = Documento Soporte en Adquisiciones
-- 06 = Factura de Exportación
-- 07 = Nota Crédito Exportación
-- 08 = Nota Débito Exportación
-- 09 = Tiquete POS Exportación

-- =============================================================================
-- End of FDE Numbering Configuration
-- =============================================================================