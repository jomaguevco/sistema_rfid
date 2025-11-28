const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { sensitiveOperationLimiter } = require('../middleware/rateLimiter');
const { validateProduct, validateId } = require('../middleware/validation');
const { paginate, createPaginatedResponse } = require('../middleware/pagination');
const { authenticateToken } = require('../middleware/auth');

/**
 * Helper para filtrar información de stock según rol
 * Admin y farmaceutico pueden ver información de stock
 */
function filterStockForRole(data, userRole) {
  if (userRole === 'admin' || userRole === 'farmaceutico') {
    return data;
  }
  
  // Si es un array, filtrar cada elemento
  if (Array.isArray(data)) {
    return data.map(item => {
      const { total_stock, stock_available, ...itemWithoutStock } = item;
      return itemWithoutStock;
    });
  }
  
  // Si es un objeto, filtrar campos de stock
  const { total_stock, stock_available, ...dataWithoutStock } = data;
  return dataWithoutStock;
}

/**
 * GET /api/products
 * Obtener todos los productos con filtros y paginación
 */
router.get('/', paginate, authenticateToken, async (req, res) => {
  try {
    // Log silencioso - solo para debugging si es necesario
    const filters = {
      product_type: req.query.product_type,
      category_id: req.query.category_id ? parseInt(req.query.category_id) : null,
      search: req.query.search,
      active_ingredient: req.query.active_ingredient,
      rfid_uid: req.query.rfid_uid,
      expiry_status: req.query.expiry_status,
      low_stock: req.query.low_stock === 'true',
      min_stock: req.query.min_stock,
      max_stock: req.query.max_stock,
      requires_refrigeration: req.query.requires_refrigeration === 'true' ? true : req.query.requires_refrigeration === 'false' ? false : undefined,
      limit: req.pagination.limit,
      offset: req.pagination.offset
    };
    
    const { products, total } = await db.getAllProductsPaginated(filters);
    
    // Log para debugging: mostrar stock de algunos productos
    if (products.length > 0) {
      console.log(`📊 [GET /products] Retornando ${products.length} productos. Ejemplos de stock:`);
      products.slice(0, 3).forEach(p => {
        console.log(`   - ${p.name}: total_stock = ${p.total_stock}`);
      });
    }
    
    // Filtrar información de stock según rol
    const filteredProducts = filterStockForRole(products, req.user?.role);
    
    res.json(createPaginatedResponse(filteredProducts, total, req.pagination));
  } catch (error) {
    console.error('✗ Error en GET /api/products:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/products/catalog
 * Obtener catálogo de productos (sin agrupar por RFID, para administración)
 */
router.get('/catalog', paginate, authenticateToken, async (req, res) => {
  try {
    // Log silencioso - solo para debugging si es necesario
    const filters = {
      product_type: req.query.product_type,
      category_id: req.query.category_id ? parseInt(req.query.category_id) : null,
      search: req.query.search,
      active_ingredient: req.query.active_ingredient,
      limit: req.pagination.limit,
      offset: req.pagination.offset
    };
    
    // Primero obtener total sin límite
    const allProducts = await db.getAllProducts({
      ...filters,
      limit: undefined,
      offset: undefined
    });
    const total = allProducts.length;
    
    // Luego obtener productos paginados
    const products = await db.getAllProducts(filters);
    
    // Filtrar información de stock según rol
    const filteredProducts = filterStockForRole(products, req.user?.role);
    
    res.json(createPaginatedResponse(filteredProducts, total, req.pagination));
  } catch (error) {
    console.error('✗ Error en GET /api/products/catalog:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/products/:id
 * Obtener un producto por ID
 */
router.get('/:id', validateId, authenticateToken, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const product = await db.getProductById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }
    
    // Filtrar información de stock según rol
    const filteredProduct = filterStockForRole(product, req.user?.role);
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Crear un nuevo producto médico
 *     tags: [Productos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - product_type
 *             properties:
 *               name:
 *                 type: string
 *               product_type:
 *                 type: string
 *                 enum: [medicamento, insumo]
 *               active_ingredient:
 *                 type: string
 *               concentration:
 *                 type: string
 *               category_id:
 *                 type: integer
 *               min_stock:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Producto creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', sensitiveOperationLimiter, validateProduct, async (req, res) => {
  try {
    const {
      name, description, product_type, active_ingredient, concentration,
      presentation, administration_route, category_id, min_stock,
      requires_refrigeration, rfid_uid, units_per_package
    } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El nombre del producto es requerido'
      });
    }
    
    const productData = {
      name: name.trim(),
      description: description || null,
      product_type: product_type || 'medicamento',
      active_ingredient: active_ingredient || null,
      concentration: concentration || null,
      presentation: presentation || null,
      administration_route: administration_route || null,
      category_id: category_id || null,
      min_stock: parseInt(min_stock) || 5,
      requires_refrigeration: requires_refrigeration || false,
      rfid_uid: rfid_uid || null,
      units_per_package: parseInt(units_per_package) || 1
    };
    
    const product = await db.createProduct(productData);
    
    res.status(201).json({
      success: true,
      data: product,
      message: 'Producto creado correctamente'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Este tag RFID ya está asignado a otro producto'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/products/:id
 * Actualizar un producto
 */
router.put('/:id', sensitiveOperationLimiter, validateId, validateProduct, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const existingProduct = await db.getProductById(productId);
    
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }
    
    const productData = {};
    const fields = [
      'name', 'description', 'product_type', 'active_ingredient',
      'concentration', 'presentation', 'administration_route',
      'category_id', 'min_stock', 'requires_refrigeration', 'rfid_uid', 'units_per_package'
    ];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'min_stock' || field === 'category_id' || field === 'units_per_package') {
          productData[field] = parseInt(req.body[field]) || (field === 'units_per_package' ? 1 : null);
        } else if (field === 'requires_refrigeration') {
          productData[field] = Boolean(req.body[field]);
        } else {
          productData[field] = req.body[field];
        }
      }
    });
    
    const updatedProduct = await db.updateProduct(productId, productData);
    
    res.json({
      success: true,
      data: updatedProduct,
      message: 'Producto actualizado correctamente'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Este tag RFID ya está asignado a otro producto'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/products/:id
 * Eliminar un producto
 */
router.delete('/:id', sensitiveOperationLimiter, validateId, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const deleted = await db.deleteProduct(productId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Producto eliminado correctamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/products/:id/history
 * Obtener historial de stock de un producto
 */
router.get('/:id/history', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const filters = {
      area_id: req.query.area_id ? parseInt(req.query.area_id) : null,
      start_date: req.query.start_date || null,
      end_date: req.query.end_date || null
    };
    const history = await db.getStockHistory(productId, filters);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/products/search?q=
 * Búsqueda unificada de productos (RFID, barcode, código, nombre)
 */
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Parámetro de búsqueda requerido: q'
      });
    }

    const products = await db.searchProductByAny(query.trim());
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/products/by-rfid/:rfid
 * Buscar producto por RFID específico
 */
router.get('/by-rfid/:rfid', async (req, res) => {
  try {
    const rfidUid = req.params.rfid.toUpperCase().trim();
    const product = await db.getProductByRfid(rfidUid);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado para el RFID proporcionado'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/products/by-barcode/:barcode
 * Buscar producto por código de barras
 */
router.get('/by-barcode/:barcode', async (req, res) => {
  try {
    const barcode = req.params.barcode.trim();
    const product = await db.getProductByBarcode(barcode);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado para el código de barras proporcionado'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

