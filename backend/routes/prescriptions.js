const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { generatePrescriptionQR, generatePrescriptionCode } = require('../utils/qr');
const { generatePrescriptionImage } = require('../utils/prescriptionImage');
const { authenticateToken } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');

/**
 * POST /api/prescriptions
 * Crear una nueva receta
 * Solo admin puede crear recetas
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Verificar permisos: solo admin y médico pueden crear recetas
    if (req.user?.role !== 'admin' && req.user?.role !== 'medico') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para crear recetas. Solo administradores y médicos pueden crear recetas.'
      });
    }
    
    console.log('📝 POST /api/prescriptions - Usuario:', req.user?.username);
    console.log('📦 Datos recibidos:', JSON.stringify(req.body, null, 2));
    const { patient_name, patient_id, patient_id_number, doctor_name, doctor_id, doctor_license, prescription_date, notes, items } = req.body;

    if ((!patient_name && !patient_id) || (!doctor_name && !doctor_id) || !prescription_date || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: patient_name o patient_id, doctor_name o doctor_id, prescription_date, items'
      });
    }

    // Obtener información del paciente si está registrado
    let finalPatientName = patient_name || '';
    let finalPatientIdNumber = patient_id_number || null;
    let finalPatientId = patient_id ? parseInt(patient_id) : null;
    
    if (finalPatientId && !isNaN(finalPatientId)) {
      try {
        const patient = await db.getPatientById(finalPatientId);
        if (patient) {
          finalPatientName = patient.name || finalPatientName;
          finalPatientIdNumber = patient.id_number || finalPatientIdNumber;
        }
      } catch (patientError) {
        console.warn('⚠️ No se pudo obtener información del paciente:', patientError.message);
        // Continuar con los datos proporcionados
      }
    }

    // Obtener información del doctor si está registrado
    let finalDoctorName = doctor_name || '';
    let finalDoctorLicense = doctor_license || null;
    let finalDoctorId = doctor_id ? parseInt(doctor_id) : null;
    
    if (finalDoctorId && !isNaN(finalDoctorId)) {
      try {
        const doctor = await db.getDoctorById(finalDoctorId);
        if (doctor) {
          finalDoctorName = doctor.name || finalDoctorName;
          finalDoctorLicense = doctor.license_number || finalDoctorLicense;
        }
      } catch (doctorError) {
        console.warn('⚠️ No se pudo obtener información del doctor:', doctorError.message);
        // Continuar con los datos proporcionados
      }
    }

    // Generar código único de receta
    let prescriptionCode = generatePrescriptionCode();
    
    // Verificar que el código no exista
    let existing = await db.getPrescriptionByCode(prescriptionCode);
    while (existing) {
      prescriptionCode = generatePrescriptionCode();
      existing = await db.getPrescriptionByCode(prescriptionCode);
    }

    // Generar QR
    const qrCode = await generatePrescriptionQR(prescriptionCode);

    // Validar que tenemos al menos nombre de paciente y doctor
    if (!finalPatientName || finalPatientName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El nombre del paciente es requerido'
      });
    }
    
    if (!finalDoctorName || finalDoctorName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El nombre del médico es requerido'
      });
    }
    
    // Crear receta
    const prescriptionId = await db.createPrescription({
      prescription_code: prescriptionCode,
      qr_code: qrCode,
      patient_name: finalPatientName.trim(),
      patient_id: finalPatientId,
      patient_id_number: finalPatientIdNumber,
      doctor_name: finalDoctorName.trim(),
      doctor_id: finalDoctorId,
      doctor_license: finalDoctorLicense,
      prescription_date,
      notes: notes || null,
      created_by: req.userId
    });

    // Agregar items
    console.log(`📦 Agregando ${items.length} items a la receta ${prescriptionId}`);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        console.log(`📦 Item ${i + 1}/${items.length}:`, {
          product_id: item.product_id,
          quantity_required: item.quantity_required,
          instructions: item.instructions
        });
        await db.addPrescriptionItem(prescriptionId, {
          product_id: item.product_id,
          quantity_required: item.quantity_required,
          instructions: item.instructions
        });
        console.log(`✅ Item ${i + 1} agregado correctamente`);
      } catch (itemError) {
        console.error(`❌ Error al agregar item ${i + 1}:`, itemError);
        console.error('Item que falló:', item);
        // Continuar con los demás items en lugar de fallar completamente
        // pero registrar el error
        throw new Error(`Error al agregar item ${i + 1}: ${itemError.message}`);
      }
    }
    console.log(`✅ Todos los items agregados correctamente`);

    // Obtener receta completa
    const prescription = await db.getPrescriptionById(prescriptionId);
    const prescriptionItems = await db.getPrescriptionItems(prescriptionId);

    res.json({
      success: true,
      data: {
        ...prescription,
        items: prescriptionItems,
        items_count: prescriptionItems.length
      },
      message: `Receta creada correctamente con código ${prescriptionCode}`,
      qr_code: qrCode,
      prescription_code: prescriptionCode
    });
  } catch (error) {
    console.error('✗ Error al crear receta:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/prescriptions/qr/:code
 * Buscar receta por código QR (para escáner de químico farmacéutico)
 */
