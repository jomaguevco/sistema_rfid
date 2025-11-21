const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'josemariano.2003',
  database: process.env.DB_NAME || 'rfid_stock_db'
};

/**
 * Restaurar backup desde archivo SQL
 */
async function restoreBackup(backupPath) {
  try {
    let sqlContent;
    
    // Si es archivo comprimido, descomprimir
    if (backupPath.endsWith('.gz')) {
      const readStream = fs.createReadStream(backupPath);
      const gunzip = zlib.createGunzip();
      const chunks = [];
      
      return new Promise((resolve, reject) => {
        gunzip.on('data', (chunk) => chunks.push(chunk));
        gunzip.on('end', async () => {
          try {
            sqlContent = Buffer.concat(chunks).toString('utf8');
            await executeRestore(sqlContent);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        gunzip.on('error', reject);
        readStream.pipe(gunzip);
      });
    } else {
      const fsPromises = require('fs').promises;
      sqlContent = await fsPromises.readFile(backupPath, 'utf8');
      await executeRestore(sqlContent);
    }
  } catch (error) {
    console.error('Error al restaurar backup:', error);
    throw error;
  }
}

/**
 * Ejecutar SQL de restauración
 */
async function executeRestore(sqlContent) {
  const connection = await mysql.createConnection({
    ...DB_CONFIG,
    multipleStatements: true
  });
  
  try {
    // Dividir en statements individuales
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.query(statement);
        } catch (error) {
          // Ignorar errores de DROP TABLE si la tabla no existe
          if (!statement.toUpperCase().includes('DROP TABLE') || !error.message.includes("doesn't exist")) {
            console.warn('Advertencia al ejecutar statement:', error.message);
          }
        }
      }
    }
    
    await connection.end();
  } catch (error) {
    await connection.end();
    throw error;
  }
}

/**
 * Validar archivo de backup antes de restaurar
 */
async function validateBackup(backupPath) {
  try {
    let sqlContent;
    
    const fsPromises = require('fs').promises;
    if (backupPath.endsWith('.gz')) {
      // Para archivos comprimidos, solo verificar que existe
      await fsPromises.access(backupPath);
      return true;
    } else {
      sqlContent = await fsPromises.readFile(backupPath, 'utf8');
      // Verificar que contiene comandos SQL básicos
      return sqlContent.includes('CREATE TABLE') || sqlContent.includes('INSERT INTO');
    }
  } catch (error) {
    return false;
  }
}

module.exports = {
  restoreBackup,
  validateBackup
};

