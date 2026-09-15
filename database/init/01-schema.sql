-- =============================================================================
-- POS System Database Schema
-- MariaDB 11.4+ | InnoDB | utf8mb4
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- Core: Users & Authentication
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `role` ENUM('admin','manager','cashier') NOT NULL DEFAULT 'cashier',
    `business_type` ENUM('grocery','restaurant') NOT NULL,
    `max_concurrent_sessions` TINYINT UNSIGNED NOT NULL DEFAULT 3,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_email` (`email`),
    KEY `idx_users_role` (`role`),
    KEY `idx_users_business_type` (`business_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `refresh_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL COMMENT 'SHA-256 of opaque token',
    `expires_at` TIMESTAMP NOT NULL,
    `revoked_at` TIMESTAMP NULL,
    `replaced_by_token_hash` VARCHAR(255) NULL COMMENT 'For rotation chain tracking',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_refresh_tokens_user_expires` (`user_id`, `expires_at`),
    KEY `idx_refresh_tokens_token_hash` (`token_hash`),
    CONSTRAINT `fk_refresh_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Catalog: Categories & Products (Both Models)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `parent_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(255) NOT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_categories_parent` (`parent_id`),
    KEY `idx_categories_active` (`is_active`),
    CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `products` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sku` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('simple','composite') NOT NULL DEFAULT 'simple',
    `unit` VARCHAR(20) NOT NULL COMMENT 'pza, kg, g, ml, porcion, plato',
    `price` DECIMAL(12,2) NOT NULL,
    `cost` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `tax_rate` DECIMAL(5,4) NOT NULL DEFAULT 0.1900 COMMENT 'Colombia IVA 19%',
    `category_id` BIGINT UNSIGNED NOT NULL,
    `track_stock` BOOLEAN NOT NULL DEFAULT TRUE,
    `min_stock` DECIMAL(10,3) NOT NULL DEFAULT 0,
    `current_stock` DECIMAL(10,3) NOT NULL DEFAULT 0,
    `recipe_id` BIGINT UNSIGNED NULL COMMENT 'Only for composite products',
    `image_url` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_products_sku` (`sku`),
    KEY `idx_products_category` (`category_id`),
    KEY `idx_products_active` (`is_active`),
    KEY `idx_products_type` (`type`),
    CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_variants` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(100) NOT NULL COMMENT 'e.g., Chico, Mediano, Grande',
    `price_delta` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `sku_suffix` VARCHAR(20) NULL COMMENT 'e.g., -CH, -MD, -GD',
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_product_variants_product` (`product_id`),
    CONSTRAINT `fk_product_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Restaurant: Ingredients, Recipes, Modifiers
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `ingredients` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `unit` VARCHAR(20) NOT NULL COMMENT 'g, ml, unidad',
    `cost_per_unit` DECIMAL(12,4) NOT NULL,
    `current_stock` DECIMAL(12,3) NOT NULL DEFAULT 0,
    `min_stock` DECIMAL(12,3) NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_ingredients_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recipes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `instructions` TEXT NULL,
    `prep_time_minutes` INT NOT NULL DEFAULT 0,
    `cook_time_minutes` INT NOT NULL DEFAULT 0,
    `yield_quantity` DECIMAL(10,3) NOT NULL DEFAULT 1,
    `yield_unit` VARCHAR(20) NOT NULL DEFAULT 'porcion',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_recipes_product` (`product_id`),
    CONSTRAINT `fk_recipes_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recipe_ingredients` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `recipe_id` BIGINT UNSIGNED NOT NULL,
    `ingredient_id` BIGINT UNSIGNED NOT NULL,
    `quantity` DECIMAL(12,3) NOT NULL,
    `unit` VARCHAR(20) NOT NULL,
    `is_optional` BOOLEAN NOT NULL DEFAULT FALSE,
    `sort_order` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_recipe_ingredients` (`recipe_id`, `ingredient_id`),
    KEY `idx_recipe_ingredients_ingredient` (`ingredient_id`),
    CONSTRAINT `fk_recipe_ingredients_recipe` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_recipe_ingredients_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `modifier_groups` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `selection_type` ENUM('single','multiple') NOT NULL DEFAULT 'single',
    `required` BOOLEAN NOT NULL DEFAULT FALSE,
    `min_selections` INT NOT NULL DEFAULT 0,
    `max_selections` INT NOT NULL DEFAULT 1,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `modifiers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `group_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `price_delta` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `ingredient_id` BIGINT UNSIGNED NULL COMMENT 'For stock impact',
    `ingredient_quantity` DECIMAL(12,3) NOT NULL DEFAULT 0,
    `is_default` BOOLEAN NOT NULL DEFAULT FALSE,
    `sort_order` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_modifiers_group` (`group_id`),
    KEY `idx_modifiers_ingredient` (`ingredient_id`),
    CONSTRAINT `fk_modifiers_group` FOREIGN KEY (`group_id`) REFERENCES `modifier_groups` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_modifiers_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_modifiers` (
    `product_id` BIGINT UNSIGNED NOT NULL,
    `group_id` BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (`product_id`, `group_id`),
    CONSTRAINT `fk_product_modifiers_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_product_modifiers_group` FOREIGN KEY (`group_id`) REFERENCES `modifier_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Sales & Transactions
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `sales` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sale_number` VARCHAR(50) NOT NULL COMMENT 'Format: POS-YYYYMMDD-XXXX',
    `user_id` BIGINT UNSIGNED NOT NULL,
    `register_id` BIGINT UNSIGNED NOT NULL DEFAULT 1,
    `business_type` ENUM('grocery','restaurant') NOT NULL,
    `status` ENUM('pending','completed','refunded','voided') NOT NULL DEFAULT 'pending',
    `subtotal` DECIMAL(12,2) NOT NULL,
    `tax_amount` DECIMAL(12,2) NOT NULL,
    `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12,2) NOT NULL,
    `change_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `payment_method` JSON NOT NULL COMMENT '[{"method":"cash","amount":50000},{"method":"card","amount":30000,"reference":"TXN123"}]',
    `customer_id` BIGINT UNSIGNED NULL,
    `customer_name` VARCHAR(255) NULL,
    `customer_tax_id` VARCHAR(20) NULL COMMENT 'NIT or CC',
    `customer_email` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `synced_at` TIMESTAMP NULL COMMENT 'For offline sync tracking',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_sales_number` (`sale_number`),
    KEY `idx_sales_user_date` (`user_id`, `created_at`),
    KEY `idx_sales_status` (`status`),
    KEY `idx_sales_synced` (`synced_at`),
    KEY `idx_sales_business_type` (`business_type`),
    CONSTRAINT `fk_sales_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sale_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sale_id` BIGINT UNSIGNED NOT NULL,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `variant_id` BIGINT UNSIGNED NULL,
    `quantity` DECIMAL(10,3) NOT NULL,
    `unit_price` DECIMAL(12,2) NOT NULL,
    `total_price` DECIMAL(12,2) NOT NULL,
    `modifiers` JSON NULL COMMENT '[{"group_id":1,"modifier_id":3,"name":"Queso suizo","price_delta":1500}]',
    `ingredient_consumption` JSON NULL COMMENT 'For composite: [{"ingredient_id":1,"quantity":150,"unit":"g"}]',
    `sort_order` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_sale_items_sale` (`sale_id`),
    KEY `idx_sale_items_product` (`product_id`),
    CONSTRAINT `fk_sale_items_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sale_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_sale_items_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Inventory Movements
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `inventory_movements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `type` ENUM('entry','exit','adjustment','sale','refund','transfer','count') NOT NULL,
    `reference_type` ENUM('product','ingredient') NOT NULL,
    `reference_id` BIGINT UNSIGNED NOT NULL,
    `quantity` DECIMAL(12,3) NOT NULL COMMENT 'Signed: +entry, -exit',
    `unit_cost` DECIMAL(12,4) NULL,
    `reason` VARCHAR(100) NOT NULL COMMENT 'compra, venta, merma, ajuste, devolucion',
    `reference` VARCHAR(100) NULL COMMENT 'PO number, sale number, count session',
    `user_id` BIGINT UNSIGNED NOT NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_inventory_movements_ref` (`reference_type`, `reference_id`),
    KEY `idx_inventory_movements_date` (`created_at`),
    KEY `idx_inventory_movements_type` (`type`),
    CONSTRAINT `fk_inventory_movements_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- FDE (Factura Electrónica DIAN)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `fde_documents` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sale_id` BIGINT UNSIGNED NOT NULL,
    `document_type` ENUM('invoice','credit_note','debit_note','pos_ticket') NOT NULL,
    `prefix` VARCHAR(4) NOT NULL COMMENT 'POS, FAC, NC, ND',
    `number` BIGINT UNSIGNED NOT NULL,
    `cufe` VARCHAR(100) NOT NULL COMMENT 'SHA-384 hash',
    `qr_code` TEXT NOT NULL COMMENT 'DIAN validation URL with CUFE',
    `xml_content` LONGTEXT NOT NULL COMMENT 'UBL 2.1 signed XML',
    `pdf_url` VARCHAR(500) NULL,
    `status` ENUM('pending','authorized','rejected','cancelled') NOT NULL DEFAULT 'pending',
    `dian_response` JSON NULL,
    `pac_provider` VARCHAR(50) NOT NULL,
    `sent_at` TIMESTAMP NULL,
    `authorized_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_fde_documents_sale` (`sale_id`),
    UNIQUE KEY `uq_fde_documents_cufe` (`cufe`),
    UNIQUE KEY `uq_fde_documents_prefix_number` (`prefix`, `number`),
    KEY `idx_fde_documents_status` (`status`),
    KEY `idx_fde_documents_created` (`created_at`),
    CONSTRAINT `fk_fde_documents_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fde_numbering` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `prefix` VARCHAR(4) NOT NULL,
    `current_number` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `resolution_number` VARCHAR(50) NOT NULL,
    `resolution_date` DATE NOT NULL,
    `valid_from` DATE NOT NULL,
    `valid_until` DATE NOT NULL,
    `range_start` BIGINT UNSIGNED NOT NULL,
    `range_end` BIGINT UNSIGNED NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_fde_numbering_prefix` (`prefix`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Offline Sync Queue
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `sync_queue` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `device_id` VARCHAR(64) NOT NULL COMMENT 'Browser fingerprint',
    `entity_type` VARCHAR(50) NOT NULL COMMENT 'sale, inventory_movement, customer',
    `entity_id` BIGINT UNSIGNED NULL COMMENT 'Local temp ID',
    `operation` ENUM('create','update','delete') NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('pending','processing','synced','failed','conflict') NOT NULL DEFAULT 'pending',
    `retry_count` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `last_error` TEXT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `synced_at` TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    KEY `idx_sync_queue_device_status` (`device_id`, `status`),
    KEY `idx_sync_queue_pending` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Purchase Orders (Optional - Phase 5)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `purchase_orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `po_number` VARCHAR(50) NOT NULL,
    `supplier_name` VARCHAR(255) NOT NULL,
    `supplier_tax_id` VARCHAR(20) NULL,
    `status` ENUM('draft','sent','received','cancelled') NOT NULL DEFAULT 'draft',
    `expected_date` DATE NULL,
    `received_date` DATE NULL,
    `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_purchase_orders_number` (`po_number`),
    KEY `idx_purchase_orders_status` (`status`),
    CONSTRAINT `fk_purchase_orders_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_order_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `po_id` BIGINT UNSIGNED NOT NULL,
    `reference_type` ENUM('product','ingredient') NOT NULL,
    `reference_id` BIGINT UNSIGNED NOT NULL,
    `quantity` DECIMAL(12,3) NOT NULL,
    `unit_cost` DECIMAL(12,4) NOT NULL,
    `received_quantity` DECIMAL(12,3) NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_po_items_po` (`po_id`),
    KEY `idx_po_items_reference` (`reference_type`, `reference_id`),
    CONSTRAINT `fk_po_items_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Stock Counts (Optional - Phase 5)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `stock_counts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `type` ENUM('full','partial','cycle') NOT NULL DEFAULT 'full',
    `status` ENUM('in_progress','completed','cancelled') NOT NULL DEFAULT 'in_progress',
    `started_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `completed_at` TIMESTAMP NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `notes` TEXT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_stock_counts_status` (`status`),
    CONSTRAINT `fk_stock_counts_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_count_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `count_id` BIGINT UNSIGNED NOT NULL,
    `reference_type` ENUM('product','ingredient') NOT NULL,
    `reference_id` BIGINT UNSIGNED NOT NULL,
    `expected_quantity` DECIMAL(12,3) NOT NULL,
    `counted_quantity` DECIMAL(12,3) NULL,
    `variance` DECIMAL(12,3) GENERATED ALWAYS AS (`counted_quantity` - `expected_quantity`) STORED,
    `counted_by` BIGINT UNSIGNED NULL,
    `counted_at` TIMESTAMP NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_count_items` (`count_id`, `reference_type`, `reference_id`),
    KEY `idx_count_items_count` (`count_id`),
    CONSTRAINT `fk_count_items_count` FOREIGN KEY (`count_id`) REFERENCES `stock_counts` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_count_items_user` FOREIGN KEY (`counted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- End of Schema
-- =============================================================================