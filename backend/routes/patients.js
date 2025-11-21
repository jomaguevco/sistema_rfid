const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

/**
 * GET /api/patients
 * Obtener todos los pacientes con filtros
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('📋 GET /api/patients - Usuario:', req.user?.username, 'Rol:', req.user?.role);
    const filters = {
      search: req.query.search,
      id_number: req.query.id_number
    };
    
    console.log('🔍 Filtros aplicados:', filters);
    const patients = await db.getAllPatients(filters);
    console.log(`✅ Pacientes encontrados: ${patients.length}`);
    
    res.json({
      success: true,
      data: patients
    });
  } catch (error) {
    console.error('✗ Error al obtener pacientes:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/patients/:id
 * Obtener un paciente por ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const patient = await db.getPatientById(parseInt(req.params.id));
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: patient
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/patients
 * Crear un nuevo paciente
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, id_number, date_of_birth, gender, phone, email, address } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El nombre del paciente es requerido'
      });
    }
    
    const patient = await db.createPatient({
      name: name.trim(),
      id_number: id_number?.trim() || null,
      date_of_birth: date_of_birth || null,
      gender: gender || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      address: address?.trim() || null
    });
    
    res.status(201).json({
      success: true,
      data: patient,
      message: 'Paciente creado correctamente'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Este número de identificación ya está registrado'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/patients/:id
 * Actualizar un paciente
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const patientId = parseInt(req.params.id);
    const existingPatient = await db.getPatientById(patientId);
    
    if (!existingPatient) {
      return res.status(404).json({
        success: false,
        error: 'Paciente no encontrado'
      });
    }
    
    const patientData = {};
    const fields = ['name', 'id_number', 'date_of_birth', 'gender', 'phone', 'email', 'address'];
    
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        patientData[field] = req.body[field]?.trim() || null;
      }
    });
    
    const updatedPatient = await db.updatePatient(patientId, patientData);
    
    res.json({
      success: true,
      data: updatedPatient,
      message: 'Paciente actualizado correctamente'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Este número de identificación ya está registrado'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/patients/:id
 * Eliminar un paciente
 */
router.delete('/:id', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const patientId = parseInt(req.params.id);
    const deleted = await db.deletePatient(patientId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Paciente no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Paciente eliminado correctamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

