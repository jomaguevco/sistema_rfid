const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

/**
 * GET /api/doctors
 * Obtener todos los doctores con filtros
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📋 GET /api/doctors - Usuario:', req.user?.username, 'Rol:', req.user?.role);
    const filters = {
      area_id: req.query.area_id ? parseInt(req.query.area_id) : null,
      specialty: req.query.specialty,
      search: req.query.search,
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined
    };
    
    console.log('🔍 Filtros aplicados:', filters);
    const doctors = await db.getAllDoctors(filters);
    console.log(`✅ Doctores encontrados: ${doctors.length}`);
    
    res.json({
      success: true,
      data: doctors
    });
  } catch (error) {
    console.error('✗ Error al obtener doctores:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/doctors/:id
 * Obtener un doctor por ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const doctor = await db.getDoctorById(parseInt(req.params.id));
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: doctor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/doctors
 * Crear un nuevo doctor
 */
router.post('/', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const { name, license_number, specialty, area_id, email, phone } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El nombre del doctor es requerido'
      });
    }
    
    const doctor = await db.createDoctor({
      name: name.trim(),
      license_number: license_number?.trim() || null,
      specialty: specialty?.trim() || null,
      area_id: area_id ? parseInt(area_id) : null,
      email: email?.trim() || null,
      phone: phone?.trim() || null
    });
    
    res.status(201).json({
      success: true,
      data: doctor,
      message: 'Doctor creado correctamente'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Este número de colegiatura ya está registrado'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/doctors/:id
 * Actualizar un doctor
 */
router.put('/:id', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const doctorId = parseInt(req.params.id);
    const existingDoctor = await db.getDoctorById(doctorId);
    
    if (!existingDoctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor no encontrado'
      });
    }
    
    const doctorData = {};
    const fields = ['name', 'license_number', 'specialty', 'area_id', 'email', 'phone', 'is_active'];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'area_id') {
          doctorData[field] = req.body[field] ? parseInt(req.body[field]) : null;
        } else if (field === 'is_active') {
          doctorData[field] = Boolean(req.body[field]);
        } else {
          doctorData[field] = req.body[field]?.trim() || null;
        }
      }
    });
    
    const updatedDoctor = await db.updateDoctor(doctorId, doctorData);
    
    res.json({
      success: true,
      data: updatedDoctor,
      message: 'Doctor actualizado correctamente'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Este número de colegiatura ya está registrado'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/doctors/:id
 * Eliminar un doctor
 */
router.delete('/:id', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const doctorId = parseInt(req.params.id);
    const deleted = await db.deleteDoctor(doctorId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Doctor no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Doctor eliminado correctamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

