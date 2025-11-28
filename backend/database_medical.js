const mysql = require('mysql2/promise');
const { normalizeRfidCode, formatConcentration } = require('./utils/rfidNormalizer');

// Cargar variables de entorno
require('dotenv').config();

// Configuración de la base de datos MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'rfid_stock_db',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Validar que la contraseña esté configurada en producción
if (process.env.NODE_ENV === 'production' && !dbConfig.password) {
  throw new Error('DB_PASSWORD o DB_PASS debe estar configurado en variables de entorno para producción');
}

// Crear pool de conexiones con configuración mejorada para reconexión
const pool = mysql.createPool({
  ...dbConfig,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Configurar charset UTF-8 en todas las conexiones
pool.on('connection', (connection) => {
  connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  connection.query("SET CHARACTER SET utf8mb4");
  connection.query("SET character_set_connection=utf8mb4");
});

// Manejar errores de conexión del pool
pool.on('error', (err) => {
  if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
    console.error('⚠️  [DB] Conexión perdida, el pool se reconectará automáticamente');
  } else {
    console.error('✗ [DB] Error en pool:', err.code || 'Desconocido');
  }
});

const normalizeText = (value = '') => {
  try {
    return value
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();
  } catch (error) {
    // En entornos que no soportan normalize, degradar sin acentos
    return value
      .toString()
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();
  }
};

// Probar conexión
pool.getConnection()
  .then(connection => {
    console.log('✓ Conexión a MySQL establecida correctamente');
    connection.release();
  })
  .catch(err => {
    console.error('✗ [DB] Error al conectar:', err.code || 'Desconocido', '-', err.message);
  });

// ==================== FUNCIONES HELPER ====================

/**
 * Validar que una cantidad sea válida (número entero positivo mayor a 0)
 * @param {any} quantity - Cantidad a validar
 * @param {string} fieldName - Nombre del campo para mensajes de error (opcional)
 * @returns {number} - Cantidad validada como número entero
 * @throws {Error} - Si la cantidad no es válida
 */
function validateQuantity(quantity, fieldName = 'quantity') {
  // Convertir a número si es string
  const numValue = typeof quantity === 'string' ? parseInt(quantity, 10) : Number(quantity);
  
  // Validar que sea un número válido
  if (isNaN(numValue) || !Number.isFinite(numValue)) {
    throw new Error(`La ${fieldName} debe ser un número válido`);
  }
  
  // Validar que sea entero
  if (!Number.isInteger(numValue)) {
    throw new Error(`La ${fieldName} debe ser un número entero (sin decimales)`);
  }
  
  // Validar que sea positivo
  if (numValue <= 0) {
    throw new Error(`La ${fieldName} debe ser un número positivo mayor a 0`);
  }
  
  return numValue;
}

// ==================== FUNCIONES DE PRODUCTOS ====================

/**
 * Obtener todos los productos con información médica (con paginación opcional)
 */
async function getAllProducts(filters = {}) {
  try {
    // Construir la consulta base con subconsulta para total_stock y información del lote más reciente
    let query = `
      SELECT p.*, pc.name as category_name, 
             COALESCE((SELECT SUM(pb.quantity) FROM product_batches pb WHERE pb.product_id = p.id), 0) as total_stock,
             (SELECT pb.rfid_uid FROM product_batches pb WHERE pb.product_id = p.id ORDER BY pb.created_at DESC LIMIT 1) as batch_rfid_uid,
             COALESCE(
               (SELECT pb.lot_number FROM product_batches pb WHERE pb.product_id = p.id ORDER BY pb.created_at DESC LIMIT 1),
               CONCAT('LOT-', LPAD(p.id, 6, '0'), '-', DATE_FORMAT(NOW(), '%Y%m%d'))
             ) as latest_lot_number
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.product_type) {
      query += ' AND p.product_type = ?';
      params.push(filters.product_type);
    }
    if (filters.category_id) {
      query += ' AND p.category_id = ?';
      params.push(filters.category_id);
    }
    if (filters.search) {
      // Buscar por RFID, ID, nombre, principio activo, descripción o número de lote
      query += ` AND (
        p.rfid_uid = ? 
        OR p.id = ?
        OR p.name LIKE ?
        OR p.active_ingredient LIKE ?
        OR p.description LIKE ?
        OR EXISTS (SELECT 1 FROM product_batches pb WHERE pb.product_id = p.id AND pb.rfid_uid = ?)
        OR EXISTS (SELECT 1 FROM product_batches pb WHERE pb.product_id = p.id AND pb.lot_number LIKE ?)
      )`;
      const searchTerm = `%${filters.search}%`;
      const searchValue = filters.search.trim();
      const searchId = isNaN(searchValue) ? -1 : parseInt(searchValue);
      params.push(searchValue, searchId, searchTerm, searchTerm, searchTerm, searchValue, searchTerm);
    }
    if (filters.active_ingredient) {
      query += ' AND p.active_ingredient LIKE ?';
      params.push(`%${filters.active_ingredient}%`);
    }
    if (filters.rfid_uid) {
      query += ' AND (p.rfid_uid = ? OR EXISTS (SELECT 1 FROM product_batches pb2 WHERE pb2.product_id = p.id AND pb2.rfid_uid = ?))';
      params.push(filters.rfid_uid, filters.rfid_uid);
    }
    if (filters.requires_refrigeration !== undefined) {
      query += ' AND p.requires_refrigeration = ?';
      params.push(filters.requires_refrigeration ? 1 : 0);
    }
    if (filters.expiry_status === 'expired') {
      query += ' AND EXISTS (SELECT 1 FROM product_batches pb3 WHERE pb3.product_id = p.id AND pb3.expiry_date < CURDATE() AND pb3.quantity > 0)';
    }
    if (filters.expiry_status === 'expiring_soon') {
      query += ' AND EXISTS (SELECT 1 FROM product_batches pb4 WHERE pb4.product_id = p.id AND DATEDIFF(pb4.expiry_date, CURDATE()) BETWEEN 0 AND 30 AND pb4.expiry_date >= CURDATE() AND pb4.quantity > 0)';
    }
    if (filters.expiry_status === 'valid') {
      query += ' AND NOT EXISTS (SELECT 1 FROM product_batches pb5 WHERE pb5.product_id = p.id AND pb5.expiry_date < CURDATE() AND pb5.quantity > 0)';
    }

    // Filtrar por stock bajo usando subconsulta en WHERE en lugar de HAVING
    if (filters.low_stock) {
      query += ' AND COALESCE((SELECT SUM(pb.quantity) FROM product_batches pb WHERE pb.product_id = p.id), 0) <= p.min_stock';
    }

    query += ' ORDER BY p.created_at DESC';

    // Aplicar paginación si se proporciona (insertar directamente en SQL después de validar)
    if (filters.limit !== undefined && filters.offset !== undefined) {
      const limit = parseInt(filters.limit, 10);
      const offset = parseInt(filters.offset, 10);
      if (!isNaN(limit) && !isNaN(offset) && limit > 0 && offset >= 0) {
        // Insertar directamente en SQL para evitar problemas con parámetros preparados en LIMIT/OFFSET
        query += ` LIMIT ${limit} OFFSET ${offset}`;
      }
    }

    const [rows] = await pool.execute(query, params);
    
    // Filtrar por stock mínimo/máximo después de obtener resultados
    let filteredRows = rows;
    if (filters.min_stock !== undefined && filters.min_stock !== '') {
      filteredRows = filteredRows.filter(p => (p.total_stock || 0) >= parseInt(filters.min_stock));
    }
    if (filters.max_stock !== undefined && filters.max_stock !== '') {
      filteredRows = filteredRows.filter(p => (p.total_stock || 0) <= parseInt(filters.max_stock));
    }
    
    return filteredRows;
  } catch (error) {
    console.error('✗ Error en getAllProducts:', error);
    console.error('Stack:', error.stack);
    throw error;
  }
}

/**
 * Obtener productos con paginación (retorna productos y total)
 * Agrupa por RFID y suma stocks
 */
async function getAllProductsPaginated(filters = {}) {
  try {
    // Normalizar RFID en filtros si existe
    if (filters.rfid_uid) {
      filters.rfid_uid = normalizeRfidCode(filters.rfid_uid) || filters.rfid_uid;
    }
    if (filters.search) {
      // Intentar normalizar si el search parece ser un RFID
      const normalized = normalizeRfidCode(filters.search);
      if (normalized && normalized.length === 7) {
        filters.search = normalized;
      }
    }

    // Construir consulta para obtener productos agrupados por LOTE (product_id + lot_number + expiry_date)
    // El RFID se normaliza y se muestra como código de fachada para identificar el producto
    // Diferentes lotes = diferentes filas, pero con el mismo código RFID de fachada (normalizado)
    // Usamos COALESCE para obtener el RFID principal del producto o el primer RFID de los lotes
    // ═══════════════════════════════════════════════════════════════════════════
    // QUERY CORREGIDA: Evitar duplicación por múltiples tags RFID
    // Usamos DISTINCT pb.id para asegurar que cada batch se cuente solo una vez
    // ═══════════════════════════════════════════════════════════════════════════
    let baseQuery = `
      SELECT DISTINCT
        p.id as product_id,
        pb.id as batch_id,
        pb.lot_number,
        pb.expiry_date,
        COALESCE(
          p.rfid_uid,
          pb.rfid_uid,
          (SELECT pb2.rfid_uid FROM product_batches pb2 
           WHERE pb2.product_id = p.id AND pb2.rfid_uid IS NOT NULL 
           LIMIT 1)
        ) as rfid_code_raw,
        p.name,
        p.active_ingredient,
        p.concentration,
        p.presentation,
        p.product_type,
        p.description,
        p.category_id,
        pc.name as category_name,
        p.min_stock,
        p.requires_refrigeration,
        p.units_per_package,
        pb.quantity as batch_quantity
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      INNER JOIN product_batches pb ON pb.product_id = p.id
      WHERE pb.quantity > 0
    `;
    
    const params = [];

    if (filters.product_type) {
      baseQuery += ' AND p.product_type = ?';
      params.push(filters.product_type);
    }
    if (filters.category_id) {
      baseQuery += ' AND p.category_id = ?';
      params.push(filters.category_id);
    }
    if (filters.search) {
      baseQuery += ` AND (
        COALESCE(pb.rfid_uid, p.rfid_uid) = ? 
        OR EXISTS (SELECT 1 FROM batch_rfid_tags brt WHERE brt.batch_id = pb.id AND brt.rfid_uid = ?)
        OR p.id = ?
        OR p.name LIKE ?
        OR p.active_ingredient LIKE ?
        OR p.description LIKE ?
        OR p.presentation LIKE ?
        OR pb.lot_number LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      const searchValue = filters.search.trim();
      const searchId = isNaN(searchValue) ? -1 : parseInt(searchValue);
      params.push(searchValue, searchValue, searchId, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (filters.active_ingredient) {
      baseQuery += ' AND p.active_ingredient LIKE ?';
      params.push(`%${filters.active_ingredient}%`);
    }
    if (filters.rfid_uid) {
      baseQuery += ' AND (COALESCE(pb.rfid_uid, p.rfid_uid) = ? OR pb.rfid_uid = ? OR p.rfid_uid = ? OR EXISTS (SELECT 1 FROM batch_rfid_tags brt WHERE brt.batch_id = pb.id AND brt.rfid_uid = ?))';
      params.push(filters.rfid_uid, filters.rfid_uid, filters.rfid_uid, filters.rfid_uid);
    }
    if (filters.requires_refrigeration !== undefined) {
      baseQuery += ' AND p.requires_refrigeration = ?';
      params.push(filters.requires_refrigeration ? 1 : 0);
    }
    if (filters.expiry_status === 'expired') {
      baseQuery += ' AND pb.expiry_date < CURDATE() AND pb.quantity > 0';
    }
    if (filters.expiry_status === 'expiring_soon') {
      baseQuery += ' AND DATEDIFF(pb.expiry_date, CURDATE()) BETWEEN 0 AND 30 AND pb.expiry_date >= CURDATE() AND pb.quantity > 0';
    }
    if (filters.expiry_status === 'valid') {
      baseQuery += ' AND NOT EXISTS (SELECT 1 FROM product_batches pb2 WHERE pb2.product_id = p.id AND pb2.expiry_date < CURDATE() AND pb2.quantity > 0)';
    }

    // Agrupar solo por PRODUCTO (product_id)
    // Sumar el stock total de todos los lotes del mismo producto
    // Mostrar una sola fila por producto con stock total
    // IMPORTANTE: Usar SUM(batch_quantity) para sumar cada batch solo una vez
    baseQuery += ` 
      GROUP BY p.id, pb.id
    `;
    
    // Ahora agrupar por producto y sumar las cantidades
    let groupedBaseQuery = `
      SELECT 
        product_id,
        MAX(rfid_code_raw) as rfid_code_raw,
        MAX(name) as name,
        MAX(active_ingredient) as active_ingredient,
        MAX(concentration) as concentration,
        MAX(presentation) as presentation,
        MAX(product_type) as product_type,
        MAX(description) as description,
        MAX(category_id) as category_id,
        MAX(category_name) as category_name,
        MAX(min_stock) as min_stock,
        MAX(requires_refrigeration) as requires_refrigeration,
        MAX(units_per_package) as units_per_package,
        SUM(batch_quantity) as total_stock
      FROM (${baseQuery}) as distinct_batches
      GROUP BY product_id
    `;

    // Contar total de productos únicos
    const countQuery = `SELECT COUNT(*) as total FROM (${groupedBaseQuery}) as counted_products`;
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0].total;

    // Obtener productos con stock total sumado (todos los lotes del mismo producto)
    // El RFID se normalizará después para mostrar como código IDP
    let groupedQuery = `
      SELECT 
        product_id,
        rfid_code_raw,
        name,
        active_ingredient,
        concentration,
        presentation,
        product_type,
        description,
        category_id,
        category_name,
        min_stock,
        requires_refrigeration,
        units_per_package,
        total_stock
      FROM (${groupedBaseQuery}) as grouped_products
      ORDER BY name ASC
    `;

    // Aplicar paginación
    if (filters.limit !== undefined && filters.offset !== undefined) {
      const limit = parseInt(filters.limit, 10);
      const offset = parseInt(filters.offset, 10);
      if (!isNaN(limit) && !isNaN(offset) && limit > 0 && offset >= 0) {
        groupedQuery += ` LIMIT ${limit} OFFSET ${offset}`;
      }
    }

    const [rows] = await pool.execute(groupedQuery, params);

    // Normalizar RFID codes y formatear concentraciones
    // El RFID se normaliza para mostrar como código de fachada (identifica el producto)
    // Diferentes lotes del mismo producto tendrán el mismo código RFID normalizado
    const products = rows.map(row => {
      const rfidCodeRaw = row.rfid_code_raw && row.rfid_code_raw.trim() !== '' ? row.rfid_code_raw : null;
      const normalizedRfid = rfidCodeRaw ? normalizeRfidCode(rfidCodeRaw) || rfidCodeRaw : null;
      
      return {
        ...row,
        rfid_code: normalizedRfid,
        rfid_uid: normalizedRfid,
        concentration: row.concentration ? formatConcentration(row.concentration, row.product_type) : row.concentration,
        total_stock: parseInt(row.total_stock) || 0,
        units_per_package: parseInt(row.units_per_package) || 1
      };
    });

    // Filtrar por stock mínimo/máximo después de obtener resultados
    let filteredProducts = products;
    if (filters.min_stock !== undefined && filters.min_stock !== '') {
      filteredProducts = filteredProducts.filter(p => (p.total_stock || 0) >= parseInt(filters.min_stock));
    }
    if (filters.max_stock !== undefined && filters.max_stock !== '') {
      filteredProducts = filteredProducts.filter(p => (p.total_stock || 0) <= parseInt(filters.max_stock));
    }
    if (filters.low_stock) {
      filteredProducts = filteredProducts.filter(p => (p.total_stock || 0) <= (p.min_stock || 0));
    }

    return { products: filteredProducts, total };
  } catch (error) {
    console.error('✗ Error en getAllProductsPaginated:', error);
    console.error('Stack:', error.stack);
    throw error;
  }
}

/**
 * Obtener un producto por ID
 */
async function getProductById(id) {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, pc.name as category_name,
              (SELECT SUM(pb.quantity) FROM product_batches pb WHERE pb.product_id = p.id) as total_stock
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE p.id = ?`,
      [id]
    );
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener un producto por UID RFID (busca en productos y lotes)
 */
async function getProductByRfidUid(rfidUid) {
  try {
    // Primero buscar en lotes (tiene prioridad)
    const [batchRows] = await pool.execute(
      `SELECT pb.*, p.*, pc.name as category_name
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE pb.rfid_uid = ?`,
      [rfidUid]
    );

    if (batchRows.length > 0) {
      return { ...batchRows[0], is_batch: true };
    }

    // Si no está en lotes, buscar en productos
    const [productRows] = await pool.execute(
      `SELECT p.*, pc.name as category_name
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE p.rfid_uid = ?`,
      [rfidUid]
    );

    if (productRows.length > 0) {
      return { ...productRows[0], is_batch: false };
    }

    return null;
  } catch (error) {
    throw error;
  }
}

/**
 * Crear un nuevo producto médico
 */
async function createProduct(productData) {
  try {
    const {
      name, description, product_type, active_ingredient, concentration,
      presentation, administration_route, category_id, min_stock,
      requires_refrigeration, rfid_uid, units_per_package
    } = productData;

    const [result] = await pool.execute(
      `INSERT INTO products 
       (name, description, product_type, active_ingredient, concentration,
        presentation, administration_route, category_id, min_stock,
        requires_refrigeration, rfid_uid, units_per_package)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, description || null, product_type || 'medicamento',
        active_ingredient || null, concentration || null,
        presentation || null, administration_route || null,
        category_id || null, min_stock || 5,
        requires_refrigeration || false, rfid_uid || null,
        units_per_package || 1
      ]
    );
    return await getProductById(result.insertId);
  } catch (error) {
    throw error;
  }
}

