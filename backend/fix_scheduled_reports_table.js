// Script rápido para crear la tabla scheduled_reports
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
  charset: 'utf8mb4'
};

async function createTable() {
  let connection;
  try {
    console.log('🔍 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Conexión establecida\n');
    
    console.log('📋 Creando tabla scheduled_reports...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS scheduled_reports (
        id INT PRIMARY KEY AUTO_INCREMENT,
        report_name VARCHAR(255) NOT NULL,
        report_type ENUM('expired', 'expiring', 'low_stock', 'traceability', 'consumption_by_area', 'predictions', 'custom') NOT NULL,
        schedule_type ENUM('daily', 'weekly', 'monthly', 'custom') NOT NULL,
        schedule_config JSON COMMENT 'Configuración del cron (día, hora, etc.)',
        recipients TEXT COMMENT 'Emails separados por coma',
        format ENUM('csv', 'excel', 'pdf', 'json') DEFAULT 'pdf',
        filters JSON COMMENT 'Filtros del reporte (fechas, productos, áreas, etc.)',
        is_active BOOLEAN DEFAULT TRUE,
        last_run_at TIMESTAMP NULL COMMENT 'Última vez que se ejecutó',
        next_run_at TIMESTAMP NULL COMMENT 'Próxima ejecución programada',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_is_active (is_active),
        INDEX idx_next_run_at (next_run_at),
        INDEX idx_report_type (report_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Tabla scheduled_reports creada');
    
    console.log('\n📋 Creando tabla scheduled_report_executions...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS scheduled_report_executions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        scheduled_report_id INT NOT NULL,
        execution_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('success', 'failed', 'pending') DEFAULT 'pending',
        records_generated INT DEFAULT 0,
        file_path VARCHAR(500) COMMENT 'Ruta del archivo generado',
        error_message TEXT,
        execution_time_ms INT COMMENT 'Tiempo de ejecución en milisegundos',
        FOREIGN KEY (scheduled_report_id) REFERENCES scheduled_reports(id) ON DELETE CASCADE,
        INDEX idx_scheduled_report_id (scheduled_report_id),
        INDEX idx_execution_date (execution_date),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Tabla scheduled_report_executions creada');
    
    console.log('\n✅ Tablas creadas correctamente');
    console.log('💡 Reinicia el servidor para que los cambios surtan efecto');
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('💡 Las tablas ya existen');
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createTable();

