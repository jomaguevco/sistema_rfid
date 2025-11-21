const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const archiver = require('archiver');
const zlib = require('zlib');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const cron = require('node-cron');

const BACKUP_DIR = path.join(__dirname, '../../backups');
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'josemariano.2003',
  database: process.env.DB_NAME || 'rfid_stock_db'
};

/**
 * Asegurar que el directorio de backups existe
 */
async function ensureBackupDir() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch (error) {
    console.error('Error al crear directorio de backups:', error);
    throw error;
  }
}

/**
 * Generar backup SQL de la base de datos
 */
async function generateBackup() {
  try {
    await ensureBackupDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                     new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const backupFileName = `backup_${timestamp}.sql`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);
    
    // Conectar a MySQL
    const connection = await mysql.createConnection(DB_CONFIG);
    
    // Obtener todas las tablas
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);
    
    let sqlContent = `-- Backup generado el ${new Date().toISOString()}\n`;
    sqlContent += `-- Base de datos: ${DB_CONFIG.database}\n\n`;
    sqlContent += `SET FOREIGN_KEY_CHECKS=0;\n\n`;
    
    // Generar SQL para cada tabla
    for (const tableName of tableNames) {
      // Estructura de la tabla
      const [createTable] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      sqlContent += `${createTable[0]['Create Table']};\n\n`;
      
      // Datos de la tabla
      const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
      if (rows.length > 0) {
        sqlContent += `INSERT INTO \`${tableName}\` VALUES\n`;
        const values = rows.map(row => {
          const rowValues = Object.values(row).map(val => {
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            return val;
          });
          return `(${rowValues.join(', ')})`;
        });
        sqlContent += values.join(',\n') + ';\n\n';
      }
    }
    
    sqlContent += `SET FOREIGN_KEY_CHECKS=1;\n`;
    
    // Escribir archivo
    await fs.writeFile(backupPath, sqlContent, 'utf8');
    
    await connection.end();
    
    // Comprimir backup
    const compressedPath = await compressBackup(backupPath);
    
    // Eliminar archivo sin comprimir
    await fs.unlink(backupPath);
    
    return {
      filename: path.basename(compressedPath),
      path: compressedPath,
      size: (await fs.stat(compressedPath)).size,
      createdAt: new Date()
    };
  } catch (error) {
    console.error('Error al generar backup:', error);
    throw error;
  }
}

/**
 * Comprimir archivo de backup
 */
async function compressBackup(filePath) {
  return new Promise((resolve, reject) => {
    const outputPath = filePath + '.gz';
    const input = fsSync.createReadStream(filePath);
    const output = fsSync.createWriteStream(outputPath);
    const gzip = zlib.createGzip({ level: 9 });
    
    input.pipe(gzip).pipe(output);
    
    output.on('finish', () => {
      resolve(outputPath);
    });
    
    output.on('error', (err) => {
      reject(err);
    });
    
    gzip.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Listar todos los backups disponibles
 */
async function listBackups() {
  try {
    await ensureBackupDir();
    const files = await fs.readdir(BACKUP_DIR);
    
    const backups = await Promise.all(
      files
        .filter(file => file.endsWith('.sql.gz') || file.endsWith('.sql'))
        .map(async (file) => {
          const filePath = path.join(BACKUP_DIR, file);
          const stats = await fs.stat(filePath);
          return {
            filename: file,
            size: stats.size,
            createdAt: stats.birthtime
          };
        })
    );
    
    return backups.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error al listar backups:', error);
    throw error;
  }
}

/**
 * Eliminar backup antiguo
 */
async function deleteBackup(filename) {
  try {
    const filePath = path.join(BACKUP_DIR, filename);
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error('Error al eliminar backup:', error);
    throw error;
  }
}

/**
 * Obtener ruta completa del backup
 */
function getBackupPath(filename) {
  return path.join(BACKUP_DIR, filename);
}

/**
 * Programar backups automáticos
 * @param {string} schedule - Expresión cron (ej: '0 2 * * *' para diario a las 2 AM)
 * @param {function} callback - Callback a ejecutar después del backup
 */
function scheduleBackup(schedule, callback) {
  if (!cron.validate(schedule)) {
    throw new Error('Expresión cron inválida');
  }
  
  const task = cron.schedule(schedule, async () => {
    try {
      console.log(`🔄 Ejecutando backup programado...`);
      const backup = await generateBackup();
      console.log(`✓ Backup programado completado: ${backup.filename}`);
      if (callback) {
        callback(null, backup);
      }
    } catch (error) {
      console.error('✗ Error en backup programado:', error);
      if (callback) {
        callback(error, null);
      }
    }
  }, {
    scheduled: true,
    timezone: 'America/Mexico_City' // Ajustar según necesidad
  });
  
  return task;
}

/**
 * Programar backup diario (por defecto a las 2 AM)
 */
function scheduleDailyBackup(callback) {
  return scheduleBackup('0 2 * * *', callback);
}

/**
 * Programar backup semanal (domingos a las 2 AM)
 */
function scheduleWeeklyBackup(callback) {
  return scheduleBackup('0 2 * * 0', callback);
}

/**
 * Programar backup mensual (día 1 a las 2 AM)
 */
function scheduleMonthlyBackup(callback) {
  return scheduleBackup('0 2 1 * *', callback);
}

module.exports = {
  generateBackup,
  listBackups,
  deleteBackup,
  getBackupPath,
  scheduleBackup,
  scheduleDailyBackup,
  scheduleWeeklyBackup,
  scheduleMonthlyBackup,
  BACKUP_DIR
};

