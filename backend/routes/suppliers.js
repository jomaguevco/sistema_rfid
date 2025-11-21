const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/suppliers
 * Obtener todos los proveedores
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const includeInactive = req.query.all === 'true';
    const suppliers = await db.getAllSuppliers(includeInactive);
    res.json({
      success: true,
      data: suppliers
    });
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({
      success: false,
      error: `Error al obtener proveedores: ${error.message}`
    });
  }
});

/**
 * GET /api/suppliers/:id
 * Obtener proveedor por ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const supplier = await db.getSupplierById(req.params.id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Proveedor no encontrado'
      });
    }
    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({
      success: false,
      error: `Error al obtener proveedor: ${error.message}`
    });
  }
});

/**
 * POST /api/suppliers
 * Crear nuevo proveedor
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, contact_person, email, phone, address, tax_id, notes, is_active } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'El nombre del proveedor es requerido'
      });
    }
    
    const supplier = await db.createSupplier({
      name,
      contact_person,
      email,
      phone,
      address,
      tax_id,
      notes,
      is_active
    });
    
    res.status(201).json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    res.status(500).json({
      success: false,
      error: `Error al crear proveedor: ${error.message}`
    });
  }
});

/**
 * PUT /api/suppliers/:id
 * Actualizar proveedor
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const supplier = await db.updateSupplier(req.params.id, req.body);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Proveedor no encontrado'
      });
    }
    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    res.status(500).json({
      success: false,
      error: `Error al actualizar proveedor: ${error.message}`
    });
  }
});

/**
 * DELETE /api/suppliers/:id
 * Eliminar (desactivar) proveedor
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await db.deleteSupplier(req.params.id);
    res.json({
      success: true,
      message: 'Proveedor eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    res.status(500).json({
      success: false,
      error: `Error al eliminar proveedor: ${error.message}`
    });
  }
});

module.exports = router;

