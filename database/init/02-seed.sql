-- =============================================================================
-- POS System - Seed Data
-- Default categories, units, tax rates for Colombia
-- =============================================================================

SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- Default Categories (Grocery - Abarrotes)
-- -----------------------------------------------------------------------------

INSERT IGNORE INTO `categories` (`id`, `parent_id`, `name`, `sort_order`, `is_active`) VALUES
-- Top level
(1, NULL, 'Abarrotes', 1, TRUE),
(2, NULL, 'Bebidas', 2, TRUE),
(3, NULL, 'Limpieza', 3, TRUE),
(4, NULL, 'Cuidado Personal', 4, TRUE),
(5, NULL, 'Frutas y Verduras', 5, TRUE),
(6, NULL, 'Carnes y Pescados', 6, TRUE),
(7, NULL, 'Lácteos y Huevos', 7, TRUE),
(8, NULL, 'Panadería', 8, TRUE),
(9, NULL, 'Congelados', 9, TRUE),
(10, NULL, 'Mascotas', 10, TRUE),
-- Abarrotes subcategories
(11, 1, 'Granos y Cereales', 1, TRUE),
(12, 1, 'Enlatados', 2, TRUE),
(13, 1, 'Aceites y Vinagres', 3, TRUE),
(14, 1, 'Condimentos', 4, TRUE),
(15, 1, 'Harinas', 5, TRUE),
(16, 1, 'Pastas', 6, TRUE),
(17, 1, 'Azúcar y Endulzantes', 7, TRUE),
(18, 1, 'Café y Té', 8, TRUE),
-- Bebidas subcategories
(19, 2, 'Gaseosas', 1, TRUE),
(20, 2, 'Jugos', 2, TRUE),
(21, 2, 'Agua', 3, TRUE),
(22, 2, 'Cervezas', 4, TRUE),
(23, 2, 'Licores', 5, TRUE),
(24, 2, 'Energizantes', 6, TRUE),
-- Limpieza subcategories
(25, 3, 'Detergentes', 1, TRUE),
(26, 3, 'Suavizantes', 2, TRUE),
(27, 3, 'Limpiadores', 3, TRUE),
(28, 3, 'Papel Higiénico', 4, TRUE),
(29, 3, 'Bolsas de Basura', 5, TRUE);

-- -----------------------------------------------------------------------------
-- Default Categories (Restaurant - Restaurante)
-- -----------------------------------------------------------------------------

INSERT IGNORE INTO `categories` (`id`, `parent_id`, `name`, `sort_order`, `is_active`) VALUES
-- Top level (IDs continue from above)
(100, NULL, 'Entradas', 1, TRUE),
(101, NULL, 'Platos Fuertes', 2, TRUE),
(102, NULL, 'Acompañamientos', 3, TRUE),
(103, NULL, 'Ensaladas', 4, TRUE),
(104, NULL, 'Sopas', 5, TRUE),
(105, NULL, 'Postres', 6, TRUE),
(106, NULL, 'Bebidas', 7, TRUE),
(107, NULL, 'Cócteles', 8, TRUE),
-- Platos Fuertes subcategories
(108, 101, 'Carnes', 1, TRUE),
(109, 101, 'Pescados y Mariscos', 2, TRUE),
(110, 101, 'Pollo', 3, TRUE),
(111, 101, 'Cerdo', 4, TRUE),
(112, 101, 'Vegetarianos/Veganos', 5, TRUE),
(113, 101, 'Pastas', 6, TRUE),
(114, 101, 'Arroces', 7, TRUE),
-- Bebidas subcategories
(115, 106, 'Sin Alcohol', 1, TRUE),
(116, 106, 'Con Alcohol', 2, TRUE),
(117, 106, 'Café y Té', 3, TRUE),
-- Postres subcategories
(118, 105, 'Tortas', 1, TRUE),
(119, 105, 'Helados', 2, TRUE),
(120, 105, 'Flanes y Gelatinas', 3, TRUE);

-- -----------------------------------------------------------------------------
-- Default Units of Measure
-- (Reference data - used in application, not a table)
-- -----------------------------------------------------------------------------
-- Grocery: pza, kg, g, L, ml, m, cm, pack, caja, bolsa, lata, botella
-- Restaurant: porcion, plato, g, ml, kg, unidad, cucharada, cucharadita, taza, pizca

-- -----------------------------------------------------------------------------
-- Default Tax Rates (Colombia)
-- -----------------------------------------------------------------------------
-- IVA: 19% (general), 5% (básicos), 0% (exentos)
-- INC: 8% (licores, cervezas), 16% (tabaco), 20% (juegos de azar)
-- These are used in application logic, products store their specific rate

-- -----------------------------------------------------------------------------
-- Default Payment Methods (Reference)
-- -----------------------------------------------------------------------------
-- cash (Efectivo), card (Tarjeta Débito/Crédito), transfer (Transferencia), other (Otro)

-- =============================================================================
-- End of Seed Data
-- =============================================================================