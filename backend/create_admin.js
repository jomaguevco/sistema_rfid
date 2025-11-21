// Script rápido para crear usuario administrador
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Cargar variables de entorno
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
  database: process.env.DB_NAME || 'rfid_stock_db'
};

async function createAdmin() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Verificar si ya existe
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE username = ?',
      ['admin']
    );

    if (existing.length > 0) {
      console.log('✓ Usuario admin ya existe. Actualizando contraseña...');
      const password_hash = await bcrypt.hash('admin123', 10);
      await connection.execute(
        'UPDATE users SET password_hash = ?, is_active = TRUE WHERE username = ?',
        [password_hash, 'admin']
      );
      console.log('✓ Contraseña del usuario admin actualizada');
    } else {
      console.log('✓ Creando usuario administrador...');
      const password_hash = await bcrypt.hash('admin123', 10);
      await connection.execute(
        'INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
        ['admin', 'admin@sistema.com', password_hash, 'admin', true]
      );
      console.log('✓ Usuario administrador creado exitosamente');
    }
    
    console.log('\n📋 Credenciales:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   ⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión\n');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createAdmin();

