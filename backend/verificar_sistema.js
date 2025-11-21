// Script para verificar el sistema y crear usuario admin si es necesario
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

async function verificarSistema() {
  let connection;
  try {
    console.log('🔍 Verificando sistema...\n');
    
    // 1. Verificar conexión a MySQL
    console.log('1. Verificando conexión a MySQL...');
    console.log(`   Host: ${dbConfig.host}`);
    console.log(`   User: ${dbConfig.user}`);
    console.log(`   Database: ${dbConfig.database}`);
    try {
      connection = await mysql.createConnection(dbConfig);
      console.log('   ✓ Conexión a MySQL establecida\n');
    } catch (error) {
      console.error('   ✗ Error al conectar con MySQL:');
      console.error(`     ${error.message}`);
      console.error('\n💡 Posibles soluciones:');
      console.error('   1. Verifica que MySQL esté corriendo');
      console.error('   2. Verifica las credenciales en database_medical.js');
      console.error('   3. Verifica que la base de datos exista');
      throw error;
    }
    
    // 2. Verificar que la base de datos existe
    console.log('2. Verificando base de datos...');
    const [databases] = await connection.execute(`SHOW DATABASES LIKE '${dbConfig.database}'`);
    if (databases.length === 0) {
      console.log('   ✗ La base de datos no existe. Creándola...');
      await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log('   ✓ Base de datos creada\n');
    } else {
      console.log('   ✓ Base de datos existe\n');
    }
    
    // Usar la base de datos
    await connection.query(`USE \`${dbConfig.database}\``);
    
    // 3. Verificar que la tabla users existe
    console.log('3. Verificando tabla users...');
    const [tables] = await connection.execute(
      `SHOW TABLES LIKE 'users'`
    );
    
    if (tables.length === 0) {
      console.log('   ✗ La tabla users no existe. Creándola...');
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          username VARCHAR(100) NOT NULL UNIQUE,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          role ENUM('admin', 'farmaceutico', 'farmaceutico_jefe', 'enfermero', 'supervisor', 'auditor') NOT NULL DEFAULT 'enfermero',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP NULL,
          INDEX idx_username (username),
          INDEX idx_email (email),
          INDEX idx_role (role),
          INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('   ✓ Tabla users creada\n');
    } else {
      console.log('   ✓ Tabla users existe\n');
    }
    
    // 4. Verificar usuario admin
    console.log('4. Verificando usuario admin...');
    const [users] = await connection.execute(
      'SELECT id, username, email, role, is_active FROM users WHERE username = ?',
      ['admin']
    );
    
    if (users.length === 0) {
      console.log('   ✗ Usuario admin no existe. Creándolo...');
      const password_hash = await bcrypt.hash('admin123', 10);
      await connection.execute(
        'INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
        ['admin', 'admin@sistema.com', password_hash, 'admin', true]
      );
      console.log('   ✓ Usuario admin creado\n');
    } else {
      const user = users[0];
      console.log('   ✓ Usuario admin existe');
      console.log(`     - ID: ${user.id}`);
      console.log(`     - Email: ${user.email}`);
      console.log(`     - Rol: ${user.role}`);
      console.log(`     - Activo: ${user.is_active ? 'Sí' : 'No'}`);
      
      // Actualizar contraseña por si acaso
      console.log('   Actualizando contraseña...');
      const password_hash = await bcrypt.hash('admin123', 10);
      await connection.execute(
        'UPDATE users SET password_hash = ?, is_active = TRUE WHERE username = ?',
        [password_hash, 'admin']
      );
      console.log('   ✓ Contraseña actualizada\n');
    }
    
    console.log('✅ Sistema verificado correctamente\n');
    console.log('📋 Credenciales:');
    console.log('   Username: admin');
    console.log('   Password: admin123\n');
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

verificarSistema();