/**
 * Actualizar un producto
 */
async function updateProduct(id, productData) {
  try {
    const updates = [];
    const values = [];

    const fields = [
      'name', 'description', 'product_type', 'active_ingredient',
      'concentration', 'presentation', 'administration_route',
      'category_id', 'min_stock', 'requires_refrigeration', 'rfid_uid', 'units_per_package'
    ];

    fields.forEach(field => {
      if (productData[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(productData[field]);
      }
    });

    if (updates.length === 0) {
      return await getProductById(id);
    }

    values.push(id);
    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = ?`;
    await pool.execute(query, values);
    return await getProductById(id);
  } catch (error) {
    throw error;
  }
}

/**
 * Eliminar un producto
 */
async function deleteProduct(id) {
  try {
    const [result] = await pool.execute(
      'DELETE FROM products WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE LOTES ====================

/**
 * Obtener todos los lotes de un producto
 */
async function getProductBatches(productId) {
  try {
    const [rows] = await pool.execute(
      `SELECT pb.*, p.name as product_name,
              (pb.expiry_date < CURDATE()) as is_expired,
              DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       WHERE pb.product_id = ?
       ORDER BY pb.expiry_date ASC, pb.entry_date ASC`,
      [productId]
    );
    
    // Obtener todos los RFID físicos para cada lote
    for (const row of rows) {
      const [rfidTags] = await pool.execute(
        'SELECT rfid_uid FROM batch_rfid_tags WHERE batch_id = ? ORDER BY created_at ASC',
        [row.id]
      );
      row.rfid_tags = rfidTags.map(tag => tag.rfid_uid);
    }
    
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener lote por ID
 */
async function getBatchById(batchId, connection = null) {
  try {
    // Usar la conexión proporcionada o el pool general
    const db = connection || pool;
    
    const [rows] = await db.execute(
      `SELECT pb.*, p.name as product_name, p.min_stock,
              (pb.expiry_date < CURDATE()) as is_expired,
              DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       WHERE pb.id = ?`,
      [batchId]
    );
    
    if (rows.length === 0) return null;
    
    const batch = rows[0];
    
    // Obtener todos los RFID físicos para este lote
    const [rfidTags] = await db.execute(
      'SELECT rfid_uid FROM batch_rfid_tags WHERE batch_id = ? ORDER BY created_at ASC',
      [batchId]
    );
    batch.rfid_tags = rfidTags.map(tag => tag.rfid_uid);
    
    return batch;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener lote por RFID UID
 */
async function getBatchByRfidUid(rfidUid, connection = null) {
  try {
    // Usar la conexión proporcionada o el pool general
    const db = connection || pool;
    
    // Normalizar el RFID antes de buscar
    const normalizedRfid = normalizeRfidCode(rfidUid) || rfidUid.toUpperCase().trim();
    
    const [rows] = await db.execute(
      `SELECT DISTINCT pb.*, p.*, pc.name as category_name,
              p.name as product_name,  -- Asegurar campo product_name
              (pb.expiry_date < CURDATE()) as is_expired,
              DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       LEFT JOIN batch_rfid_tags brt ON pb.id = brt.batch_id
       WHERE pb.rfid_uid = ? 
          OR pb.rfid_uid = ?
          OR brt.rfid_uid = ?
          OR brt.rfid_uid = ?
       LIMIT 1`,
      [normalizedRfid, rfidUid, normalizedRfid, rfidUid]
    );
    
    if (!rows[0]) {
      return null;
    }
    
    // Asegurar que todos los campos esperados estén presentes
    const batch = rows[0];
    return {
      ...batch,
      product_name: batch.product_name || batch.name || 'Producto desconocido',
      name: batch.name || batch.product_name || 'Producto desconocido'
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener TODOS los lotes con el mismo código RFID
 * Puede haber múltiples productos con el mismo RFID
 */
async function getBatchesByRfidUid(rfidUid) {
  try {
    // Normalizar el RFID antes de buscar
    const normalizedRfid = normalizeRfidCode(rfidUid);
    if (!normalizedRfid) {
      return [];
    }

    const [rows] = await pool.execute(
      `SELECT DISTINCT pb.*, 
              p.id as product_id,
              p.name as product_name,
              p.name as name,  -- Asegurar campo 'name' para compatibilidad
              p.active_ingredient,
              p.concentration,
              p.presentation,
              p.product_type,
              p.units_per_package,
              pc.name as category_name,
              (pb.expiry_date < CURDATE()) as is_expired,
              DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry,
              CASE 
                WHEN pb.expiry_date < CURDATE() THEN 'vencido'
                WHEN DATEDIFF(pb.expiry_date, CURDATE()) <= 30 THEN 'proximo_vencer'
                ELSE 'valido'
              END as estado
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       LEFT JOIN batch_rfid_tags brt ON pb.id = brt.batch_id
       WHERE pb.rfid_uid = ? 
          OR pb.rfid_uid = ?
          OR brt.rfid_uid = ?
          OR brt.rfid_uid = ?
       ORDER BY pb.expiry_date ASC, p.name ASC`,
      [normalizedRfid, rfidUid, normalizedRfid, rfidUid] // Buscar en ambas tablas
    );
    
    // Asegurar que todos los campos esperados estén presentes
    return rows.map(row => ({
      ...row,
      product_name: row.product_name || row.name || 'Producto desconocido',
      name: row.name || row.product_name || 'Producto desconocido'
    }));
  } catch (error) {
    console.error('✗ Error en getBatchesByRfidUid:', error);
    throw error;
  }
}

/**
 * Verificar si un RFID tiene stock activo (quantity > 0) en algún lote
 * @param {string} rfidUid - UID del RFID a verificar
 * @returns {Promise<boolean>} - true si tiene stock activo, false si no
 */
async function checkRfidHasActiveStock(rfidUid) {
  try {
    const batches = await getBatchesByRfidUid(rfidUid);
    return batches.some(batch => batch.quantity > 0);
  } catch (error) {
    console.error('✗ Error al verificar stock activo de RFID:', error);
    // En caso de error, retornar false para permitir la operación (evitar bloqueos)
    return false;
  }
}

/**
 * Crear un nuevo lote o actualizar uno existente
 * Si ya existe un lote con el mismo product_id, lot_number y expiry_date,
 * se actualiza la cantidad sumando la nueva cantidad
 * Valida que el RFID no esté duplicado y que no tenga stock activo
 */
async function createBatch(batchData) {
  try {
    const { product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date } = batchData;
    
    // Validar cantidad usando helper
    const validatedQuantity = validateQuantity(quantity, 'cantidad');

    // Buscar si ya existe un lote con el mismo product_id, lot_number y expiry_date
    const [existingBatches] = await pool.execute(
      `SELECT id, quantity, rfid_uid FROM product_batches 
       WHERE product_id = ? AND lot_number = ? AND expiry_date = ?`,
      [product_id, lot_number, expiry_date]
    );
    
    // Validar que el RFID no esté duplicado y que no tenga stock activo (si se proporciona)
    if (rfid_uid) {
      const normalizedRfid = normalizeRfidCode(rfid_uid) || rfid_uid.toUpperCase().trim();
      
      // PRIMERO: Verificar si el RFID tiene stock activo (quantity > 0)
      const hasActiveStock = await checkRfidHasActiveStock(normalizedRfid);
      
      if (hasActiveStock) {
        // Obtener información del lote con stock activo para el mensaje de error
        const batchesWithStock = await getBatchesByRfidUid(normalizedRfid);
        const activeBatch = batchesWithStock.find(b => b.quantity > 0);
        
        if (activeBatch) {
          const error = new Error(
            `Este código RFID ya tiene stock activo en el sistema (${activeBatch.quantity} unidades del producto "${activeBatch.product_name || 'N/A'}"). ` +
            `Solo se puede ingresar nuevamente cuando el stock llegue a 0.`
          );
          error.code = 'RFID_HAS_ACTIVE_STOCK';
          error.batch_info = {
            product_name: activeBatch.product_name,
            quantity: activeBatch.quantity,
            lot_number: activeBatch.lot_number,
            expiry_date: activeBatch.expiry_date
          };
          throw error;
        }
      }
      
      // SEGUNDO: Verificar si el RFID ya está registrado en product_batches o batch_rfid_tags
      // Buscar en ambas tablas para asegurar validación completa
      const [existingRfidInBatches] = await pool.execute(
        `SELECT pb.id, pb.product_id, pb.lot_number, pb.expiry_date, pb.quantity, p.name as product_name 
         FROM product_batches pb 
         LEFT JOIN products p ON pb.product_id = p.id 
         WHERE pb.rfid_uid = ? 
         LIMIT 1`,
        [normalizedRfid]
      );
      
      const [existingRfidTags] = await pool.execute(
        `SELECT brt.batch_id, pb.product_id, pb.lot_number, pb.expiry_date, pb.quantity, p.name as product_name 
         FROM batch_rfid_tags brt
         JOIN product_batches pb ON brt.batch_id = pb.id
           LEFT JOIN products p ON pb.product_id = p.id 
         WHERE brt.rfid_uid = ? 
         LIMIT 1`,
        [normalizedRfid]
      );
      
      // Combinar resultados de ambas búsquedas
      const existingRfidInfo = existingRfidInBatches.length > 0 ? existingRfidInBatches[0] : 
                               (existingRfidTags.length > 0 ? existingRfidTags[0] : null);
      
      if (existingRfidInfo) {
        const existingBatchId = existingRfidInfo.id || existingRfidInfo.batch_id;
        const existingProductName = existingRfidInfo.product_name || 'Producto desconocido';
        const existingProductId = existingRfidInfo.product_id;
        
        // Si estamos actualizando un lote existente, verificar que el RFID no pertenezca a otro lote
        if (existingBatches.length > 0) {
          // Si el RFID pertenece a un lote diferente, es error
          if (existingBatchId !== existingBatches[0].id) {
            const error = new Error(
              `⚠️ IDP DUPLICADO: Este código RFID ya está registrado en otro lote del producto "${existingProductName}" (ID: ${existingProductId}). ` +
              `No puedes usar el mismo IDP para otro producto.`
            );
            error.code = 'RFID_DUPLICATE';
            error.batch_info = {
              product_id: existingProductId,
              product_name: existingProductName,
              lot_number: existingRfidInfo.lot_number,
              expiry_date: existingRfidInfo.expiry_date,
              quantity: existingRfidInfo.quantity
            };
            throw error;
          }
          // Si pertenece al mismo lote, está bien (permitir múltiples RFID del mismo lote)
        } else {
          // Si estamos creando un nuevo lote, verificar que el RFID no pertenezca a ningún otro lote
            // Verificar si es de un producto diferente
          if (existingProductId !== product_id) {
              const error = new Error(
              `⚠️ IDP DUPLICADO: Este código RFID ya está registrado con el producto "${existingProductName}" (ID: ${existingProductId}). ` +
                `No puedes usar el mismo IDP para otro producto.`
              );
              error.code = 'RFID_DUPLICATE';
              error.batch_info = {
              product_id: existingProductId,
                product_name: existingProductName,
              lot_number: existingRfidInfo.lot_number,
              expiry_date: existingRfidInfo.expiry_date,
              quantity: existingRfidInfo.quantity
              };
              throw error;
            }
            
          // Si es del mismo producto, verificar si es de un lote diferente
            // Solo es error si es de un lote diferente (mismo producto pero diferente lote o fecha)
          if (existingRfidInfo.lot_number !== lot_number || 
              new Date(existingRfidInfo.expiry_date).getTime() !== new Date(expiry_date).getTime()) {
              const error = new Error(
                `Este código RFID ya está registrado en otro lote del mismo producto "${existingProductName}" ` +
              `(Lote: ${existingRfidInfo.lot_number}, Vence: ${existingRfidInfo.expiry_date}).`
              );
              error.code = 'RFID_DUPLICATE';
              error.batch_info = {
              product_id: existingProductId,
                product_name: existingProductName,
              lot_number: existingRfidInfo.lot_number,
              expiry_date: existingRfidInfo.expiry_date,
              quantity: existingRfidInfo.quantity
              };
              throw error;
          }
        }
      }
    }

    if (existingBatches.length > 0) {
      // Lote existente encontrado, verificar que no tenga stock activo si se está agregando un RFID nuevo
      const existingBatch = existingBatches[0];
      
      // Si se está agregando un RFID nuevo a un lote existente, verificar que el RFID no tenga stock activo
      if (rfid_uid && !existingBatch.rfid_uid) {
        const normalizedRfid = normalizeRfidCode(rfid_uid) || rfid_uid.toUpperCase().trim();
        const hasActiveStock = await checkRfidHasActiveStock(normalizedRfid);
        
        if (hasActiveStock) {
          const batchesWithStock = await getBatchesByRfidUid(normalizedRfid);
          const activeBatch = batchesWithStock.find(b => b.quantity > 0);
          
          if (activeBatch) {
            const error = new Error(
              `Este código RFID ya tiene stock activo en el sistema (${activeBatch.quantity} unidades del producto "${activeBatch.product_name || 'N/A'}"). ` +
              `Solo se puede ingresar nuevamente cuando el stock llegue a 0.`
            );
            error.code = 'RFID_HAS_ACTIVE_STOCK';
            error.batch_info = {
              product_name: activeBatch.product_name,
              quantity: activeBatch.quantity,
              lot_number: activeBatch.lot_number,
              expiry_date: activeBatch.expiry_date
            };
            throw error;
          }
        }
      }
      
      // Actualizar cantidad sumando la nueva (usar cantidad validada)
      const newQuantity = (existingBatch.quantity || 0) + validatedQuantity;
      
      // Validar que la cantidad no sea negativa
      if (newQuantity < 0) {
        throw new Error(`La cantidad resultante no puede ser negativa. Stock actual: ${existingBatch.quantity}, Intento de agregar: ${validatedQuantity}`);
      }
      
      await pool.execute(
        'UPDATE product_batches SET quantity = ? WHERE id = ?',
        [newQuantity, existingBatch.id]
      );
      
      // Guardar el RFID en batch_rfid_tags (permite múltiples RFID por lote)
      if (rfid_uid) {
        const normalizedRfid = normalizeRfidCode(rfid_uid) || rfid_uid.toUpperCase().trim();
        
        // Si el lote no tiene RFID principal, asignarlo
        if (!existingBatch.rfid_uid) {
          await pool.execute(
            'UPDATE product_batches SET rfid_uid = ? WHERE id = ?',
            [normalizedRfid, existingBatch.id]
          );
        }
        
        // Guardar el RFID en batch_rfid_tags (permite múltiples RFID)
        await pool.execute(
          'INSERT IGNORE INTO batch_rfid_tags (batch_id, rfid_uid) VALUES (?, ?)',
          [existingBatch.id, normalizedRfid]
        );
      }
      
      return await getBatchById(existingBatch.id);
    } else {
      // No existe, crear nuevo lote
      const normalizedRfid = rfid_uid ? (normalizeRfidCode(rfid_uid) || rfid_uid.toUpperCase().trim()) : null;
      const [result] = await pool.execute(
        `INSERT INTO product_batches 
         (product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [product_id, lot_number, expiry_date, validatedQuantity, normalizedRfid, entry_date || new Date()]
      );
      
      const batchId = result.insertId;
      
      // Guardar el RFID en batch_rfid_tags (permite múltiples RFID por lote)
      if (normalizedRfid) {
        await pool.execute(
          'INSERT IGNORE INTO batch_rfid_tags (batch_id, rfid_uid) VALUES (?, ?)',
          [batchId, normalizedRfid]
        );
      }
      
      return await getBatchById(batchId);
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Actualizar cantidad de un lote
 */
async function updateBatchQuantity(batchId, newQuantity) {
  try {
    // Validar que el batch existe
    const batch = await getBatchById(batchId);
    if (!batch) {
      const error = new Error('Lote no encontrado');
      error.code = 'BATCH_NOT_FOUND';
      throw error;
    }

    // Validar que la cantidad no sea negativa (permitir 0)
    if (newQuantity < 0) {
      throw new Error('La cantidad no puede ser negativa. El valor mínimo permitido es 0.');
    }

    await pool.execute(
      'UPDATE product_batches SET quantity = ? WHERE id = ?',
      [newQuantity, batchId]
    );
    return await getBatchById(batchId);
  } catch (error) {
    throw error;
  }
}

/**
 * Eliminar un lote (solo para administradores)
 */
async function deleteBatch(batchId) {
  try {
    // Verificar que el lote existe
    const batch = await getBatchById(batchId);
    if (!batch) {
      const error = new Error('Lote no encontrado');
      error.code = 'BATCH_NOT_FOUND';
      throw error;
    }

    // Eliminar el lote
    await pool.execute(
      'DELETE FROM product_batches WHERE id = ?',
      [batchId]
    );

    return { success: true, message: 'Lote eliminado correctamente' };
  } catch (error) {
    throw error;
  }
}

/**
 * Decrementar stock de un lote (cuando se retira)
 * @param {string} rfidUid - UID del RFID
 * @param {number} quantity - Cantidad a retirar (default: 1)
 * @param {number} areaId - ID del área (opcional)
 * @param {Object} connection - Conexión de transacción opcional (para usar dentro de transacciones)
 * @returns {Promise<Object>} - Lote actualizado
 */
async function decrementBatchStock(rfidUid, quantity = 1, areaId = null, connection = null) {
  try {
    // Usar la conexión proporcionada o el pool general
    const db = connection || pool;
    
    // ═══════════════════════════════════════════════════════════════════════════
    // LOG: Iniciando descuento de stock
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`🔍 [DECREMENT STOCK] Iniciando descuento. RFID: ${rfidUid}, Cantidad: ${quantity}, Usando transacción: ${connection ? 'SÍ' : 'NO'}`);
    
    // Pasar la conexión de transacción a getBatchByRfidUid para consistencia
    const batch = await getBatchByRfidUid(rfidUid, connection);

    if (!batch) {
      console.error(`❌ [DECREMENT STOCK] Lote no encontrado para RFID: ${rfidUid}`);
      throw new Error('Lote no encontrado para el UID RFID proporcionado');
    }
    
    console.log(`✅ [DECREMENT STOCK] Batch encontrado. ID: ${batch.id}, Product ID: ${batch.product_id}, Stock actual: ${batch.quantity}`);

    if (batch.is_expired) {
      console.error(`❌ [DECREMENT STOCK] Intento de retirar producto vencido. Batch ID: ${batch.id}`);
      throw new Error('No se puede retirar un producto vencido');
    }

    // Validar cantidad usando helper
    const validatedQuantity = validateQuantity(quantity, 'cantidad a retirar');

    // Si el lote tiene suficiente stock, descontar solo de ese lote
    // 🔒 BLOQUEAR la fila para prevenir race conditions
    const [lockedBatchRows] = await db.execute(
      'SELECT * FROM product_batches WHERE id = ? FOR UPDATE',
      [batch.id]
    );
    
    if (lockedBatchRows.length === 0) {
      throw new Error('Lote no encontrado o fue eliminado durante la transacción');
    }
    
    const lockedBatch = lockedBatchRows[0];
    
    // Validar stock nuevamente después del lock (puede haber cambiado)
    // Si tiene suficiente stock, descontar solo de este lote
    if (lockedBatch.quantity >= validatedQuantity) {
      const previousQuantity = lockedBatch.quantity;
      const newQuantity = previousQuantity - validatedQuantity;

      // Validar que no sea negativo (doble verificación)
      if (newQuantity < 0) {
        throw new Error(`Error: La cantidad resultante sería negativa. Stock actual: ${previousQuantity}, Requerido: ${validatedQuantity}`);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // LOGS PARA DEBUGGING - Descuento de stock
      // ═══════════════════════════════════════════════════════════════════════════
      console.log(`📉 [DECREMENT STOCK] Preparando UPDATE. Batch ID: ${batch.id}, RFID: ${rfidUid}`);
      console.log(`   Stock anterior: ${previousQuantity}, Cantidad a descontar: ${validatedQuantity}, Stock nuevo esperado: ${newQuantity}`);
      console.log(`   Usando conexión de transacción: ${connection ? 'SÍ' : 'NO'}`);

      // Actualizar cantidad del lote
      const [updateResult] = await db.execute(
        'UPDATE product_batches SET quantity = ? WHERE id = ?',
        [newQuantity, batch.id]
      );
      
      console.log(`✅ [DECREMENT STOCK] UPDATE ejecutado. Batch ID: ${batch.id}`);
      console.log(`   Resultado del UPDATE:`, {
        affectedRows: updateResult.affectedRows,
        changedRows: updateResult.changedRows || 0,
        insertId: updateResult.insertId || null
      });
      
      if (updateResult.affectedRows === 0) {
        console.error(`⚠️ [DECREMENT STOCK] ADVERTENCIA: UPDATE no afectó ninguna fila. Batch ID: ${batch.id}`);
      }
      
      // Verificar que el UPDATE realmente se ejecutó
      const [verifyRows] = await db.execute(
        'SELECT quantity FROM product_batches WHERE id = ?',
        [batch.id]
      );
      if (verifyRows.length > 0) {
        const actualQuantity = verifyRows[0].quantity;
        console.log(`   ✅ Verificación: Stock actual en BD: ${actualQuantity}`);
        if (actualQuantity !== newQuantity) {
          console.error(`   ⚠️ DISCREPANCIA: Stock esperado ${newQuantity} pero BD tiene ${actualQuantity}`);
        }
      }
      
      // Calcular stock total del producto después del descuento
      const [stockRows] = await db.execute(
        'SELECT COALESCE(SUM(quantity), 0) as total_stock FROM product_batches WHERE product_id = ?',
        [lockedBatch.product_id]
      );
      const totalProductStock = stockRows[0]?.total_stock || 0;
      console.log(`📊 [DECREMENT STOCK] Stock total del producto (ID: ${lockedBatch.product_id}): ${totalProductStock}`);

      // Registrar en historial
      await db.execute(
        `INSERT INTO stock_history 
         (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date, notes)
         VALUES (?, ?, ?, ?, ?, 'remove', CURDATE(), ?)`,
        [lockedBatch.product_id, batch.id, areaId, previousQuantity, newQuantity, `Retiro de ${validatedQuantity} unidades`]
      );

      const updatedBatch = await getBatchById(batch.id, connection);
      return {
        ...updatedBatch,
        fifo_warning: null
      };
    }

    // Si el lote NO tiene suficiente stock, buscar en otros lotes del mismo producto
    // 🔒 BLOQUEAR todos los lotes del producto para prevenir race conditions
    const [allBatches] = await db.execute(
      `SELECT pb.*, 
              (pb.expiry_date < CURDATE()) as is_expired,
              DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
       FROM product_batches pb
       WHERE pb.product_id = ?
         AND pb.quantity > 0
         AND (? = 1 OR pb.expiry_date >= CURDATE())
       ORDER BY 
         CASE WHEN ? = 1 THEN 0 ELSE 1 END,
         pb.expiry_date ASC,
         pb.entry_date ASC
       FOR UPDATE`,
      [batch.product_id, batch.is_expired ? 1 : 0, batch.is_expired ? 1 : 0]
    );

    // Calcular stock total disponible
    const totalAvailableStock = allBatches.reduce((sum, b) => sum + b.quantity, 0);
    
    if (totalAvailableStock < validatedQuantity) {
      throw new Error(`Stock insuficiente en todos los lotes. Disponible total: ${totalAvailableStock} unidades, Requerido: ${validatedQuantity} unidades`);
    }

    // Priorizar el lote especificado, luego agregar otros en orden FIFO
    let batchesToUse = [];
    const preferredBatch = allBatches.find(b => b.id === batch.id);
    if (preferredBatch && preferredBatch.quantity > 0) {
      batchesToUse.push(preferredBatch);
    }
    
    // Agregar otros lotes en orden FIFO
    const remainingBatches = allBatches.filter(b => b.id !== batch.id);
    batchesToUse = [...batchesToUse, ...remainingBatches];

    let remainingQuantity = validatedQuantity;
    const updatedBatches = [];

    // ═══════════════════════════════════════════════════════════════════════════
    // LOGS PARA DEBUGGING - Descuento de múltiples lotes
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`📉 [DECREMENT STOCK MULTI-BATCH] Product ID: ${batch.product_id}, Cantidad requerida: ${validatedQuantity}`);
    console.log(`   Stock total disponible: ${totalAvailableStock}, Lotes a usar: ${batchesToUse.length}`);

    // Descontar de múltiples lotes si es necesario
    // Los lotes ya están bloqueados con FOR UPDATE, así que son seguros
    for (const batchToUse of batchesToUse) {
      if (remainingQuantity <= 0) break;

      // Re-validar cantidad actual del lote (puede haber cambiado por otro proceso antes del lock)
      const quantityFromBatch = Math.min(remainingQuantity, batchToUse.quantity);
      
      if (quantityFromBatch <= 0) {
        continue; // Saltar este lote si ya no tiene stock
      }
      
      const previousQuantity = batchToUse.quantity;
      const newQuantity = previousQuantity - quantityFromBatch;

      // Validar que no sea negativo
      if (newQuantity < 0) {
        throw new Error(`Error: La cantidad resultante sería negativa para el lote ${batchToUse.lot_number}. Stock actual: ${previousQuantity}, Intento de descontar: ${quantityFromBatch}`);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // LOGS PARA DEBUGGING - Actualización de cada lote
      // ═══════════════════════════════════════════════════════════════════════════
      console.log(`   📦 Lote ID: ${batchToUse.id}, Stock anterior: ${previousQuantity}, Descontar: ${quantityFromBatch}, Stock nuevo: ${newQuantity}`);

      // Actualizar el lote (ya está bloqueado, así que es seguro)
      await db.execute(
        'UPDATE product_batches SET quantity = ? WHERE id = ?',
        [newQuantity, batchToUse.id]
      );

      // Registrar en historial
      await db.execute(
        `INSERT INTO stock_history 
         (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date, notes)
         VALUES (?, ?, ?, ?, ?, 'remove', CURDATE(), ?)`,
        [
          batchToUse.product_id,
          batchToUse.id,
          areaId,
          previousQuantity,
          newQuantity,
          `Retiro de ${quantityFromBatch} unidades${batchToUse.id === batch.id ? ' (lote especificado)' : ' (FIFO - lote alternativo)'}`
        ]
      );

      updatedBatches.push({
        batch_id: batchToUse.id,
        lot_number: batchToUse.lot_number,
        quantity_deducted: quantityFromBatch,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity
      });

      remainingQuantity -= quantityFromBatch;
    }

    if (remainingQuantity > 0) {
      throw new Error(`Error: No se pudo descontar toda la cantidad. Quedan ${remainingQuantity} unidades sin descontar`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LOG FINAL - Descuento completado
    // ═══════════════════════════════════════════════════════════════════════════
    const [finalStockRows] = await db.execute(
      'SELECT COALESCE(SUM(quantity), 0) as total_stock FROM product_batches WHERE product_id = ?',
      [batch.product_id]
    );
    const finalTotalStock = finalStockRows[0]?.total_stock || 0;
    console.log(`✅ [DECREMENT STOCK MULTI-BATCH] Descuento completado. Stock total final del producto (ID: ${batch.product_id}): ${finalTotalStock}`);
    console.log(`   Lotes afectados: ${updatedBatches.length}`);

    // Retornar el lote original actualizado
    const updatedBatch = await getBatchById(batch.id, connection);
    return {
      ...updatedBatch,
      fifo_warning: updatedBatches.length > 1 ? `Descuento realizado desde ${updatedBatches.length} lote(s)` : null,
      batches_used: updatedBatches
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Decrementar stock de un lote por su ID directamente
 * Esta función asegura que se descontar del batch correcto usando su ID
 * @param {number} batchId - ID del batch a descontar
 * @param {number} quantity - Cantidad a retirar (default: 1)
 * @param {number} areaId - ID del área (opcional)
 * @param {object} connection - Conexión de transacción (opcional)
 * @returns {Promise<Object>} - Batch actualizado
 */
async function decrementBatchStockById(batchId, quantity = 1, areaId = null, connection = null) {
  try {
    // Usar la conexión proporcionada o el pool general
    const db = connection || pool;
    
    // ═══════════════════════════════════════════════════════════════════════════
    // LOG: Iniciando descuento de stock por ID
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`🔍 [DECREMENT STOCK BY ID] Iniciando descuento. Batch ID: ${batchId}, Cantidad: ${quantity}, Usando transacción: ${connection ? 'SÍ' : 'NO'}`);
    
    // Obtener el batch por ID directamente
    const batch = await getBatchById(batchId, connection);

    if (!batch) {
      console.error(`❌ [DECREMENT STOCK BY ID] Lote no encontrado para Batch ID: ${batchId}`);
      throw new Error('Lote no encontrado para el ID proporcionado');
    }
    
    console.log(`✅ [DECREMENT STOCK BY ID] Batch encontrado. ID: ${batch.id}, Product ID: ${batch.product_id}, Stock actual: ${batch.quantity}`);

    if (batch.is_expired) {
      console.error(`❌ [DECREMENT STOCK BY ID] Intento de retirar producto vencido. Batch ID: ${batch.id}`);
      throw new Error('No se puede retirar un producto vencido');
    }

    // Validar cantidad usando helper
    const validatedQuantity = validateQuantity(quantity, 'cantidad a retirar');

    // 🔒 BLOQUEAR la fila para prevenir race conditions
    const [lockedBatchRows] = await db.execute(
      'SELECT * FROM product_batches WHERE id = ? FOR UPDATE',
      [batchId]
    );
    
    if (lockedBatchRows.length === 0) {
      throw new Error('Lote no encontrado o fue eliminado durante la transacción');
    }
    
    const lockedBatch = lockedBatchRows[0];
    
    // Validar que el batch bloqueado corresponda al producto correcto
    if (lockedBatch.product_id !== batch.product_id) {
      throw new Error(`Error: El batch bloqueado (product_id: ${lockedBatch.product_id}) no coincide con el batch esperado (product_id: ${batch.product_id})`);
    }
    
    // Validar stock nuevamente después del lock (puede haber cambiado)
    // Si tiene suficiente stock, descontar solo de este lote
    if (lockedBatch.quantity >= validatedQuantity) {
      const previousQuantity = lockedBatch.quantity;
      const newQuantity = previousQuantity - validatedQuantity;

      // Validar que no sea negativo (doble verificación)
      if (newQuantity < 0) {
        throw new Error(`Error: La cantidad resultante sería negativa. Stock actual: ${previousQuantity}, Requerido: ${validatedQuantity}`);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // LOGS PARA DEBUGGING - Descuento de stock
      // ═══════════════════════════════════════════════════════════════════════════
      console.log(`📉 [DECREMENT STOCK BY ID] Preparando UPDATE. Batch ID: ${batchId}`);
      console.log(`   Stock anterior: ${previousQuantity}, Cantidad a descontar: ${validatedQuantity}, Stock nuevo esperado: ${newQuantity}`);
      console.log(`   Product ID: ${lockedBatch.product_id}`);

      // Actualizar cantidad del lote
      const [updateResult] = await db.execute(
        'UPDATE product_batches SET quantity = ? WHERE id = ?',
        [newQuantity, batchId]
      );
      
      console.log(`✅ [DECREMENT STOCK BY ID] UPDATE ejecutado. Batch ID: ${batchId}`);
      
      if (updateResult.affectedRows === 0) {
        console.error(`⚠️ [DECREMENT STOCK BY ID] ADVERTENCIA: UPDATE no afectó ninguna fila. Batch ID: ${batchId}`);
        throw new Error(`Error al actualizar el stock del lote. El lote puede haber sido eliminado.`);
      }
      
      // Calcular stock total del producto después del descuento
      const [stockRows] = await db.execute(
        'SELECT COALESCE(SUM(quantity), 0) as total_stock FROM product_batches WHERE product_id = ?',
        [lockedBatch.product_id]
      );
      const totalProductStock = stockRows[0]?.total_stock || 0;
      console.log(`📊 [DECREMENT STOCK BY ID] Stock total del producto (ID: ${lockedBatch.product_id}): ${totalProductStock}`);

      // Registrar en historial
      await db.execute(
        `INSERT INTO stock_history 
         (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date, notes)
         VALUES (?, ?, ?, ?, ?, 'remove', CURDATE(), ?)`,
        [lockedBatch.product_id, batchId, areaId, previousQuantity, newQuantity, `Retiro de ${validatedQuantity} unidades`]
      );

      const updatedBatch = await getBatchById(batchId, connection);
      return {
        ...updatedBatch,
        fifo_warning: null
      };
    }

    // Si el lote NO tiene suficiente stock, buscar en otros lotes del mismo producto
    // 🔒 BLOQUEAR todos los lotes del producto para prevenir race conditions
    const [allBatches] = await db.execute(
      `SELECT pb.*, 
              (pb.expiry_date < CURDATE()) as is_expired,
              DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
       FROM product_batches pb
       WHERE pb.product_id = ?
         AND pb.quantity > 0
         AND (? = 1 OR pb.expiry_date >= CURDATE())
       ORDER BY 
         CASE WHEN ? = 1 THEN 0 ELSE 1 END,
         pb.expiry_date ASC,
         pb.entry_date ASC
       FOR UPDATE`,
      [batch.product_id, batch.is_expired ? 1 : 0, batch.is_expired ? 1 : 0]
    );

    // Calcular stock total disponible
    const totalAvailableStock = allBatches.reduce((sum, b) => sum + b.quantity, 0);
    
    if (totalAvailableStock < validatedQuantity) {
      throw new Error(`Stock insuficiente en todos los lotes. Disponible total: ${totalAvailableStock} unidades, Requerido: ${validatedQuantity} unidades`);
    }

    // Priorizar el lote especificado, luego agregar otros en orden FIFO
    let batchesToUse = [];
    const preferredBatch = allBatches.find(b => b.id === batchId);
    if (preferredBatch && preferredBatch.quantity > 0) {
      batchesToUse.push(preferredBatch);
    }
    
    // Agregar otros lotes en orden FIFO (solo del mismo producto)
    const remainingBatches = allBatches.filter(b => b.id !== batchId && b.product_id === batch.product_id);
    batchesToUse = [...batchesToUse, ...remainingBatches];

    let remainingQuantity = validatedQuantity;
    const updatedBatches = [];

    // ═══════════════════════════════════════════════════════════════════════════
    // LOGS PARA DEBUGGING - Descuento de múltiples lotes
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`📉 [DECREMENT STOCK BY ID MULTI-BATCH] Product ID: ${batch.product_id}, Cantidad requerida: ${validatedQuantity}`);
    console.log(`   Stock total disponible: ${totalAvailableStock}, Lotes a usar: ${batchesToUse.length}`);

    // Descontar de múltiples lotes si es necesario
    // Los lotes ya están bloqueados con FOR UPDATE, así que son seguros
    for (const batchToUse of batchesToUse) {
      if (remainingQuantity <= 0) break;

      // Validar que el lote pertenezca al mismo producto
      if (batchToUse.product_id !== batch.product_id) {
        console.warn(`⚠️ [DECREMENT STOCK BY ID] Saltando lote ${batchToUse.id} - pertenece a otro producto (${batchToUse.product_id} vs ${batch.product_id})`);
        continue;
      }

      // Re-validar cantidad actual del lote (puede haber cambiado por otro proceso antes del lock)
      const quantityFromBatch = Math.min(remainingQuantity, batchToUse.quantity);
      
      if (quantityFromBatch <= 0) {
        continue; // Saltar este lote si ya no tiene stock
      }
      
      const previousQuantity = batchToUse.quantity;
      const newQuantity = previousQuantity - quantityFromBatch;

      // Validar que no sea negativo
      if (newQuantity < 0) {
        throw new Error(`Error: La cantidad resultante sería negativa para el lote ${batchToUse.lot_number}. Stock actual: ${previousQuantity}, Intento de descontar: ${quantityFromBatch}`);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // LOGS PARA DEBUGGING - Actualización de cada lote
      // ═══════════════════════════════════════════════════════════════════════════
      console.log(`   📦 Lote ID: ${batchToUse.id}, Product ID: ${batchToUse.product_id}, Stock anterior: ${previousQuantity}, Descontar: ${quantityFromBatch}, Stock nuevo: ${newQuantity}`);

      // Actualizar el lote (ya está bloqueado, así que es seguro)
      await db.execute(
        'UPDATE product_batches SET quantity = ? WHERE id = ?',
        [newQuantity, batchToUse.id]
      );

      // Registrar en historial
      await db.execute(
        `INSERT INTO stock_history 
         (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date, notes)
         VALUES (?, ?, ?, ?, ?, 'remove', CURDATE(), ?)`,
        [
          batchToUse.product_id,
          batchToUse.id,
          areaId,
          previousQuantity,
          newQuantity,
          `Retiro de ${quantityFromBatch} unidades${batchToUse.id === batchId ? ' (lote especificado)' : ' (FIFO - lote alternativo del mismo producto)'}`
        ]
      );

      updatedBatches.push({
        batch_id: batchToUse.id,
        lot_number: batchToUse.lot_number,
        quantity_deducted: quantityFromBatch,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity
      });

      remainingQuantity -= quantityFromBatch;
    }

    if (remainingQuantity > 0) {
      throw new Error(`Error: No se pudo descontar toda la cantidad. Quedan ${remainingQuantity} unidades sin descontar`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LOG FINAL - Descuento completado
    // ═══════════════════════════════════════════════════════════════════════════
    const [finalStockRows] = await db.execute(
      'SELECT COALESCE(SUM(quantity), 0) as total_stock FROM product_batches WHERE product_id = ?',
      [batch.product_id]
    );
    const finalTotalStock = finalStockRows[0]?.total_stock || 0;
    console.log(`✅ [DECREMENT STOCK BY ID MULTI-BATCH] Descuento completado. Stock total final del producto (ID: ${batch.product_id}): ${finalTotalStock}`);
    console.log(`   Lotes afectados: ${updatedBatches.length}`);

    // Retornar el lote original actualizado
    const updatedBatch = await getBatchById(batchId, connection);
    return {
      ...updatedBatch,
      fifo_warning: updatedBatches.length > 1 ? `Descuento realizado desde ${updatedBatches.length} lote(s)` : null,
      batches_used: updatedBatches
    };
  } catch (error) {
    console.error(`❌ [DECREMENT STOCK BY ID] Error:`, error);
    throw error;
  }
}

/**
 * Incrementar stock de un lote (cuando se ingresa)
 * @param {string} rfidUid - UID del RFID
 * @param {number} quantity - Cantidad a ingresar
 * @param {number} areaId - ID del área (opcional)
 * @returns {Promise<Object>} - Lote actualizado
 */
async function incrementBatchStock(rfidUid, quantity, areaId = null) {
  try {
    const batch = await getBatchByRfidUid(rfidUid);

    if (!batch) {
      throw new Error('Lote no encontrado para el UID RFID proporcionado');
    }

    // Validar cantidad usando helper
    const validatedQuantity = validateQuantity(quantity, 'cantidad a ingresar');

    const previousQuantity = batch.quantity;
    const newQuantity = previousQuantity + validatedQuantity;

    // Validar que la cantidad resultante no sea negativa (aunque esto no debería pasar con números positivos)
    if (newQuantity < 0) {
      throw new Error(`Error: La cantidad resultante no puede ser negativa. Stock actual: ${previousQuantity}, Intento de agregar: ${quantity}`);
    }

    // Actualizar cantidad del lote
    await pool.execute(
      'UPDATE product_batches SET quantity = ? WHERE id = ?',
      [newQuantity, batch.id]
    );

    // Registrar en historial
    await pool.execute(
      `INSERT INTO stock_history 
       (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date, notes)
       VALUES (?, ?, ?, ?, ?, 'add', CURDATE(), ?)`,
      [batch.product_id, batch.id, areaId, previousQuantity, newQuantity, `Ingreso de ${validatedQuantity} unidades`]
    );

    const updatedBatch = await getBatchById(batch.id, connection);
    return updatedBatch;
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE CATEGORÍAS ====================

async function getAllCategories() {
  try {
    const [rows] = await pool.execute('SELECT * FROM product_categories ORDER BY name');
    return rows;
  } catch (error) {
    throw error;
  }
}

async function getCategoryById(id) {
  try {
    const [rows] = await pool.execute('SELECT * FROM product_categories WHERE id = ?', [id]);
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

async function createCategory(categoryData) {
  try {
    const { name, description } = categoryData;
    const [result] = await pool.execute(
      'INSERT INTO product_categories (name, description) VALUES (?, ?)',
      [name, description || null]
    );
    return await getCategoryById(result.insertId);
  } catch (error) {
    throw error;
  }
}

async function updateCategory(id, categoryData) {
  try {
    const { name, description } = categoryData;
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    
    if (updates.length === 0) {
      return await getCategoryById(id);
    }
    
    params.push(id);
    await pool.execute(
      `UPDATE product_categories SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return await getCategoryById(id);
  } catch (error) {
    throw error;
  }
}

async function deleteCategory(id) {
  try {
    const [result] = await pool.execute(
      'DELETE FROM product_categories WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE ÁREAS ====================

async function getAllAreas() {
  try {
    const [rows] = await pool.execute('SELECT * FROM areas WHERE is_active = TRUE ORDER BY name');
    return rows;
  } catch (error) {
    throw error;
  }
}

async function getAreaById(id) {
  try {
    const [rows] = await pool.execute('SELECT * FROM areas WHERE id = ?', [id]);
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

async function createArea(areaData) {
  try {
    const { name, description, is_active } = areaData;
    const [result] = await pool.execute(
      'INSERT INTO areas (name, description, is_active) VALUES (?, ?, ?)',
      [name, description || null, is_active !== undefined ? is_active : true]
    );
    return await getAreaById(result.insertId);
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE DOCTORES ====================

/**
 * Obtener todos los doctores con filtros
 */
async function getAllDoctors(filters = {}) {
  try {
    let query = `
      SELECT d.*, a.name as area_name, 
             COALESCE(d.username, u.username) as user_username,
             d.username as username
      FROM doctors d
      LEFT JOIN areas a ON d.area_id = a.id
      LEFT JOIN users u ON d.email = u.email AND u.role = 'medico'
      WHERE 1=1
    `;
    const params = [];

    if (filters.area_id) {
      query += ' AND d.area_id = ?';
      params.push(filters.area_id);
    }
    if (filters.specialty) {
      query += ' AND d.specialty = ?';
      params.push(filters.specialty);
    }
    if (filters.search) {
      query += ' AND (d.name LIKE ? OR d.license_number LIKE ? OR d.specialty LIKE ? OR d.username LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (filters.is_active !== undefined) {
      query += ' AND d.is_active = ?';
      params.push(filters.is_active ? 1 : 0);
    }

    query += ' ORDER BY d.name';

    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener un doctor por ID
 */
async function getDoctorById(id) {
  try {
    const [rows] = await pool.execute(
      `SELECT d.*, a.name as area_name,
              d.username as username
       FROM doctors d
       LEFT JOIN areas a ON d.area_id = a.id
       WHERE d.id = ?`,
      [id]
    );
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener doctor por email (caso usuarios médicos vinculados por correo)
 */
async function getDoctorByEmail(email) {
  try {
    if (!email) return null;
    const [rows] = await pool.execute(
      `SELECT d.*, a.name as area_name
       FROM doctors d
       LEFT JOIN areas a ON d.area_id = a.id
       WHERE LOWER(d.email) = LOWER(?)
       LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener doctor comparando nombre normalizado con username (ej: medico_juan_perez)
 */
async function getDoctorByNormalizedUsername(username) {
  try {
    if (!username) return null;
    const normalizedUsername = normalizeText(username).replace(/^medico/, '');
    if (!normalizedUsername) return null;

    const [rows] = await pool.execute(
      `SELECT d.*, a.name as area_name
       FROM doctors d
       LEFT JOIN areas a ON d.area_id = a.id`
    );

    return rows.find((doctor) => normalizeText(doctor.name) === normalizedUsername) || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Crear un nuevo doctor
 */
async function createDoctor(doctorData) {
  try {
    const { name, license_number, specialty, area_id, email, phone, username } = doctorData;
    const [result] = await pool.execute(
      'INSERT INTO doctors (name, license_number, specialty, area_id, email, phone, username) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, license_number, specialty, area_id, email, phone, username || null]
    );
    return await getDoctorById(result.insertId);
  } catch (error) {
    throw error;
  }
}

/**
 * Actualizar un doctor
 */
async function updateDoctor(id, doctorData) {
  try {
    const updates = [];
    const params = [];

    Object.keys(doctorData).forEach(key => {
      if (doctorData[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(doctorData[key]);
      }
    });

    if (updates.length === 0) {
      return await getDoctorById(id);
    }

    params.push(id);
    await pool.execute(
      `UPDATE doctors SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return await getDoctorById(id);
  } catch (error) {
    throw error;
  }
}

/**
 * Eliminar un doctor
 */
async function deleteDoctor(id) {
  try {
    const [result] = await pool.execute('DELETE FROM doctors WHERE id = ?', [id]);
    return result.affectedRows > 0;
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE PACIENTES ====================

/**
 * Obtener todos los pacientes con filtros
 */
async function getAllPatients(filters = {}) {
  try {
    let query = 'SELECT * FROM patients WHERE 1=1';
    const params = [];

    if (filters.search) {
      query += ' AND (name LIKE ? OR id_number LIKE ? OR email LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (filters.id_number) {
      query += ' AND id_number = ?';
      params.push(filters.id_number);
    }

    query += ' ORDER BY name';

    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener un paciente por ID
 */
async function getPatientById(id) {
  try {
    const [rows] = await pool.execute('SELECT * FROM patients WHERE id = ?', [id]);
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Crear un nuevo paciente
 */
async function createPatient(patientData) {
  try {
    const { name, id_number, date_of_birth, gender, phone, email, address } = patientData;
    const [result] = await pool.execute(
      'INSERT INTO patients (name, id_number, date_of_birth, gender, phone, email, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, id_number, date_of_birth, gender, phone, email, address]
    );
    return await getPatientById(result.insertId);
  } catch (error) {
    throw error;
  }
}

/**
 * Actualizar un paciente
 */
async function updatePatient(id, patientData) {
  try {
    const updates = [];
    const params = [];

    Object.keys(patientData).forEach(key => {
      if (patientData[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(patientData[key]);
      }
    });

    if (updates.length === 0) {
      return await getPatientById(id);
    }

    params.push(id);
    await pool.execute(
      `UPDATE patients SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return await getPatientById(id);
  } catch (error) {
    throw error;
  }
}

/**
 * Eliminar un paciente
 */
async function deletePatient(id) {
  try {
    const [result] = await pool.execute('DELETE FROM patients WHERE id = ?', [id]);
    return result.affectedRows > 0;
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE QUÍMICOS FARMACÉUTICOS ====================

/**
 * Obtener todos los químicos farmacéuticos con filtros
 */
async function getAllPharmacists(filters = {}) {
  try {
    let query = `
      SELECT p.*, u.username as user_username
      FROM pharmacists p
      LEFT JOIN users u ON p.email = u.email AND u.role = 'farmaceutico'
      WHERE 1=1
    `;
    const params = [];

    if (filters.search) {
      query += ' AND (p.name LIKE ? OR p.id_number LIKE ? OR p.license_number LIKE ? OR p.email LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (filters.id_number) {
      query += ' AND p.id_number = ?';
      params.push(filters.id_number);
    }
    if (filters.license_number) {
      query += ' AND p.license_number = ?';
      params.push(filters.license_number);
    }
    if (filters.is_active !== undefined) {
      query += ' AND p.is_active = ?';
      params.push(filters.is_active);
    }

    query += ' ORDER BY p.name';

    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener un químico farmacéutico por ID
 */
async function getPharmacistById(id) {
  try {
    const [rows] = await pool.execute('SELECT * FROM pharmacists WHERE id = ?', [id]);
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Crear un nuevo químico farmacéutico
 */
async function createPharmacist(pharmacistData) {
  try {
    const { name, id_number, license_number, email, phone } = pharmacistData;
    const [result] = await pool.execute(
      'INSERT INTO pharmacists (name, id_number, license_number, email, phone) VALUES (?, ?, ?, ?, ?)',
      [name, id_number, license_number, email, phone]
    );
    return await getPharmacistById(result.insertId);
  } catch (error) {
    throw error;
  }
}

/**
 * Actualizar un químico farmacéutico
 */
async function updatePharmacist(id, pharmacistData) {
  try {
    const updates = [];
    const params = [];

    Object.keys(pharmacistData).forEach(key => {
      if (pharmacistData[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(pharmacistData[key]);
      }
    });

    if (updates.length === 0) {
      return await getPharmacistById(id);
    }

    params.push(id);
    await pool.execute(
      `UPDATE pharmacists SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return await getPharmacistById(id);
  } catch (error) {
    throw error;
  }
}

/**
 * Eliminar un químico farmacéutico
 */
async function deletePharmacist(id) {
  try {
    const [result] = await pool.execute('DELETE FROM pharmacists WHERE id = ?', [id]);
    return result.affectedRows > 0;
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE ALERTAS ====================

/**
 * Obtener todas las alertas activas
 */
async function getActiveAlerts() {
  try {
    const [rows] = await pool.execute(
      `SELECT sa.*, p.name as product_name, pb.lot_number, pb.expiry_date
       FROM stock_alerts sa
       JOIN products p ON sa.product_id = p.id
       LEFT JOIN product_batches pb ON sa.batch_id = pb.id
       WHERE sa.is_resolved = FALSE
       ORDER BY 
         CASE sa.severity 
           WHEN 'critical' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           ELSE 4 
         END,
         sa.created_at DESC`
    );
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Crear una alerta
 */
async function createAlert(alertData) {
  try {
    const { product_id, batch_id, alert_type, severity, message } = alertData;
    const [result] = await pool.execute(
      `INSERT INTO stock_alerts (product_id, batch_id, alert_type, severity, message)
       VALUES (?, ?, ?, ?, ?)`,
      [product_id, batch_id || null, alert_type, severity || 'medium', message]
    );
    return result.insertId;
  } catch (error) {
    throw error;
  }
}

/**
 * Verificar y generar alertas automáticas
 */
async function checkAndGenerateAlerts() {
  try {
    // Alertas de productos vencidos
    const [expiredBatches] = await pool.execute(
      `SELECT pb.*, p.name as product_name,
              DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       WHERE pb.expiry_date < CURDATE() AND pb.quantity > 0
       AND NOT EXISTS (
         SELECT 1 FROM stock_alerts sa 
         WHERE sa.batch_id = pb.id AND sa.alert_type = 'expired' AND sa.is_resolved = FALSE
       )`
    );

    for (const batch of expiredBatches) {
      await createAlert({
        product_id: batch.product_id,
        batch_id: batch.id,
        alert_type: 'expired',
        severity: 'critical',
        message: `Producto vencido: ${batch.product_name} - Lote: ${batch.lot_number}`
      });
    }

    // Alertas de productos por vencer (30 días)
    const [expiringBatches] = await pool.execute(
      `SELECT pb.*, p.name as product_name,
              DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       WHERE DATEDIFF(pb.expiry_date, CURDATE()) BETWEEN 0 AND 30 
       AND pb.expiry_date >= CURDATE() AND pb.quantity > 0
       AND NOT EXISTS (
         SELECT 1 FROM stock_alerts sa 
         WHERE sa.batch_id = pb.id AND sa.alert_type = 'expiring_soon' AND sa.is_resolved = FALSE
       )`
    );

    for (const batch of expiringBatches) {
      await createAlert({
        product_id: batch.product_id,
        batch_id: batch.id,
        alert_type: 'expiring_soon',
        severity: batch.days_to_expiry <= 7 ? 'high' : 'medium',
        message: `Producto por vencer en ${batch.days_to_expiry} días: ${batch.product_name} - Lote: ${batch.lot_number}`
      });
    }

    // Alertas de stock bajo
    const [lowStockProducts] = await pool.execute(
      `SELECT p.*, COALESCE(SUM(pb.quantity), 0) as total_stock
       FROM products p
       LEFT JOIN product_batches pb ON pb.product_id = p.id
       GROUP BY p.id
       HAVING total_stock <= p.min_stock
       AND NOT EXISTS (
         SELECT 1 FROM stock_alerts sa 
         WHERE sa.product_id = p.id AND sa.alert_type = 'low_stock' AND sa.is_resolved = FALSE
       )`
    );

    for (const product of lowStockProducts) {
      await createAlert({
        product_id: product.id,
        alert_type: 'low_stock',
        severity: product.total_stock === 0 ? 'critical' : 'high',
        message: `Stock bajo: ${product.name} - Stock actual: ${product.total_stock}, Mínimo: ${product.min_stock}`
      });
    }

    // Alertas basadas en predicciones (stock insuficiente según predicción)
    const [predictions] = await pool.execute(
      `SELECT cp.*, p.name as product_name, 
              COALESCE(SUM(pb.quantity), 0) as current_stock
       FROM consumption_predictions cp
       JOIN products p ON cp.product_id = p.id
       LEFT JOIN product_batches pb ON pb.product_id = p.id
       WHERE cp.calculation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       AND cp.prediction_period = 'month'
       GROUP BY cp.id, p.name
       HAVING current_stock < cp.predicted_quantity
       AND NOT EXISTS (
         SELECT 1 FROM stock_alerts sa 
         WHERE sa.product_id = cp.product_id 
         AND sa.alert_type = 'prediction_insufficient' 
         AND sa.is_resolved = FALSE
       )`
    );

    for (const prediction of predictions) {
      const stock = prediction.current_stock || 0;
      const predicted = prediction.predicted_quantity || 0;
      const deficit = predicted - stock;
      
      await createAlert({
        product_id: prediction.product_id,
        alert_type: 'prediction_insufficient',
        severity: deficit > predicted * 0.5 ? 'high' : 'medium',
        message: `Stock insuficiente según predicción: ${prediction.product_name} - Stock actual: ${stock}, Predicción próximo mes: ${Math.round(predicted)}, Déficit: ${Math.round(deficit)}`
      });
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE HISTORIAL ====================

async function getStockHistory(productId, filters = {}) {
  try {
    let query = `
      SELECT sh.*, p.name as product_name, pb.lot_number, a.name as area_name
      FROM stock_history sh
      JOIN products p ON sh.product_id = p.id
      LEFT JOIN product_batches pb ON sh.batch_id = pb.id
      LEFT JOIN areas a ON sh.area_id = a.id
      WHERE sh.product_id = ?
    `;
    const params = [productId];

    if (filters.area_id) {
      query += ' AND sh.area_id = ?';
      params.push(filters.area_id);
    }
    if (filters.start_date) {
      query += ' AND sh.consumption_date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND sh.consumption_date <= ?';
      params.push(filters.end_date);
    }

    query += ' ORDER BY sh.created_at DESC LIMIT 100';

    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener historial completo con filtros avanzados
 */
async function getAllStockHistory(filters = {}) {
  try {
    let query = `
      SELECT sh.*, p.name as product_name, p.product_type,
             pb.lot_number, pb.expiry_date,
             a.name as area_name,
             pc.name as category_name
      FROM stock_history sh
      JOIN products p ON sh.product_id = p.id
      LEFT JOIN product_batches pb ON sh.batch_id = pb.id
      LEFT JOIN areas a ON sh.area_id = a.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.product_id) {
      query += ' AND sh.product_id = ?';
      params.push(filters.product_id);
    }
    if (filters.batch_id) {
      query += ' AND sh.batch_id = ?';
      params.push(filters.batch_id);
    }
    if (filters.area_id) {
      query += ' AND sh.area_id = ?';
      params.push(filters.area_id);
    }
    if (filters.action) {
      query += ' AND sh.action = ?';
      params.push(filters.action);
    }
    if (filters.start_date) {
      query += ' AND sh.consumption_date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND sh.consumption_date <= ?';
      params.push(filters.end_date);
    }

    const limit = filters.limit || 500;
    query += ` ORDER BY sh.created_at DESC LIMIT ${limit}`;

    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener historial por lote específico
 */
async function getBatchHistory(batchId, filters = {}) {
  try {
    let query = `
      SELECT sh.*, p.name as product_name, pb.lot_number, a.name as area_name
      FROM stock_history sh
      JOIN products p ON sh.product_id = p.id
      JOIN product_batches pb ON sh.batch_id = pb.id
      LEFT JOIN areas a ON sh.area_id = a.id
      WHERE sh.batch_id = ?
    `;
    const params = [batchId];

    if (filters.start_date) {
      query += ' AND sh.consumption_date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND sh.consumption_date <= ?';
      params.push(filters.end_date);
    }

    query += ' ORDER BY sh.created_at DESC';

    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener historial por área
 */
async function getAreaHistory(areaId, filters = {}) {
  try {
    let query = `
      SELECT sh.*, p.name as product_name, pb.lot_number, a.name as area_name
      FROM stock_history sh
      JOIN products p ON sh.product_id = p.id
      LEFT JOIN product_batches pb ON sh.batch_id = pb.id
      JOIN areas a ON sh.area_id = a.id
      WHERE sh.area_id = ?
    `;
    const params = [areaId];

    if (filters.product_id) {
      query += ' AND sh.product_id = ?';
      params.push(filters.product_id);
    }
    if (filters.start_date) {
      query += ' AND sh.consumption_date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND sh.consumption_date <= ?';
      params.push(filters.end_date);
    }

    query += ' ORDER BY sh.created_at DESC LIMIT 200';

    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    throw error;
  }
}

// Mantener compatibilidad con funciones antiguas
async function decrementStock(rfidUid, areaId = null) {
  return await decrementBatchStock(rfidUid, areaId);
}

// ==================== FUNCIONES DE USUARIOS ====================

/**
 * Obtener usuario por username
 */
async function getUserByUsername(username) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener usuario por email
 */
async function getUserByEmail(email) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener usuario por ID
 */
async function getUserById(id) {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, email, role, is_active, created_at, last_login FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Crear nuevo usuario
 */
async function createUser(userData) {
  try {
    const { username, email, password_hash, role = 'enfermero' } = userData;
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, password_hash, role]
    );
    return await getUserById(result.insertId);
  } catch (error) {
    throw error;
  }
}

/**
 * Actualizar último login
 */
async function updateLastLogin(userId) {
  try {
    await pool.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [userId]
    );
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener todos los usuarios
 */
async function getAllUsers() {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, email, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC'
    );
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Actualizar usuario
 */
async function updateUser(id, userData) {
  try {
    const updates = [];
    const params = [];

    if (userData.username !== undefined) {
      updates.push('username = ?');
      params.push(userData.username);
    }
    if (userData.email !== undefined) {
      updates.push('email = ?');
      params.push(userData.email);
    }
    if (userData.password_hash !== undefined) {
      updates.push('password_hash = ?');
      params.push(userData.password_hash);
    }
    if (userData.role !== undefined) {
      updates.push('role = ?');
      params.push(userData.role);
    }
    if (userData.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(userData.is_active);
    }

    if (updates.length === 0) {
      return await getUserById(id);
    }

    params.push(id);
    await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return await getUserById(id);
  } catch (error) {
    throw error;
  }
}

/**
 * Eliminar usuario (soft delete - desactivar)
 */
async function deleteUser(id) {
  try {
    await pool.execute(
      'UPDATE users SET is_active = FALSE WHERE id = ?',
      [id]
    );
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Crear sesión de usuario
 */
async function createSession(userId, token, expiresAt, ipAddress, userAgent) {
  try {
    await pool.execute(
      'INSERT INTO user_sessions (user_id, token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
      [userId, token, expiresAt, ipAddress, userAgent]
    );
  } catch (error) {
    throw error;
  }
}

/**
 * Eliminar sesión
 */
async function deleteSession(token) {
  try {
    await pool.execute(
      'DELETE FROM user_sessions WHERE token = ?',
      [token]
    );
  } catch (error) {
    throw error;
  }
}

/**
 * Limpiar sesiones expiradas
 */
async function cleanExpiredSessions() {
  try {
    await pool.execute(
      'DELETE FROM user_sessions WHERE expires_at < NOW()'
    );
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE PROVEEDORES ====================

/**
 * Obtener todos los proveedores
 */
async function getAllSuppliers(includeInactive = false) {
  try {
    let query = 'SELECT * FROM suppliers';
    if (!includeInactive) {
      query += ' WHERE is_active = TRUE';
    }
    query += ' ORDER BY name ASC';
    const [rows] = await pool.execute(query);
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener proveedor por ID
 */
async function getSupplierById(id) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM suppliers WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Crear proveedor
 */
async function createSupplier(supplierData) {
  try {
    const { name, contact_person, email, phone, address, tax_id, notes, is_active = true } = supplierData;
    const [result] = await pool.execute(
      'INSERT INTO suppliers (name, contact_person, email, phone, address, tax_id, notes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, contact_person || null, email || null, phone || null, address || null, tax_id || null, notes || null, is_active]
    );
    return await getSupplierById(result.insertId);
  } catch (error) {
    throw error;
  }
}

/**
 * Actualizar proveedor
 */
async function updateSupplier(id, supplierData) {
  try {
    const updates = [];
    const params = [];
    
    if (supplierData.name !== undefined) {
      updates.push('name = ?');
      params.push(supplierData.name);
    }
    if (supplierData.contact_person !== undefined) {
      updates.push('contact_person = ?');
      params.push(supplierData.contact_person);
    }
    if (supplierData.email !== undefined) {
      updates.push('email = ?');
      params.push(supplierData.email);
    }
    if (supplierData.phone !== undefined) {
      updates.push('phone = ?');
      params.push(supplierData.phone);
    }
    if (supplierData.address !== undefined) {
      updates.push('address = ?');
      params.push(supplierData.address);
    }
    if (supplierData.tax_id !== undefined) {
      updates.push('tax_id = ?');
      params.push(supplierData.tax_id);
    }
    if (supplierData.notes !== undefined) {
      updates.push('notes = ?');
      params.push(supplierData.notes);
    }
    if (supplierData.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(supplierData.is_active);
    }
    
    if (updates.length === 0) {
      return await getSupplierById(id);
    }
    
    params.push(id);
    await pool.execute(
      `UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return await getSupplierById(id);
  } catch (error) {
    throw error;
  }
}

/**
 * Eliminar proveedor (desactivar)
 */
async function deleteSupplier(id) {
  try {
    await pool.execute(
      'UPDATE suppliers SET is_active = FALSE WHERE id = ?',
      [id]
    );
    return true;
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE ÓRDENES DE COMPRA ====================

/**
 * Obtener todas las órdenes de compra
 */
async function getAllPurchaseOrders(filters = {}) {
  try {
    let query = `
      SELECT po.*, s.name as supplier_name, s.contact_person,
             u1.username as created_by_username,
             u2.username as approved_by_username,
             u3.username as received_by_username
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u1 ON po.created_by = u1.id
      LEFT JOIN users u2 ON po.approved_by = u2.id
      LEFT JOIN users u3 ON po.received_by = u3.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.status) {
      query += ' AND po.status = ?';
      params.push(filters.status);
    }
    if (filters.supplier_id) {
      query += ' AND po.supplier_id = ?';
      params.push(filters.supplier_id);
    }
    if (filters.start_date) {
      query += ' AND po.order_date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND po.order_date <= ?';
      params.push(filters.end_date);
    }
    
    query += ' ORDER BY po.order_date DESC, po.created_at DESC';
    
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener orden de compra por ID
 */
async function getPurchaseOrderById(id) {
  try {
    const [rows] = await pool.execute(
      `SELECT po.*, s.name as supplier_name, s.contact_person,
              u1.username as created_by_username,
              u2.username as approved_by_username,
              u3.username as received_by_username
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       LEFT JOIN users u1 ON po.created_by = u1.id
       LEFT JOIN users u2 ON po.approved_by = u2.id
       LEFT JOIN users u3 ON po.received_by = u3.id
       WHERE po.id = ?`,
      [id]
    );
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Crear orden de compra
 */
async function createPurchaseOrder(orderData) {
  try {
    const { supplier_id, order_number, order_date, notes, created_by } = orderData;
    const [result] = await pool.execute(
      'INSERT INTO purchase_orders (supplier_id, order_number, order_date, notes, created_by) VALUES (?, ?, ?, ?, ?)',
      [supplier_id, order_number, order_date, notes || null, created_by || null]
    );
    return await getPurchaseOrderById(result.insertId);
  } catch (error) {
    throw error;
  }
}

/**
 * Actualizar estado de orden de compra
 */
async function updatePurchaseOrderStatus(id, status, userId = null) {
  try {
    const updates = ['status = ?'];
    const params = [status];
    
    if (status === 'approved' && userId) {
      updates.push('approved_by = ?', 'approved_at = NOW()');
      params.push(userId);
    }
    if (status === 'received' && userId) {
      updates.push('received_by = ?', 'received_at = NOW()');
      params.push(userId);
    }
    
    params.push(id);
    await pool.execute(
      `UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    // Recalcular total
    await recalculateOrderTotal(id);
    
    return await getPurchaseOrderById(id);
  } catch (error) {
    throw error;
  }
}

/**
 * Recalcular total de orden
 */
async function recalculateOrderTotal(orderId) {
  try {
    const [result] = await pool.execute(
      'SELECT SUM(total_price) as total FROM purchase_order_items WHERE order_id = ?',
      [orderId]
    );
    const total = result[0].total || 0;
    await pool.execute(
      'UPDATE purchase_orders SET total_amount = ? WHERE id = ?',
      [total, orderId]
    );
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener items de orden de compra
 */
async function getPurchaseOrderItems(orderId) {
  try {
    const [rows] = await pool.execute(
      `SELECT poi.*, p.name as product_name, p.product_type
       FROM purchase_order_items poi
       LEFT JOIN products p ON poi.product_id = p.id
       WHERE poi.order_id = ?
       ORDER BY poi.id ASC`,
      [orderId]
    );
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Crear item de orden de compra
 */
async function createPurchaseOrderItem(itemData) {
  try {
    const { order_id, product_id, quantity, unit_price, notes } = itemData;
    const total_price = quantity * unit_price;
    
    const [result] = await pool.execute(
      'INSERT INTO purchase_order_items (order_id, product_id, quantity, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [order_id, product_id, quantity, unit_price, total_price, notes || null]
    );
    
    // Recalcular total de orden
    await recalculateOrderTotal(order_id);
    
    return await pool.execute(
      'SELECT poi.*, p.name as product_name FROM purchase_order_items poi LEFT JOIN products p ON poi.product_id = p.id WHERE poi.id = ?',
      [result.insertId]
    ).then(([rows]) => rows[0]);
  } catch (error) {
    throw error;
  }
}

/**
 * Actualizar item de orden de compra
 */
async function updatePurchaseOrderItem(itemId, itemData) {
  try {
    const updates = [];
    const params = [];
    
    if (itemData.quantity !== undefined) {
      updates.push('quantity = ?');
      params.push(itemData.quantity);
    }
    if (itemData.unit_price !== undefined) {
      updates.push('unit_price = ?');
      params.push(itemData.unit_price);
    }
    if (itemData.received_quantity !== undefined) {
      updates.push('received_quantity = ?');
      params.push(itemData.received_quantity);
    }
    if (itemData.notes !== undefined) {
      updates.push('notes = ?');
      params.push(itemData.notes);
    }
    
    if (updates.length === 0) {
      return null;
    }
    
    // Recalcular total_price si cambió quantity o unit_price
    if (itemData.quantity !== undefined || itemData.unit_price !== undefined) {
      const [item] = await pool.execute(
        'SELECT quantity, unit_price FROM purchase_order_items WHERE id = ?',
        [itemId]
      );
      const qty = itemData.quantity !== undefined ? itemData.quantity : item[0].quantity;
      const price = itemData.unit_price !== undefined ? itemData.unit_price : item[0].unit_price;
      updates.push('total_price = ?');
      params.push(qty * price);
    }
    
    params.push(itemId);
    await pool.execute(
      `UPDATE purchase_order_items SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    // Obtener order_id para recalcular total
    const [item] = await pool.execute(
      'SELECT order_id FROM purchase_order_items WHERE id = ?',
      [itemId]
    );
    if (item.length > 0) {
      await recalculateOrderTotal(item[0].order_id);
    }
    
    return await pool.execute(
      'SELECT poi.*, p.name as product_name FROM purchase_order_items poi LEFT JOIN products p ON poi.product_id = p.id WHERE poi.id = ?',
      [itemId]
    ).then(([rows]) => rows[0]);
  } catch (error) {
    throw error;
  }
}

/**
 * Eliminar item de orden de compra
 */
async function deletePurchaseOrderItem(itemId) {
  try {
    const [item] = await pool.execute(
      'SELECT order_id FROM purchase_order_items WHERE id = ?',
      [itemId]
    );
    
    await pool.execute(
      'DELETE FROM purchase_order_items WHERE id = ?',
      [itemId]
    );
    
    if (item.length > 0) {
      await recalculateOrderTotal(item[0].order_id);
    }
    
    return true;
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE RECEPCIONES ====================

/**
 * Crear recepción
 */
async function createReceipt(receiptData) {
  try {
    const { order_id, receipt_date, received_by, notes } = receiptData;
    const [result] = await pool.execute(
      'INSERT INTO receipts (order_id, receipt_date, received_by, notes) VALUES (?, ?, ?, ?)',
      [order_id, receipt_date, received_by || null, notes || null]
    );
    
    // Actualizar estado de orden a recibida
    await updatePurchaseOrderStatus(order_id, 'received', received_by);
    
    return await pool.execute(
      'SELECT r.*, u.username as received_by_username FROM receipts r LEFT JOIN users u ON r.received_by = u.id WHERE r.id = ?',
      [result.insertId]
    ).then(([rows]) => rows[0]);
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener recepciones por orden
 */
async function getReceiptsByOrder(orderId) {
  try {
    const [rows] = await pool.execute(
      `SELECT r.*, u.username as received_by_username
       FROM receipts r
       LEFT JOIN users u ON r.received_by = u.id
       WHERE r.order_id = ?
       ORDER BY r.receipt_date DESC, r.created_at DESC`,
      [orderId]
    );
    return rows;
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE CONFIGURACIÓN DEL SISTEMA ====================

/**
 * Obtener todas las configuraciones del sistema
 */
async function getSystemConfig(category = null) {
  try {
    let query = 'SELECT * FROM system_config WHERE 1=1';
    const params = [];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY category, config_key';
    
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener configuración por clave
 */
async function getSystemConfigByKey(key) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM system_config WHERE config_key = ?',
      [key]
    );
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Actualizar configuración
 */
async function updateSystemConfig(key, configValue, description, userId) {
  try {
    await pool.execute(
      `UPDATE system_config 
       SET config_value = ?, description = COALESCE(?, description), updated_by = ?, updated_at = NOW()
       WHERE config_key = ?`,
      [configValue, description || null, userId, key]
    );
    
    return await getSystemConfigByKey(key);
  } catch (error) {
    throw error;
  }
}

/**
 * Crear configuración
 */
async function createSystemConfig(configData) {
  try {
    const { config_key, config_value, config_type, description, category, is_editable, updated_by } = configData;
    const [result] = await pool.execute(
      `INSERT INTO system_config (config_key, config_value, config_type, description, category, is_editable, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        config_key,
        config_value,
        config_type || 'string',
        description || null,
        category || 'general',
        is_editable !== undefined ? is_editable : true,
        updated_by || null
      ]
    );
    
    const [rows] = await pool.execute(
      'SELECT * FROM system_config WHERE id = ?',
      [result.insertId]
    );
    return rows[0];
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE REPORTES PROGRAMADOS ====================

/**
 * Obtener todos los reportes programados
 */
async function getAllScheduledReports() {
  try {
    const [rows] = await pool.execute(
      `SELECT sr.*, u.username as created_by_username
       FROM scheduled_reports sr
       LEFT JOIN users u ON sr.created_by = u.id
       ORDER BY sr.created_at DESC`
    );
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener reporte programado por ID
 */
async function getScheduledReportById(id) {
  try {
    const [rows] = await pool.execute(
      `SELECT sr.*, u.username as created_by_username
       FROM scheduled_reports sr
       LEFT JOIN users u ON sr.created_by = u.id
       WHERE sr.id = ?`,
      [id]
    );
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Crear reporte programado
 */
async function createScheduledReport(reportData) {
  try {
    const {
      report_name,
      report_type,
      schedule_type,
      schedule_config,
      recipients,
      format,
      filters,
      is_active,
      created_by,
      next_run_at
    } = reportData;
    
    const [result] = await pool.execute(
      `INSERT INTO scheduled_reports 
       (report_name, report_type, schedule_type, schedule_config, recipients, format, filters, is_active, created_by, next_run_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report_name,
        report_type,
        schedule_type,
        JSON.stringify(schedule_config || {}),
        recipients || null,
        format || 'pdf',
        JSON.stringify(filters || {}),
        is_active !== undefined ? is_active : true,
        created_by || null,
        next_run_at || null
      ]
    );
    
    return await getScheduledReportById(result.insertId);
  } catch (error) {
    throw error;
  }
}

/**
 * Actualizar reporte programado
 */
async function updateScheduledReport(id, updates) {
  try {
    const updateFields = [];
    const params = [];
    
    Object.keys(updates).forEach(key => {
      if (key === 'schedule_config' || key === 'filters') {
        updateFields.push(`${key} = ?`);
        params.push(JSON.stringify(updates[key]));
      } else {
        updateFields.push(`${key} = ?`);
        params.push(updates[key]);
      }
    });
    
    if (updateFields.length === 0) {
      return await getScheduledReportById(id);
    }
    
    updateFields.push('updated_at = NOW()');
    params.push(id);
    
    await pool.execute(
      `UPDATE scheduled_reports SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );
    
    return await getScheduledReportById(id);
  } catch (error) {
    throw error;
  }
}

/**
 * Eliminar reporte programado
 */
async function deleteScheduledReport(id) {
  try {
    await pool.execute('DELETE FROM scheduled_reports WHERE id = ?', [id]);
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener ejecuciones de un reporte programado
 */
async function getScheduledReportExecutions(reportId, limit = 50) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM scheduled_report_executions
       WHERE scheduled_report_id = ?
       ORDER BY execution_date DESC
       LIMIT ?`,
      [reportId, limit]
    );
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Crear ejecución de reporte programado
 */
async function createScheduledReportExecution(executionData) {
  try {
    const {
      scheduled_report_id,
      status,
      records_generated,
      file_path,
      error_message,
      execution_time_ms
    } = executionData;
    
    const [result] = await pool.execute(
      `INSERT INTO scheduled_report_executions
       (scheduled_report_id, status, records_generated, file_path, error_message, execution_time_ms)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        scheduled_report_id,
        status || 'pending',
        records_generated || 0,
        file_path || null,
        error_message || null,
        execution_time_ms || null
      ]
    );
    
    const [rows] = await pool.execute(
      'SELECT * FROM scheduled_report_executions WHERE id = ?',
      [result.insertId]
    );
    return rows[0];
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE RECETAS ====================

/**
 * Crear una nueva receta
 */
async function createPrescription(prescriptionData) {
  try {
    console.log('💾 Creando receta con datos:', JSON.stringify(prescriptionData, null, 2));
    const { prescription_code, qr_code, patient_name, patient_id, patient_id_number, patient_phone,
            doctor_name, doctor_id, doctor_license, prescription_date, notes, created_by,
            specialty, service, attention_type } = prescriptionData;
    
    // Verificar qué columnas existen en la tabla
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'prescriptions'
    `);
    
    const columnMap = {};
    columns.forEach(c => { columnMap[c.COLUMN_NAME] = true; });
    
    // Construir INSERT dinámicamente según las columnas disponibles
    let insertFields = ['prescription_code', 'qr_code', 'patient_name', 'doctor_name', 'prescription_date', 'status'];
    let insertValues = [prescription_code, qr_code, patient_name, doctor_name, prescription_date, 'pending'];
    
    // Agregar campos opcionales si existen
    // patient_id es INT (ID del paciente registrado)
    if (columnMap['patient_id']) {
      insertFields.push('patient_id');
      // Convertir a número o null
      const patientIdValue = patient_id ? parseInt(patient_id) : null;
      insertValues.push(isNaN(patientIdValue) ? null : patientIdValue);
    }
    
    // patient_id_number es VARCHAR (DNI/identificación)
    if (columnMap['patient_id_number']) {
      insertFields.push('patient_id_number');
      insertValues.push(patient_id_number && patient_id_number.trim() ? patient_id_number.trim() : null);
    }

    // patient_phone - teléfono del paciente
    if (columnMap['patient_phone']) {
      insertFields.push('patient_phone');
      insertValues.push(patient_phone && patient_phone.trim() ? patient_phone.trim() : null);
    }
    
    if (columnMap['doctor_id']) {
      insertFields.push('doctor_id');
      // Convertir a número o null
      const doctorIdValue = doctor_id ? parseInt(doctor_id) : null;
      insertValues.push(isNaN(doctorIdValue) ? null : doctorIdValue);
    }
    
    if (columnMap['doctor_license']) {
      insertFields.push('doctor_license');
      insertValues.push(doctor_license && doctor_license.trim() ? doctor_license.trim() : null);
    }
    
    if (columnMap['notes']) {
      insertFields.push('notes');
      insertValues.push(notes && notes.trim() ? notes.trim() : null);
    }
    
    if (columnMap['created_by']) {
      insertFields.push('created_by');
      // Convertir a número o null
      const createdByValue = created_by ? parseInt(created_by) : null;
      insertValues.push(isNaN(createdByValue) ? null : createdByValue);
    }

    // Nuevos campos de formato institucional
    if (columnMap['specialty']) {
      insertFields.push('specialty');
      insertValues.push(specialty && specialty.trim() ? specialty.trim() : null);
    }

    if (columnMap['service']) {
      insertFields.push('service');
      insertValues.push(service && service.trim() ? service.trim() : 'Farmacia Consulta Externa');
    }

    if (columnMap['attention_type']) {
      insertFields.push('attention_type');
      insertValues.push(attention_type && attention_type.trim() ? attention_type.trim() : 'Consulta Externa');
    }

    // Generar número de comprobante automáticamente
    if (columnMap['receipt_number']) {
      insertFields.push('receipt_number');
      // Se generará después de la inserción con el ID
      insertValues.push(null);
    }
    
    const placeholders = insertFields.map(() => '?').join(', ');
    const [result] = await pool.execute(
      `INSERT INTO prescriptions (${insertFields.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );

    // Actualizar el número de comprobante con el ID generado
    if (columnMap['receipt_number']) {
      const receiptNumber = `ORD-${String(result.insertId).padStart(7, '0')}`;
      await pool.execute(
        `UPDATE prescriptions SET receipt_number = ? WHERE id = ?`,
        [receiptNumber, result.insertId]
      );
    }
    
    console.log('✅ Receta creada con ID:', result.insertId);
    return result.insertId;
  } catch (error) {
    console.error('✗ Error en createPrescription:', error);
    console.error('Stack:', error.stack);
    throw error;
  }
}

/**
 * Obtener receta por código
 */
async function getPrescriptionByCode(prescriptionCode) {
  try {
    console.log('🔍 Buscando receta por código:', prescriptionCode);
    const [rows] = await pool.execute(
      `SELECT p.*, 
              u1.username as created_by_username,
              u2.username as fulfilled_by_username,
              d.specialty as doctor_specialty,
              pat.id_number as patient_dni
       FROM prescriptions p
       LEFT JOIN users u1 ON p.created_by = u1.id
       LEFT JOIN users u2 ON p.fulfilled_by = u2.id
       LEFT JOIN doctors d ON p.doctor_name = d.name OR p.doctor_license = d.license_number
       LEFT JOIN patients pat ON p.patient_id = pat.id
       WHERE p.prescription_code = ?`,
      [prescriptionCode]
    );
    
    console.log('✅ Resultado de búsqueda:', rows.length > 0 ? 'Encontrada' : 'No encontrada');
    return rows[0] || null;
  } catch (error) {
    console.error('✗ Error en getPrescriptionByCode:', error);
    console.error('Stack:', error.stack);
    throw error;
  }
}

/**
 * Obtener receta por ID
 */
async function getPrescriptionById(prescriptionId) {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, 
              u1.username as created_by_username,
              u2.username as fulfilled_by_username
       FROM prescriptions p
       LEFT JOIN users u1 ON p.created_by = u1.id
       LEFT JOIN users u2 ON p.fulfilled_by = u2.id
       WHERE p.id = ?`,
      [prescriptionId]
    );
    
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener todos los items de una receta
 */
async function getPrescriptionItems(prescriptionId) {
  try {
    if (!prescriptionId) {
      console.warn('⚠️ getPrescriptionItems: prescriptionId no proporcionado');
      return [];
    }
    
    // Asegurar que prescriptionId sea un número
    const prescriptionIdNum = parseInt(prescriptionId);
    if (isNaN(prescriptionIdNum)) {
      console.error('❌ getPrescriptionItems: prescriptionId no es un número válido:', prescriptionId);
      return [];
    }
    
    console.log('📦 Obteniendo items de receta ID:', prescriptionIdNum, '(tipo:', typeof prescriptionIdNum, ')');
    
    // Primero verificar si hay items en la tabla
    const [itemCount] = await pool.execute(
      `SELECT COUNT(*) as count FROM prescription_items WHERE prescription_id = ?`,
      [prescriptionIdNum]
    );
    console.log(`📊 Items en BD para receta ${prescriptionIdNum}: ${itemCount[0]?.count || 0}`);
    
    // Primero intentar consulta simplificada (más confiable)
    // Usar LEFT JOIN para que no se pierdan items si un producto fue eliminado
    // Nota: units_per_package puede no existir en todas las versiones de la BD
    const [rows] = await pool.execute(
      `SELECT pi.*, 
              p.name as product_name,
              p.active_ingredient,
              p.concentration,
              p.presentation
       FROM prescription_items pi
       LEFT JOIN products p ON pi.product_id = p.id
       WHERE pi.prescription_id = ?
       ORDER BY pi.id`,
      [prescriptionIdNum]
    );
    
    console.log(`📊 Items obtenidos de la consulta: ${rows?.length || 0}`);
    if (rows && rows.length > 0) {
      console.log('📋 Primeros items:', rows.slice(0, 3).map(r => ({
        id: r.id,
        product_id: r.product_id,
        product_name: r.product_name || '(producto no encontrado)',
        quantity_required: r.quantity_required
      })));
    }
    
    // Si no hay items, retornar array vacío
    if (!rows || rows.length === 0) {
      console.log(`⚠️ No se encontraron items para receta ID: ${prescriptionIdNum} (pero hay ${itemCount[0]?.count || 0} en BD)`);
      // Si hay items en BD pero no se encontraron, intentar consulta directa sin JOIN
      if (itemCount[0]?.count > 0) {
        console.log('🔍 Intentando consulta directa sin JOIN...');
        const [directRows] = await pool.execute(
          `SELECT * FROM prescription_items WHERE prescription_id = ?`,
          [prescriptionIdNum]
        );
        console.log(`📊 Items directos encontrados: ${directRows?.length || 0}`);
        if (directRows && directRows.length > 0) {
          console.log('⚠️ Items encontrados pero sin información de producto. Product IDs:', directRows.map(r => r.product_id));
        }
      }
      return [];
    }
    
    // Si hay items, obtener información de stock y lotes para cada producto
    for (let i = 0; i < rows.length; i++) {
      try {
        // Calcular stock disponible total del producto
        const [stockRows] = await pool.execute(
          `SELECT COALESCE(SUM(quantity), 0) as total_stock
           FROM product_batches 
           WHERE product_id = ? AND quantity > 0`,
          [rows[i].product_id]
        );
        
        const stockAvailable = parseInt(stockRows[0]?.total_stock || 0);
        const quantityRequired = parseInt(rows[i].quantity_required || 0);
        const quantityDispensed = parseInt(rows[i].quantity_dispensed || 0);
        const quantityRemaining = quantityRequired - quantityDispensed;
        
        rows[i].stock_available = stockAvailable;
        // Marcar como sin stock si:
        // 1. No hay stock disponible (stockAvailable === 0), O
        // 2. El stock disponible es menor que la cantidad que aún falta por despachar
        rows[i].is_out_of_stock = stockAvailable === 0 || stockAvailable < quantityRemaining;
        
        // Obtener información del lote más antiguo disponible (FIFO)
        const [batchRows] = await pool.execute(
          `SELECT lot_number, expiry_date, quantity
           FROM product_batches 
           WHERE product_id = ? AND quantity > 0 
           ORDER BY expiry_date ASC LIMIT 1`,
          [rows[i].product_id]
        );
        
        if (batchRows && batchRows.length > 0) {
          rows[i].lot_number = batchRows[0].lot_number;
          rows[i].expiry_date = batchRows[0].expiry_date;
          rows[i].batch_quantity = batchRows[0].quantity;
        }
      } catch (batchError) {
        // No es crítico si no se puede obtener información del lote
        console.warn(`⚠️ No se pudo obtener información de stock para producto ${rows[i].product_id}:`, batchError.message);
        // Establecer valores por defecto
        rows[i].stock_available = 0;
        rows[i].is_out_of_stock = true;
      }
    }
    
    console.log(`✅ Items encontrados: ${rows.length}`);
    return rows;
  } catch (error) {
    console.error('✗ Error en getPrescriptionItems:', error);
    console.error('Stack:', error.stack);
    // En lugar de lanzar error, retornar array vacío para no romper la visualización
    console.warn('⚠️ Retornando array vacío debido a error');
    return [];
  }
}

/**
 * Agregar item a una receta
 */
async function addPrescriptionItem(prescriptionId, itemData) {
  try {
    // Asegurar que prescriptionId sea un número
    const prescriptionIdNum = parseInt(prescriptionId);
    if (isNaN(prescriptionIdNum)) {
      throw new Error(`prescriptionId no es un número válido: ${prescriptionId}`);
    }
    
    console.log('📦 Agregando item a receta ID:', prescriptionIdNum, itemData);
    const { product_id, quantity_required, instructions, 
            administration_route, dosage, duration, item_code } = itemData;
    
    // Validar que product_id sea un número
    const productIdNum = parseInt(product_id);
    if (isNaN(productIdNum)) {
      throw new Error(`product_id no es un número válido: ${product_id}`);
    }
    
    // Validar quantity_required
    const quantityNum = parseInt(quantity_required);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      throw new Error(`quantity_required no es un número válido: ${quantity_required}`);
    }
    
    const [result] = await pool.execute(
      `INSERT INTO prescription_items 
       (prescription_id, product_id, quantity_required, instructions, 
        administration_route, dosage, duration, item_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prescriptionIdNum, 
        productIdNum, 
        quantityNum, 
        instructions || null,
        administration_route || 'Oral',
        dosage || null,
        duration || null,
        item_code || null
      ]
    );
    
    console.log('✅ Item agregado con ID:', result.insertId, 'para receta:', prescriptionIdNum);
    
    // Verificar que se guardó correctamente
    const [verify] = await pool.execute(
      `SELECT * FROM prescription_items WHERE id = ?`,
      [result.insertId]
    );
    if (verify.length === 0) {
      console.error('❌ Item no se encontró después de insertar!');
    } else {
      console.log('✅ Verificación: Item guardado correctamente con prescription_id:', verify[0].prescription_id);
    }
    
    return result.insertId;
  } catch (error) {
    console.error('✗ Error en addPrescriptionItem:', error);
    console.error('Stack:', error.stack);
    throw error;
  }
}

/**
 * Despachar item de receta
 */
async function fulfillPrescriptionItem(prescriptionId, prescriptionItemId, batchId, quantity, userId, connection = null) {
  try {
    // Usar la conexión proporcionada o el pool general
    const db = connection || pool;
    
    // Actualizar cantidad despachada en prescription_items
    await db.execute(
      `UPDATE prescription_items 
       SET quantity_dispensed = COALESCE(quantity_dispensed, 0) + ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND prescription_id = ?`,
      [quantity, prescriptionItemId, prescriptionId]
    );
    
    // Registrar en prescription_fulfillments
    const [result] = await db.execute(
      `INSERT INTO prescription_fulfillments 
       (prescription_id, prescription_item_id, batch_id, quantity_dispensed, dispensed_by)
       VALUES (?, ?, ?, ?, ?)`,
      [prescriptionId, prescriptionItemId, batchId, quantity, userId]
    );
    
    // Verificar si la receta está completa
    const [items] = await db.execute(
      `SELECT quantity_required, quantity_dispensed 
       FROM prescription_items 
       WHERE prescription_id = ?`,
      [prescriptionId]
    );
    
    // Manejar valores null en quantity_dispensed (tratarlos como 0)
    const allFulfilled = items.every(item => {
      const dispensed = item.quantity_dispensed || 0;
      const required = item.quantity_required || 0;
      return dispensed >= required;
    });
    const someFulfilled = items.some(item => (item.quantity_dispensed || 0) > 0);
    
    let newStatus = 'pending';
    if (allFulfilled) {
      newStatus = 'fulfilled';
    } else if (someFulfilled) {
      newStatus = 'partial';
    }
    
    // Actualizar estado de la receta
    if (newStatus === 'fulfilled') {
      await db.execute(
        `UPDATE prescriptions 
         SET status = ?, fulfilled_by = ?, fulfilled_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newStatus, userId, prescriptionId]
      );
    } else {
      await db.execute(
        `UPDATE prescriptions 
         SET status = ?
         WHERE id = ?`,
        [newStatus, prescriptionId]
      );
    }
    
    return result.insertId;
  } catch (error) {
    throw error;
  }
}

/**
 * Listar recetas con filtros
 */
async function getAllPrescriptions(filters = {}) {
  try {
    let query = `
      SELECT p.*, 
             u1.username as created_by_username,
             u2.username as fulfilled_by_username,
             (SELECT COUNT(*) FROM prescription_items pi WHERE pi.prescription_id = p.id) as items_count
      FROM prescriptions p
      LEFT JOIN users u1 ON p.created_by = u1.id
      LEFT JOIN users u2 ON p.fulfilled_by = u2.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.status) {
      query += ' AND p.status = ?';
      params.push(filters.status);
    }
    
    if (filters.patient_name) {
      query += ' AND p.patient_name LIKE ?';
      params.push(`%${filters.patient_name}%`);
    }
    
    if (filters.prescription_code) {
      query += ' AND p.prescription_code LIKE ?';
      params.push(`%${filters.prescription_code}%`);
    }
    
    if (filters.date_from) {
      query += ' AND p.prescription_date >= ?';
      params.push(filters.date_from);
    }
    
    if (filters.date_to) {
      query += ' AND p.prescription_date <= ?';
      params.push(filters.date_to);
    }
    
    if (filters.created_by) {
      query += ' AND p.created_by = ?';
      params.push(filters.created_by);
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    if (filters.limit) {
      // LIMIT y OFFSET no pueden usar parámetros preparados en algunas versiones de MySQL
      // Insertar directamente en SQL después de validar
      const limit = parseInt(filters.limit, 10);
      const offset = filters.offset ? parseInt(filters.offset, 10) : 0;
      if (!isNaN(limit) && limit > 0 && !isNaN(offset) && offset >= 0) {
        query += ` LIMIT ${limit}`;
        if (offset > 0) {
          query += ` OFFSET ${offset}`;
        }
      }
    }
    
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Buscar producto por RFID, barcode o código
 */
async function searchProductByAny(query) {
  try {
    const searchTerm = `%${query}%`;
    const [rows] = await pool.execute(
      `SELECT p.*, 
              pc.name as category_name,
              COALESCE((SELECT SUM(pb.quantity) FROM product_batches pb WHERE pb.product_id = p.id), 0) as total_stock
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE p.rfid_uid = ? 
          OR p.barcode = ?
          OR p.id = ?
          OR p.name LIKE ?
          OR p.active_ingredient LIKE ?
       LIMIT 10`,
      [query, query, isNaN(query) ? -1 : parseInt(query), searchTerm, searchTerm]
    );
    
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Buscar producto por RFID
 */
async function getProductByRfid(rfidUid) {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, 
              pc.name as category_name,
              COALESCE((SELECT SUM(pb.quantity) FROM product_batches pb WHERE pb.product_id = p.id), 0) as total_stock
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE p.rfid_uid = ? 
          OR EXISTS (SELECT 1 FROM product_batches pb WHERE pb.product_id = p.id AND pb.rfid_uid = ?)
       LIMIT 1`,
      [rfidUid, rfidUid]
    );
    
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Buscar producto por código de barras
 */
async function getProductByBarcode(barcode) {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, 
              pc.name as category_name,
              COALESCE((SELECT SUM(pb.quantity) FROM product_batches pb WHERE pb.product_id = p.id), 0) as total_stock
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE p.barcode = ?
       LIMIT 1`,
      [barcode]
    );
    
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

// ==================== FUNCIONES DE RESTRICCIONES ====================

/**
 * Obtener restricciones de área para un producto
 */
async function getProductAreaRestrictions(productId) {
  try {
    const [rows] = await pool.execute(
      `SELECT par.*, a.name as area_name
       FROM product_area_restrictions par
       JOIN areas a ON par.area_id = a.id
       WHERE par.product_id = ?`,
      [productId]
    );
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener restricciones de especialista para un producto
 */
async function getProductSpecialistRestrictions(productId) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM product_specialist_restrictions
       WHERE product_id = ?`,
      [productId]
    );
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Agregar restricción de área a un producto
 */
async function addProductAreaRestriction(productId, areaId) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO product_area_restrictions (product_id, area_id)
       VALUES (?, ?)`,
      [productId, areaId]
    );
    return result.insertId;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Esta restricción ya existe');
    }
    throw error;
  }
}

/**
 * Eliminar restricción de área de un producto
 */
async function removeProductAreaRestriction(productId, areaId) {
  try {
    const [result] = await pool.execute(
      `DELETE FROM product_area_restrictions
       WHERE product_id = ? AND area_id = ?`,
      [productId, areaId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    throw error;
  }
}

/**
 * Agregar restricción de especialista a un producto
 */
async function addProductSpecialistRestriction(productId, specialistType) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO product_specialist_restrictions (product_id, specialist_type)
       VALUES (?, ?)`,
      [productId, specialistType]
    );
    return result.insertId;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Esta restricción ya existe');
    }
    throw error;
  }
}

/**
 * Eliminar restricción de especialista de un producto
 */
async function removeProductSpecialistRestriction(productId, specialistType) {
  try {
    const [result] = await pool.execute(
      `DELETE FROM product_specialist_restrictions
       WHERE product_id = ? AND specialist_type = ?`,
      [productId, specialistType]
    );
    return result.affectedRows > 0;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener productos asignados a un área
 */
async function getAreaProducts(areaId) {
  try {
    const [rows] = await pool.execute(
      `SELECT ap.*, p.name as product_name, p.product_type
       FROM area_products ap
       JOIN products p ON ap.product_id = p.id
       WHERE ap.area_id = ?`,
      [areaId]
    );
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Asignar producto a un área
 */
async function assignProductToArea(areaId, productId) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO area_products (area_id, product_id)
       VALUES (?, ?)`,
      [areaId, productId]
    );
    return result.insertId;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Este producto ya está asignado a esta área');
    }
    throw error;
  }
}

/**
 * Remover producto de un área
 */
async function removeProductFromArea(areaId, productId) {
  try {
    const [result] = await pool.execute(
      `DELETE FROM area_products
       WHERE area_id = ? AND product_id = ?`,
      [areaId, productId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    throw error;
  }
}

/**
 * Validar si un producto puede ser usado en un área
 */
async function canUseProductInArea(productId, areaId) {
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as count FROM product_area_restrictions
       WHERE product_id = ? AND area_id = ?`,
      [productId, areaId]
    );
    return rows[0].count === 0;
  } catch (error) {
    throw error;
  }
}

/**
 * Validar si un especialista puede prescribir un producto
 */
async function canSpecialistPrescribeProduct(productId, specialistType) {
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as count FROM product_specialist_restrictions
       WHERE product_id = ? AND specialist_type = ?`,
      [productId, specialistType]
    );
    // Si hay restricciones, solo ese especialista puede prescribir
    // Si no hay restricciones, cualquier especialista puede prescribir
    const [allRestrictions] = await pool.execute(
      `SELECT COUNT(*) as count FROM product_specialist_restrictions
       WHERE product_id = ?`,
      [productId]
    );
    if (allRestrictions[0].count === 0) {
      return true; // No hay restricciones, cualquiera puede prescribir
    }
    return rows[0].count > 0; // Solo el especialista específico puede prescribir
  } catch (error) {
    throw error;
  }
}

module.exports = {
  pool,
  // Productos
  getAllProducts,
  getAllProductsPaginated,
  getProductById,
  getProductByRfidUid,
  createProduct,
  updateProduct,
  deleteProduct,
  decrementStock, // Compatibilidad
  // Lotes
  getProductBatches,
  getBatchById,
  getBatchByRfidUid,
  getBatchesByRfidUid,
  checkRfidHasActiveStock,
  createBatch,
  updateBatchQuantity,
  deleteBatch,
  decrementBatchStock,
  decrementBatchStockById,
  // Categorías
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  // Áreas
  getAllAreas,
  getAreaById,
  createArea,
  // Doctores
  getAllDoctors,
  getDoctorById,
  getDoctorByEmail,
  getDoctorByNormalizedUsername,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  // Pacientes
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  // Químicos Farmacéuticos
  getAllPharmacists,
  getPharmacistById,
  createPharmacist,
  updatePharmacist,
  deletePharmacist,
  // Restricciones
  getProductAreaRestrictions,
  getProductSpecialistRestrictions,
  addProductAreaRestriction,
  removeProductAreaRestriction,
  addProductSpecialistRestriction,
  removeProductSpecialistRestriction,
  getAreaProducts,
  assignProductToArea,
  removeProductFromArea,
  canUseProductInArea,
  canSpecialistPrescribeProduct,
  // Alertas
  getActiveAlerts,
  createAlert,
  checkAndGenerateAlerts,
  // Historial
  getStockHistory,
  getAllStockHistory,
  getBatchHistory,
  getAreaHistory,
  // Usuarios
  getUserByUsername,
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateLastLogin,
  getAllUsers,
  createSession,
  deleteSession,
  cleanExpiredSessions,
  // Proveedores
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  // Órdenes de Compra
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  getPurchaseOrderItems,
  createPurchaseOrderItem,
  updatePurchaseOrderItem,
  deletePurchaseOrderItem,
  // Recepciones
  createReceipt,
  getReceiptsByOrder,
  // Configuración del sistema
  getSystemConfig,
  getSystemConfigByKey,
  updateSystemConfig,
  createSystemConfig,
  // Reportes programados
  getAllScheduledReports,
  getScheduledReportById,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  getScheduledReportExecutions,
  createScheduledReportExecution,
  // Recetas
  createPrescription,
  getPrescriptionByCode,
  getPrescriptionById,
  getPrescriptionItems,
  addPrescriptionItem,
  fulfillPrescriptionItem,
  getAllPrescriptions,
  // Búsqueda mejorada
  searchProductByAny,
  getProductByRfid,
  getProductByBarcode,
  // Stock mejorado
  incrementBatchStock
};

