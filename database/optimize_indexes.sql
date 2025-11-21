-- ============================================================================
-- Optimización de Índices para Búsqueda y Rendimiento
-- ============================================================================
-- 
-- Este script agrega índices adicionales para mejorar el rendimiento de
-- búsquedas y consultas frecuentes.
-- Uso: mysql -u root -p rfid_stock_db < database/optimize_indexes.sql
-- ============================================================================

USE rfid_stock_db;

-- Índices compuestos para productos (búsquedas frecuentes)
-- Nota: MySQL no soporta IF NOT EXISTS en CREATE INDEX, verificar manualmente antes de ejecutar
CREATE INDEX idx_products_type_category ON products(product_type, category_id);
CREATE INDEX idx_products_name_search ON products(name(100));
CREATE INDEX idx_products_active_ingredient ON products(active_ingredient(50));

-- Índices para lotes (búsquedas por vencimiento y estado)
CREATE INDEX idx_batches_expiry_status ON product_batches(expiry_date, quantity);
CREATE INDEX idx_batches_product_expiry ON product_batches(product_id, expiry_date);

-- Índices para historial de stock (búsquedas por fecha y área)
CREATE INDEX idx_history_date_area ON stock_history(consumption_date, area_id);
CREATE INDEX idx_history_product_date ON stock_history(product_id, consumption_date);
CREATE INDEX idx_history_batch_date ON stock_history(batch_id, consumption_date);

-- Índices para predicciones (búsquedas por período y área)
CREATE INDEX idx_predictions_period_area ON consumption_predictions(prediction_period, area_id);
CREATE INDEX idx_predictions_product_period ON consumption_predictions(product_id, prediction_period, start_date);

-- Índices para alertas (búsquedas por tipo y severidad)
CREATE INDEX idx_alerts_type_severity ON stock_alerts(alert_type, severity, is_resolved);
CREATE INDEX idx_alerts_product_resolved ON stock_alerts(product_id, is_resolved, created_at);

-- Índices para órdenes de compra
CREATE INDEX idx_orders_supplier_status ON purchase_orders(supplier_id, status);
CREATE INDEX idx_orders_date_status ON purchase_orders(order_date, status);
CREATE INDEX idx_order_items_product ON purchase_order_items(product_id);

-- Índices para auditoría (búsquedas por usuario y acción)
CREATE INDEX idx_audit_user_action ON audit_logs(user_id, action, timestamp);
CREATE INDEX idx_audit_table_record ON audit_logs(table_name, record_id, timestamp);

-- Índices para usuarios (búsquedas por rol y estado)
CREATE INDEX idx_users_role_active ON users(role, is_active);
CREATE INDEX idx_users_email ON users(email);

-- Índices para sesiones (limpieza de sesiones expiradas)
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_sessions_user_expires ON user_sessions(user_id, expires_at);

-- Análisis de tablas para optimización del optimizador de consultas
ANALYZE TABLE products;
ANALYZE TABLE product_batches;
ANALYZE TABLE stock_history;
ANALYZE TABLE consumption_predictions;
ANALYZE TABLE stock_alerts;
ANALYZE TABLE purchase_orders;
ANALYZE TABLE purchase_order_items;
ANALYZE TABLE audit_logs;
ANALYZE TABLE users;
ANALYZE TABLE user_sessions;

