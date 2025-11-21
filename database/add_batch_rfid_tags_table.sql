-- Tabla para rastrear múltiples RFID físicos por lote
-- Permite que un lote tenga varios códigos RFID físicos asociados
CREATE TABLE IF NOT EXISTS batch_rfid_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  rfid_uid VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES product_batches(id) ON DELETE CASCADE,
  UNIQUE KEY unique_batch_rfid (batch_id, rfid_uid),
  INDEX idx_rfid_uid (rfid_uid),
  INDEX idx_batch_id (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