router.get('/qr/:code', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario tenga permiso (farmaceutico o admin)
    if (req.user?.role !== 'farmaceutico' && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para escanear recetas. Solo químicos farmacéuticos y administradores pueden escanear recetas.'
      });
    }

    const { code } = req.params;
    
    if (!code || code.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Código de receta requerido'
      });
    }
    
    const prescription = await db.getPrescriptionByCode(code.trim());

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Receta no encontrada'
      });
    }

    // Obtener items de la receta
    let items = [];
    try {
      items = await db.getPrescriptionItems(prescription.id);
    } catch (itemsError) {
      console.error('⚠️ Error al obtener items de receta:', itemsError.message);
      items = [];
    }

    const responseData = {
      ...prescription,
      items: items || [],
      items_count: items ? items.length : 0
    };
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('✗ Error al buscar receta por QR:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al buscar receta'
    });
  }
});

/**
 * GET /api/prescriptions/:code
 * Buscar receta por código o QR
 */
router.get('/:code', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 GET /api/prescriptions/:code - Código:', req.params.code);
    const { code } = req.params;
    
    if (!code || code.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Código de receta requerido'
      });
    }
    
    const prescription = await db.getPrescriptionByCode(code.trim());

    if (!prescription) {
      console.log('❌ Receta no encontrada:', code);
      return res.status(404).json({
        success: false,
        error: 'Receta no encontrada'
      });
    }

    // Si el usuario es médico, solo puede ver sus propias recetas
    if (req.user?.role === 'medico' && prescription.created_by !== req.userId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para ver esta receta. Solo puedes ver tus propias recetas.'
      });
    }

    console.log('✅ Receta encontrada, ID:', prescription.id, 'Tipo:', typeof prescription.id);
    console.log('📋 Datos de receta:', {
      id: prescription.id,
      prescription_code: prescription.prescription_code,
      patient_name: prescription.patient_name
    });
    
    // Obtener teléfono del paciente si tiene patient_id
    let patientPhone = null;
    if (prescription.patient_id) {
      try {
        const patient = await db.getPatientById(prescription.patient_id);
        if (patient && patient.phone) {
          patientPhone = patient.phone;
        }
      } catch (patientError) {
        console.warn('⚠️ No se pudo obtener teléfono del paciente:', patientError.message);
      }
    }
    
    // Obtener items de la receta con manejo de errores
    let items = [];
    try {
      console.log('🔍 Llamando getPrescriptionItems con ID:', prescription.id, 'tipo:', typeof prescription.id);
      items = await db.getPrescriptionItems(prescription.id);
      console.log(`✅ Items encontrados: ${items.length}`);
      if (items.length > 0) {
        console.log('📋 Primeros items:', items.slice(0, 3).map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name || '(sin nombre)',
          quantity_required: item.quantity_required
        })));
      }
    } catch (itemsError) {
      console.error('⚠️ Error al obtener items de receta:', itemsError.message);
      console.error('Stack:', itemsError.stack);
      // Continuar sin items en lugar de fallar completamente
      items = [];
    }

    const responseData = {
      ...prescription,
      items: items || [],
      items_count: items ? items.length : 0,
      patient_phone: patientPhone
    };
    
    console.log('📤 Enviando respuesta con', responseData.items_count, 'items');
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('✗ Error al buscar receta:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/prescriptions/:id/items
 * Obtener items de una receta
 */
router.get('/:id/items', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const items = await db.getPrescriptionItems(parseInt(id));

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error al obtener items de receta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/prescriptions/:id/fulfill
 * Despachar un item de receta
 */
router.put('/:id/fulfill', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { prescription_item_id, batch_id, quantity } = req.body;

    // Validar tipos y valores
    const prescriptionItemId = parseInt(prescription_item_id);
    const batchId = parseInt(batch_id);
    const quantityValue = parseInt(quantity);

    if (!prescription_item_id || !batch_id || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: prescription_item_id, batch_id, quantity'
      });
    }

    if (isNaN(prescriptionItemId) || isNaN(batchId) || isNaN(quantityValue)) {
      return res.status(400).json({
        success: false,
        error: 'Los campos prescription_item_id, batch_id y quantity deben ser números válidos'
      });
    }

    if (quantityValue <= 0) {
      return res.status(400).json({
        success: false,
        error: 'La cantidad debe ser un número mayor a 0'
      });
    }

    // Verificar que el batch existe y tiene stock
    const batch = await db.getBatchById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote no encontrado'
      });
    }

    if (batch.quantity < quantityValue) {
      return res.status(400).json({
        success: false,
        error: `Stock insuficiente. Disponible: ${batch.quantity} unidades individuales, Intento de despachar: ${quantityValue} unidades individuales`
      });
    }

    // Verificar que el item pertenece a la receta
    const items = await db.getPrescriptionItems(parseInt(id));
    const item = items.find(i => i.id === prescriptionItemId);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item de receta no encontrado'
      });
    }

    // Verificar que no se exceda la cantidad requerida (usar valores validados)
    const totalDispensed = (item.quantity_dispensed || 0) + quantityValue;
    if (totalDispensed > item.quantity_required) {
      return res.status(400).json({
        success: false,
        error: `Cantidad excede lo requerido. Requerido: ${item.quantity_required} unidades individuales, Despachado: ${item.quantity_dispensed || 0} unidades individuales, Intento de despachar: ${quantityValue} unidades individuales`
      });
    }

    // Despachar item (usar valores validados)
    await db.fulfillPrescriptionItem(parseInt(id), prescriptionItemId, batchId, quantityValue, req.userId);

    // Retirar stock del lote (usar valores validados)
    await db.decrementBatchStock(batch.rfid_uid, quantityValue, null);

    // Obtener receta actualizada
    const prescription = await db.getPrescriptionById(parseInt(id));
    const updatedItems = await db.getPrescriptionItems(parseInt(id));

    // Calcular stock restante del lote
    const remainingStock = batch.quantity - quantityValue;
    
    res.json({
      success: true,
      data: {
        ...prescription,
        items: updatedItems,
        items_count: updatedItems.length
      },
      message: `Se despacharon ${quantityValue} unidades individuales del medicamento "${item.product_name || 'N/A'}". Stock restante del lote: ${remainingStock} unidades individuales.`,
      quantity_dispensed: quantityValue,
      remaining_stock: remainingStock
    });
  } catch (error) {
    console.error('Error al despachar item:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/prescriptions/:id/send-whatsapp
 * Enviar receta a WhatsApp
 */
router.post('/:id/send-whatsapp', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        error: 'El número de teléfono es requerido'
      });
    }

    // Obtener receta completa
    const prescription = await db.getPrescriptionById(parseInt(id));
    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Receta no encontrada'
      });
    }

    // Obtener items de la receta
    const items = await db.getPrescriptionItems(parseInt(id));

    // Preparar datos de la receta
    const prescriptionData = {
      ...prescription,
      items: items
    };

    // Generar imagen de la receta
    let prescriptionImageBuffer = null;
    try {
      prescriptionImageBuffer = await generatePrescriptionImage(prescriptionData);
      console.log('✅ Imagen de receta generada correctamente');
    } catch (imageError) {
      console.error('⚠️ Error al generar imagen de receta:', imageError.message);
      // Continuar sin imagen, solo enviar QR
    }

    // Obtener imagen QR (ya está en base64 en prescription.qr_code)
    let qrImageBuffer = null;
    if (prescription.qr_code) {
      try {
        // Convertir base64 a buffer
        const base64Data = prescription.qr_code.startsWith('data:image') 
          ? prescription.qr_code.split(',')[1] 
          : prescription.qr_code;
        qrImageBuffer = Buffer.from(base64Data, 'base64');
      } catch (qrError) {
        console.error('⚠️ Error al procesar QR:', qrError.message);
      }
    }

    // Enviar receta a WhatsApp (imagen de receta + QR)
    const result = await whatsappService.sendPrescription(
      phone_number,
      prescriptionData,
      prescriptionImageBuffer,
      qrImageBuffer
    );

    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'Receta enviada correctamente a WhatsApp',
        data: {
          prescription_code: prescription.prescription_code,
          phone_number: phone_number
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Error al enviar receta a WhatsApp'
      });
    }
  } catch (error) {
    console.error('Error al enviar receta a WhatsApp:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al enviar receta a WhatsApp'
    });
  }
});

