const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

/**
 * GET /api/pharmacists
 * Obtener todos los químicos farmacéuticos con filtros
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📋 GET /api/pharmacists - Usuario:', req.user?.username, 'Rol:', req.user?.role);
    const filters = {
      search: req.query.search,
      id_number: req.query.id_number,
      license_number: req.query.license_number,
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined
    };
    
    console.log('🔍 Filtros aplicados:', filters);
    const pharmacists = await db.getAllPharmacists(filters);
    console.log(`✅ Químicos farmacéuticos encontrados: ${pharmacists.length}`);
    
    res.json({
      success: true,
      data: pharmacists
    });
  } catch (error) {
    console.error('✗ Error al obtener químicos farmacéuticos:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pharmacists/:id
 * Obtener un químico farmacéutico por ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pharmacist = await db.getPharmacistById(parseInt(req.params.id));
    
    if (!pharmacist) {
      return res.status(404).json({
        success: false,
        error: 'Químico farmacéutico no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: pharmacist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/pharmacists
 * Crear un nuevo químico farmacéutico
 */
router.post('/', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const { name, id_number, license_number, email, phone } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El nombre del químico farmacéutico es requerido'
      });
    }
    
    const pharmacist = await db.createPharmacist({
      name: name.trim(),
      id_number: id_number?.trim() || null,
      license_number: license_number?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null
    });
    
    res.status(201).json({
      success: true,
      data: pharmacist,
      message: 'Químico farmacéutico creado correctamente'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Este número de identificación o licencia ya está registrado'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/pharmacists/:id
 * Actualizar un químico farmacéutico
 */
router.put('/:id', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const pharmacistId = parseInt(req.params.id);
    const existingPharmacist = await db.getPharmacistById(pharmacistId);
    
    if (!existingPharmacist) {
      return res.status(404).json({
        success: false,
        error: 'Químico farmacéutico no encontrado'
      });
    }
    
    const pharmacistData = {};
    const fields = ['name', 'id_number', 'license_number', 'email', 'phone', 'is_active'];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'is_active') {
          pharmacistData[field] = Boolean(req.body[field]);
        } else {
          pharmacistData[field] = req.body[field]?.trim() || null;
        }
      }
    });
    
    const updatedPharmacist = await db.updatePharmacist(pharmacistId, pharmacistData);
    
    res.json({
      success: true,
      data: updatedPharmacist,
      message: 'Químico farmacéutico actualizado correctamente'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Este número de identificación o licencia ya está registrado'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/pharmacists/:id
 * Eliminar un químico farmacéutico
 */
router.delete('/:id', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const pharmacistId = parseInt(req.params.id);
    const deleted = await db.deletePharmacist(pharmacistId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Químico farmacéutico no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Químico farmacéutico eliminado correctamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

