const mysql = require('mysql2/promise');
const { normalizeRfidCode, formatConcentration } = require('./utils/rfidNormalizer');

// Cargar variables de entorno
require('dotenv').config();

// Configuración de la base de datos MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
  database: process.env.DB_NAME || 'rfid_stock_db',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Configurar charset UTF-8 en todas las conexiones
pool.on('connection', (connection) => {
  connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  connection.query("SET CHARACTER SET utf8mb4");
  connection.query("SET character_set_connection=utf8mb4");
});

// Probar conexión
pool.getConnection()
  .then(connection => {
    console.log('✓ Conexión a MySQL establecida correctamente');
    connection.release();
  })
  .catch(err => {
    console.error('✗ Error al conectar con MySQL:', err.message);
  });

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

    // Construir consulta para obtener productos agrupados por RFID
    // Primero obtenemos todos los productos/lotes con sus RFIDs
    let baseQuery = `
      SELECT 
        COALESCE(pb.rfid_uid, p.rfid_uid) as rfid_code,
        p.id as product_id,
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
        p.rfid_uid as product_rfid_uid,
        pb.rfid_uid as batch_rfid_uid,
        COALESCE(SUM(pb.quantity), 0) as total_stock,
        MIN(pb.expiry_date) as earliest_expiry,
        MAX(pb.expiry_date) as latest_expiry
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN product_batches pb ON pb.product_id = p.id
      WHERE 1=1
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
        OR p.id = ?
        OR p.name LIKE ?
        OR p.active_ingredient LIKE ?
        OR p.description LIKE ?
        OR pb.lot_number LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      const searchValue = filters.search.trim();
      const searchId = isNaN(searchValue) ? -1 : parseInt(searchValue);
      params.push(searchValue, searchId, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (filters.active_ingredient) {
      baseQuery += ' AND p.active_ingredient LIKE ?';
      params.push(`%${filters.active_ingredient}%`);
    }
    if (filters.rfid_uid) {
      baseQuery += ' AND (COALESCE(pb.rfid_uid, p.rfid_uid) = ?)';
      params.push(filters.rfid_uid);
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

    // Agrupar por RFID y producto
    baseQuery += ` 
      GROUP BY COALESCE(pb.rfid_uid, p.rfid_uid), p.id
      HAVING COALESCE(pb.rfid_uid, p.rfid_uid) IS NOT NULL
    `;

    // Contar total de grupos únicos
    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as grouped_products`;
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0].total;

    // Ahora agrupar por RFID para obtener un registro por RFID con stock total
    let groupedQuery = `
      SELECT 
        rfid_code,
        MAX(name) as name,
        MAX(active_ingredient) as active_ingredient,
        MAX(concentration) as concentration,
        MAX(presentation) as presentation,
        MAX(product_type) as product_type,
        MAX(category_name) as category_name,
        MAX(category_id) as category_id,
        MAX(min_stock) as min_stock,
        MAX(requires_refrigeration) as requires_refrigeration,
        SUM(total_stock) as total_stock,
        MIN(earliest_expiry) as earliest_expiry,
        MAX(latest_expiry) as latest_expiry,
        GROUP_CONCAT(DISTINCT product_id) as product_ids
      FROM (${baseQuery}) as grouped_products
      GROUP BY rfid_code
      ORDER BY rfid_code DESC
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
    const products = rows.map(row => ({
      ...row,
      rfid_code: normalizeRfidCode(row.rfid_code) || row.rfid_code,
      rfid_uid: normalizeRfidCode(row.rfid_code) || row.rfid_code,
      concentration: row.concentration ? formatConcentration(row.concentration, row.product_type) : row.concentration,
      total_stock: parseInt(row.total_stock) || 0
    }));

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
      requires_refrigeration, rfid_uid
    } = productData;

    const [result] = await pool.execute(
      `INSERT INTO products 
       (name, description, product_type, active_ingredient, concentration,
        presentation, administration_route, category_id, min_stock,
        requires_refrigeration, rfid_uid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, description || null, product_type || 'medicamento',
        active_ingredient || null, concentration || null,
        presentation || null, administration_route || null,
        category_id || null, min_stock || 5,
        requires_refrigeration || false, rfid_uid || null
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
      'category_id', 'min_stock', 'requires_refrigeration', 'rfid_uid'
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
    return rows;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener lote por ID
 */
async function getBatchById(batchId) {
  try {
    const [rows] = await pool.execute(
      `SELECT pb.*, p.name as product_name, p.min_stock,
              (pb.expiry_date < CURDATE()) as is_expired,
              DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       WHERE pb.id = ?`,
      [batchId]
    );
    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtener lote por RFID UID
 */
async function getBatchByRfidUid(rfidUid) {
  try {
    const [rows] = await pool.execute(
      `SELECT pb.*, p.*, pc.name as category_name,
              (pb.expiry_date < CURDATE()) as is_expired,
              DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE pb.rfid_uid = ?`,
      [rfidUid]
    );
    return rows[0] || null;
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
      `SELECT pb.*, 
              p.id as product_id,
              p.name as product_name,
              p.active_ingredient,
              p.concentration,
              p.presentation,
              p.product_type,
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
       WHERE pb.rfid_uid = ? OR pb.rfid_uid = ?
       ORDER BY pb.expiry_date ASC, p.name ASC`,
      [normalizedRfid, rfidUid] // Buscar tanto el normalizado como el original
    );
    return rows;
  } catch (error) {
    console.error('✗ Error en getBatchesByRfidUid:', error);
    throw error;
  }
}

/**
 * Crear un nuevo lote
 */
async function createBatch(batchData) {
  try {
    const { product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date } = batchData;

    const [result] = await pool.execute(
      `INSERT INTO product_batches 
       (product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [product_id, lot_number, expiry_date, quantity || 0, rfid_uid || null, entry_date || new Date()]
    );
    return await getBatchById(result.insertId);
  } catch (error) {
    throw error;
  }
}

/**
 * Actualizar cantidad de un lote
 */
async function updateBatchQuantity(batchId, newQuantity) {
  try {
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
 * Decrementar stock de un lote (cuando se retira)
 * @param {string} rfidUid - UID del RFID
 * @param {number} quantity - Cantidad a retirar (default: 1)
 * @param {number} areaId - ID del área (opcional)
 * @returns {Promise<Object>} - Lote actualizado
 */
async function decrementBatchStock(rfidUid, quantity = 1, areaId = null) {
  try {
    const batch = await getBatchByRfidUid(rfidUid);

    if (!batch) {
      throw new Error('Lote no encontrado para el UID RFID proporcionado');
    }

    if (batch.is_expired) {
      throw new Error('No se puede retirar un producto vencido');
    }

    if (batch.quantity < quantity) {
      throw new Error(`Stock insuficiente. Disponible: ${batch.quantity}, Requerido: ${quantity}`);
    }

    const previousQuantity = batch.quantity;
    const newQuantity = previousQuantity - quantity;

    // Actualizar cantidad del lote
    await pool.execute(
      'UPDATE product_batches SET quantity = ? WHERE id = ?',
      [newQuantity, batch.id]
    );

    // Registrar en historial
    await pool.execute(
      `INSERT INTO stock_history 
       (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date, notes)
       VALUES (?, ?, ?, ?, ?, 'remove', CURDATE(), ?)`,
      [batch.product_id, batch.id, areaId, previousQuantity, newQuantity, `Retiro de ${quantity} unidades`]
    );

    // Verificar si hay otros lotes más antiguos (FIFO)
    const [olderBatches] = await pool.execute(
      `SELECT id FROM product_batches 
       WHERE product_id = ? AND id != ? AND quantity > 0 
       AND (expiry_date < ? OR (expiry_date = ? AND entry_date < ?))
       LIMIT 1`,
      [batch.product_id, batch.id, batch.expiry_date, batch.expiry_date, batch.entry_date]
    );

    const updatedBatch = await getBatchById(batch.id);
    return {
      ...updatedBatch,
      fifo_warning: olderBatches.length > 0 ? 'Existen lotes más antiguos disponibles' : null
    };
  } catch (error) {
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

    const previousQuantity = batch.quantity;
    const newQuantity = previousQuantity + quantity;

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
      [batch.product_id, batch.id, areaId, previousQuantity, newQuantity, `Ingreso de ${quantity} unidades`]
    );

    const updatedBatch = await getBatchById(batch.id);
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
      SELECT d.*, a.name as area_name
      FROM doctors d
      LEFT JOIN areas a ON d.area_id = a.id
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
      query += ' AND (d.name LIKE ? OR d.license_number LIKE ? OR d.specialty LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
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
      `SELECT d.*, a.name as area_name
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
 * Crear un nuevo doctor
 */
async function createDoctor(doctorData) {
  try {
    const { name, license_number, specialty, area_id, email, phone } = doctorData;
    const [result] = await pool.execute(
      'INSERT INTO doctors (name, license_number, specialty, area_id, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [name, license_number, specialty, area_id, email, phone]
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
    let query = 'SELECT * FROM pharmacists WHERE 1=1';
    const params = [];

    if (filters.search) {
      query += ' AND (name LIKE ? OR id_number LIKE ? OR license_number LIKE ? OR email LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (filters.id_number) {
      query += ' AND id_number = ?';
      params.push(filters.id_number);
    }
    if (filters.license_number) {
      query += ' AND license_number = ?';
      params.push(filters.license_number);
    }
    if (filters.is_active !== undefined) {
      query += ' AND is_active = ?';
      params.push(filters.is_active);
    }

    query += ' ORDER BY name';

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
    const { prescription_code, qr_code, patient_name, patient_id, patient_id_number, 
            doctor_name, doctor_id, doctor_license, prescription_date, notes, created_by } = prescriptionData;
    
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
    
    const placeholders = insertFields.map(() => '?').join(', ');
    const [result] = await pool.execute(
      `INSERT INTO prescriptions (${insertFields.join(', ')}) VALUES (${placeholders})`,
      insertValues
    );
    
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
              u2.username as fulfilled_by_username
       FROM prescriptions p
       LEFT JOIN users u1 ON p.created_by = u1.id
       LEFT JOIN users u2 ON p.fulfilled_by = u2.id
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
    
    // Si hay items, intentar obtener información de lotes para cada producto (opcional)
    for (let i = 0; i < rows.length; i++) {
      try {
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
        console.warn(`⚠️ No se pudo obtener lote para producto ${rows[i].product_id}:`, batchError.message);
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
    const { product_id, quantity_required, instructions } = itemData;
    
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
       (prescription_id, product_id, quantity_required, instructions)
       VALUES (?, ?, ?, ?)`,
      [prescriptionIdNum, productIdNum, quantityNum, instructions || null]
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
async function fulfillPrescriptionItem(prescriptionId, prescriptionItemId, batchId, quantity, userId) {
  try {
    // Actualizar cantidad despachada en prescription_items
    await pool.execute(
      `UPDATE prescription_items 
       SET quantity_dispensed = quantity_dispensed + ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND prescription_id = ?`,
      [quantity, prescriptionItemId, prescriptionId]
    );
    
    // Registrar en prescription_fulfillments
    const [result] = await pool.execute(
      `INSERT INTO prescription_fulfillments 
       (prescription_id, prescription_item_id, batch_id, quantity_dispensed, dispensed_by)
       VALUES (?, ?, ?, ?, ?)`,
      [prescriptionId, prescriptionItemId, batchId, quantity, userId]
    );
    
    // Verificar si la receta está completa
    const [items] = await pool.execute(
      `SELECT quantity_required, quantity_dispensed 
       FROM prescription_items 
       WHERE prescription_id = ?`,
      [prescriptionId]
    );
    
    const allFulfilled = items.every(item => item.quantity_dispensed >= item.quantity_required);
    const someFulfilled = items.some(item => item.quantity_dispensed > 0);
    
    let newStatus = 'pending';
    if (allFulfilled) {
      newStatus = 'fulfilled';
    } else if (someFulfilled) {
      newStatus = 'partial';
    }
    
    // Actualizar estado de la receta
    if (newStatus === 'fulfilled') {
      await pool.execute(
        `UPDATE prescriptions 
         SET status = ?, fulfilled_by = ?, fulfilled_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newStatus, userId, prescriptionId]
      );
    } else {
      await pool.execute(
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
  createBatch,
  updateBatchQuantity,
  decrementBatchStock,
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