/**
 * PUT /api/prescriptions/:id
 * Actualizar estado de una receta (cancelar)
 * Solo admin puede cancelar recetas
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario no sea químico/farmacéutico
    if (req.user?.role === 'farmaceutico') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para cancelar recetas. Solo los administradores pueden cancelar recetas.'
      });
    }
    
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'El campo status es requerido'
      });
    }
    
    // Validar que el status sea válido
    const validStatuses = ['pending', 'partial', 'fulfilled', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Status inválido. Valores permitidos: ${validStatuses.join(', ')}`
      });
    }
    
    // Obtener la receta actual
    const prescription = await db.getPrescriptionById(parseInt(id));
    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Receta no encontrada'
      });
    }
    
    // Actualizar el estado
    await db.pool.execute(
      `UPDATE prescriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, parseInt(id)]
    );
    
    // Obtener la receta actualizada
    const updatedPrescription = await db.getPrescriptionById(parseInt(id));
    
    res.json({
      success: true,
      data: updatedPrescription,
      message: `Receta ${status === 'cancelled' ? 'cancelada' : 'actualizada'} correctamente`
    });
  } catch (error) {
    console.error('Error al actualizar receta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/prescriptions
 * Listar recetas con filtros
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      patient_name: req.query.patient_name,
      prescription_code: req.query.prescription_code || req.query.search, // Soporta 'search' como alias
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      doctor_name: req.query.doctor_name,
      limit: req.query.limit || 50,
      offset: req.query.offset || 0
    };

    // Si el usuario es médico, solo mostrar sus propias recetas
    if (req.user?.role === 'medico') {
      filters.created_by = req.userId;
    }
    // Si es admin o farmaceutico, mostrar todas (sin filtro created_by)

    const prescriptions = await db.getAllPrescriptions(filters);

    res.json({
      success: true,
      data: prescriptions
    });
  } catch (error) {
    console.error('Error al listar recetas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

