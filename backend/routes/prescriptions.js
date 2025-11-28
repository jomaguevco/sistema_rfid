const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { generatePrescriptionQR, generatePrescriptionCode } = require('../utils/qr');
let generatePrescriptionImage;
try {
  const prescriptionImageModule = require('../utils/prescriptionImage');
  generatePrescriptionImage = prescriptionImageModule.generatePrescriptionImage;
} catch (error) {
  console.warn('⚠️  No se pudo cargar el módulo de generación de imágenes de recetas:', error.message);
  generatePrescriptionImage = null;
}
const { authenticateToken } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');
const businessRules = require('../config/businessRules');

/**
 * POST /api/prescriptions
 * Crear una nueva receta
 * Solo admin puede crear recetas
 * ⚠️ OPERACIÓN CRÍTICA: Usa transacción de base de datos
 */
router.post('/', authenticateToken, async (req, res) => {
  // Obtener conexión del pool para usar transacción
  const connection = await db.pool.getConnection();
  
  try {
    // Verificar permisos: solo admin y médico pueden crear recetas
    if (req.user?.role !== 'admin' && req.user?.role !== 'medico') {
      connection.release();
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para crear recetas. Solo administradores y médicos pueden crear recetas.'
      });
    }
    
    console.log('📝 POST /api/prescriptions - Usuario:', req.user?.username);
    console.log('📦 Datos recibidos:', JSON.stringify(req.body, null, 2));
    const { patient_name, patient_id, patient_id_number, patient_phone,
            doctor_name, doctor_id, doctor_license, prescription_date, notes, items,
            specialty, service, attention_type } = req.body;

    if ((!patient_name && !patient_id) || (!doctor_name && !doctor_id) || !prescription_date || !items || items.length === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: patient_name o patient_id, doctor_name o doctor_id, prescription_date, items'
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDACIONES DE NEGOCIO - CREAR RECETA
    // ═══════════════════════════════════════════════════════════════════════════

    // Validar que la fecha de receta no sea futura
    const prescriptionDateObj = new Date(prescription_date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Fin del día
    
    if (prescriptionDateObj > today) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.PRESCRIPTION_DATE_FUTURE
      });
    }

    // Validar cantidad máxima de items
    if (items.length > businessRules.MAX_ITEMS_PER_PRESCRIPTION) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: businessRules.formatErrorMessage(
          businessRules.ERROR_MESSAGES.PRESCRIPTION_TOO_MANY_ITEMS,
          { max: businessRules.MAX_ITEMS_PER_PRESCRIPTION }
        )
      });
    }

    // Validar cada item: producto existe y cantidad válida
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Validar que quantity_required sea positivo
      const qty = parseInt(item.quantity_required, 10);
      if (isNaN(qty) || qty < businessRules.MIN_QUANTITY) {
        connection.release();
        return res.status(400).json({
          success: false,
          error: `Item ${i + 1}: ${businessRules.ERROR_MESSAGES.QUANTITY_INVALID}`
        });
      }
      
      if (qty > businessRules.MAX_QUANTITY_PER_OPERATION) {
        connection.release();
        return res.status(400).json({
          success: false,
          error: `Item ${i + 1}: ${businessRules.formatErrorMessage(
            businessRules.ERROR_MESSAGES.QUANTITY_EXCEEDS_MAX,
            { max: businessRules.MAX_QUANTITY_PER_OPERATION }
          )}`
        });
      }

      // Validar que el producto exista
      if (item.product_id) {
        try {
          const product = await db.getProductById(parseInt(item.product_id, 10));
          if (!product) {
            connection.release();
            return res.status(400).json({
              success: false,
              error: `Item ${i + 1}: Producto con ID ${item.product_id} no encontrado.`
            });
          }
        } catch (productErr) {
          console.warn(`⚠️ Error al verificar producto ${item.product_id}:`, productErr.message);
        }
      }
    }

    // Obtener información del paciente si está registrado
    let finalPatientName = patient_name || '';
    let finalPatientIdNumber = patient_id_number || null;
    let finalPatientId = null;
    
    // Validar y parsear patient_id de forma segura
    if (patient_id) {
      const parsedId = parseInt(patient_id, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        finalPatientId = parsedId;
      }
    }
    
    if (finalPatientId) {
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
    let finalDoctorId = null;
    let doctorSpecialty = null;
    
    if (req.user?.role === 'medico') {
      try {
        let doctorProfile = null;
        if (req.user?.email) {
          doctorProfile = await db.getDoctorByEmail(req.user.email);
        }
        if (!doctorProfile && req.user?.username) {
          doctorProfile = await db.getDoctorByNormalizedUsername(req.user.username);
        }

        if (!doctorProfile) {
          connection.release();
          return res.status(400).json({
            success: false,
            error: 'No se encontró un perfil médico asociado a tu usuario. Solicita al administrador que vincule tus datos.'
          });
        }

        finalDoctorId = doctorProfile.id || null;
        finalDoctorName = doctorProfile.name || doctorProfile.username || finalDoctorName;
        finalDoctorLicense = doctorProfile.license_number || finalDoctorLicense;
        doctorSpecialty = doctorProfile.specialty || null;
      } catch (profileError) {
        connection.release();
        console.error('✗ Error al obtener el perfil del médico autenticado:', profileError);
        return res.status(500).json({
          success: false,
          error: 'No se pudo obtener la información del médico autenticado',
          details: process.env.NODE_ENV === 'development' ? profileError.message : undefined
        });
      }
    } else {
      // Validar y parsear doctor_id de forma segura (para administradores)
      if (doctor_id) {
        const parsedId = parseInt(doctor_id, 10);
        if (!isNaN(parsedId) && parsedId > 0) {
          finalDoctorId = parsedId;
        }
      }
      
      if (finalDoctorId) {
        try {
          const doctor = await db.getDoctorById(finalDoctorId);
          if (doctor) {
            finalDoctorName = doctor.name || finalDoctorName;
            finalDoctorLicense = doctor.license_number || finalDoctorLicense;
            doctorSpecialty = doctor.specialty || null;
          }
        } catch (doctorError) {
          console.warn('⚠️ No se pudo obtener información del doctor:', doctorError.message);
          // Continuar con los datos proporcionados
        }
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
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'El nombre del paciente es requerido'
      });
    }
    
    if (!finalDoctorName || finalDoctorName.trim() === '') {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'El nombre del médico es requerido'
      });
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // INICIO DE TRANSACCIÓN - Crear receta con todos sus items de forma atómica
    // ═══════════════════════════════════════════════════════════════════════════
    await connection.beginTransaction();
    console.log('🔄 Transacción iniciada para crear receta');
    
    // Crear receta
    const prescriptionId = await db.createPrescription({
      prescription_code: prescriptionCode,
      qr_code: qrCode,
      patient_name: finalPatientName.trim(),
      patient_id: finalPatientId,
      patient_id_number: finalPatientIdNumber,
      patient_phone: patient_phone || null,
      doctor_name: finalDoctorName.trim(),
      doctor_id: finalDoctorId,
      doctor_license: finalDoctorLicense,
      prescription_date,
      notes: notes || null,
      created_by: req.userId,
      // Nuevos campos de formato institucional
      specialty: specialty || doctorSpecialty || null,
      service: service || 'Farmacia Consulta Externa',
      attention_type: attention_type || 'Consulta Externa'
    });

    // Agregar items
    console.log(`📦 Agregando ${items.length} items a la receta ${prescriptionId}`);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        console.log(`📦 Item ${i + 1}/${items.length}:`, {
          product_id: item.product_id,
          quantity_required: item.quantity_required,
          instructions: item.instructions,
          administration_route: item.administration_route,
          dosage: item.dosage,
          duration: item.duration
        });
        await db.addPrescriptionItem(prescriptionId, {
          product_id: item.product_id,
          quantity_required: item.quantity_required,
          instructions: item.instructions,
          // Nuevos campos de formato institucional
          administration_route: item.administration_route || 'Oral',
          dosage: item.dosage || null,
          duration: item.duration || null,
          item_code: item.item_code || null
        });
        console.log(`✅ Item ${i + 1} agregado correctamente`);
      } catch (itemError) {
        console.error(`❌ Error al agregar item ${i + 1}:`, itemError);
        console.error('Item que falló:', item);
        // Hacer rollback de la transacción
        await connection.rollback();
        console.log('⚠️ Transacción revertida por error en item');
        throw new Error(`Error al agregar item ${i + 1}: ${itemError.message}`);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // COMMIT DE TRANSACCIÓN - Todos los items agregados correctamente
    // ═══════════════════════════════════════════════════════════════════════════
    await connection.commit();
    console.log('✅ Transacción completada exitosamente - Receta y todos los items creados');

    // Obtener receta completa
    const prescription = await db.getPrescriptionById(prescriptionId);
    const prescriptionItems = await db.getPrescriptionItems(prescriptionId);

    // Filtrar información de stock según rol (solo admin puede ver stock)
    const canSeeStock = req.user?.role === 'admin' || req.user?.role === 'farmaceutico';

    const filteredItems = canSeeStock 
      ? prescriptionItems 
      : prescriptionItems.map(item => {
          const { stock_available, ...itemWithoutStock } = item;
          return {
            ...itemWithoutStock,
            // Mantener is_out_of_stock para mostrar advertencias, pero no el número exacto
            is_out_of_stock: item.is_out_of_stock || false
          };
        });

    res.json({
      success: true,
      data: {
        ...prescription,
        items: filteredItems,
        items_count: filteredItems.length
      },
      message: `Receta creada correctamente con código ${prescriptionCode}`,
      qr_code: qrCode,
      prescription_code: prescriptionCode
    });
  } catch (error) {
    // Intentar rollback si la transacción estaba activa
    try {
      await connection.rollback();
      console.log('⚠️ Transacción revertida por error general');
    } catch (rollbackError) {
      // Ignorar error de rollback si la transacción no estaba activa
    }
    
    console.error('✗ Error al crear receta:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    // Siempre liberar la conexión al pool
    connection.release();
    console.log('🔓 Conexión liberada al pool');
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

    const canSeeStock = req.user?.role === 'admin' || req.user?.role === 'farmaceutico';

    // Obtener items de la receta
    let items = [];
    try {
      items = await db.getPrescriptionItems(prescription.id);
    } catch (itemsError) {
      console.error('⚠️ Error al obtener items de receta:', itemsError.message);
      items = [];
    }

    // Filtrar información de stock según rol (solo admin puede ver stock)
    const filteredItems = canSeeStock 
      ? items 
      : items.map(item => {
          const { stock_available, ...itemWithoutStock } = item;
          return {
            ...itemWithoutStock,
            is_out_of_stock: item.is_out_of_stock || false
          };
        });

    const responseData = {
      ...prescription,
      items: filteredItems || [],
      items_count: filteredItems ? filteredItems.length : 0
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
      patient_name: prescription.patient_name,
      patient_dni: prescription.patient_dni,
      doctor_specialty: prescription.doctor_specialty
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
    
    const canSeeStock = req.user?.role === 'admin' || req.user?.role === 'farmaceutico';

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

    // Filtrar información de stock según rol (solo admin puede ver stock)
    const filteredItems = canSeeStock 
      ? items 
      : items.map(item => {
          const { stock_available, ...itemWithoutStock } = item;
          return {
            ...itemWithoutStock,
            is_out_of_stock: item.is_out_of_stock || false
          };
        });

    const responseData = {
      ...prescription,
      items: filteredItems || [],
      items_count: filteredItems ? filteredItems.length : 0,
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

    // Filtrar información de stock según rol (solo admin puede ver stock)
    const canSeeStock = req.user?.role === 'admin' || req.user?.role === 'farmaceutico';
    const filteredItems = canSeeStock 
      ? items 
      : items.map(item => {
          const { stock_available, ...itemWithoutStock } = item;
          return {
            ...itemWithoutStock,
            is_out_of_stock: item.is_out_of_stock || false
          };
        });

    res.json({
      success: true,
      data: filteredItems
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
 * ⚠️ OPERACIÓN CRÍTICA: Usa transacción de base de datos
 */
router.put('/:id/fulfill', authenticateToken, async (req, res) => {
  // Obtener conexión del pool para usar transacción
  const connection = await db.pool.getConnection();
  
  try {
    const { id } = req.params;
    const { prescription_item_id, batch_id, quantity } = req.body;

    // Validar tipos y valores de forma segura
    const prescriptionItemId = parseInt(prescription_item_id, 10);
    const batchId = parseInt(batch_id, 10);
    const quantityValue = parseInt(quantity, 10);

    if (!prescription_item_id || !batch_id || !quantity) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: prescription_item_id, batch_id, quantity'
      });
    }

    // Validar que todos los valores sean números válidos y positivos
    if (isNaN(prescriptionItemId) || prescriptionItemId <= 0 ||
        isNaN(batchId) || batchId <= 0 ||
        isNaN(quantityValue) || quantityValue <= 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Los campos prescription_item_id, batch_id y quantity deben ser números válidos'
      });
    }

    if (quantityValue <= 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'La cantidad debe ser un número mayor a 0'
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDACIONES DE NEGOCIO - DESPACHAR RECETA
    // ═══════════════════════════════════════════════════════════════════════════

    // Obtener la receta para validaciones
    const prescription = await db.getPrescriptionById(parseInt(id));
    if (!prescription) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Receta no encontrada'
      });
    }

    // Validar que la receta no esté cancelada
    if (prescription.status === 'cancelled') {
      connection.release();
      return res.status(400).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.PRESCRIPTION_CANCELLED
      });
    }

    // Validar que la receta no esté ya completamente despachada
    if (prescription.status === 'fulfilled') {
      connection.release();
      return res.status(400).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.PRESCRIPTION_FULFILLED
      });
    }

    // Validar vigencia de la receta (30 días por defecto)
    if (businessRules.isPrescriptionExpired(prescription.prescription_date)) {
      const remainingDays = businessRules.getPrescriptionRemainingDays(prescription.prescription_date);
      connection.release();
      return res.status(400).json({
        success: false,
        error: businessRules.formatErrorMessage(
          businessRules.ERROR_MESSAGES.PRESCRIPTION_EXPIRED,
          { days: businessRules.PRESCRIPTION_VALIDITY_DAYS }
        ),
        prescription_date: prescription.prescription_date,
        days_expired: Math.abs(remainingDays)
      });
    }

    // Verificar que el batch existe y tiene stock
    const batch = await db.getBatchById(batchId);
    if (!batch) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Lote no encontrado'
      });
    }

    // Validar que el lote no esté vencido
    if (!businessRules.ALLOW_EXPIRED_BATCH_DISPATCH && businessRules.isBatchExpired(batch.expiry_date)) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.BATCH_EXPIRED,
        batch_expiry_date: batch.expiry_date,
        days_expired: Math.abs(businessRules.getDaysUntilExpiry(batch.expiry_date))
      });
    }

    // Verificar si el medicamento está agotado
    if (batch.quantity === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Medicamento agotado',
        message: 'Este medicamento está agotado. No se puede despachar hasta que se renueve stock.',
        is_out_of_stock: true
      });
    }

    // Verificar que el item pertenece a la receta
    const items = await db.getPrescriptionItems(parseInt(id));
    const item = items.find(i => i.id === prescriptionItemId);
    
    if (!item) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Item de receta no encontrado'
      });
    }

    // ✅ VALIDACIÓN CRÍTICA: Verificar que el batch pertenezca al producto del item
    if (batch.product_id !== item.product_id) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'El lote especificado no corresponde al producto de la prescripción',
        message: `El lote pertenece al producto ID ${batch.product_id}, pero el item requiere el producto ID ${item.product_id}`
      });
    }

    // Calcular cantidad restante por despachar
    const quantityAlreadyDispensed = item.quantity_dispensed || 0;
    const quantityRemaining = item.quantity_required - quantityAlreadyDispensed;

    // Verificar que aún falte cantidad por despachar
    if (quantityRemaining <= 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: `Este medicamento ya ha sido completado. Requerido: ${item.quantity_required} unidades individuales, Despachado: ${quantityAlreadyDispensed} unidades individuales.`
      });
    }

    // Verificar que no se exceda la cantidad requerida total
    const totalDispensed = quantityAlreadyDispensed + quantityValue;
    if (totalDispensed > item.quantity_required) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: `Cantidad excede lo requerido. Requerido: ${item.quantity_required} unidades individuales, Despachado: ${quantityAlreadyDispensed} unidades individuales, Faltan: ${quantityRemaining} unidades individuales, Intento de despachar: ${quantityValue} unidades individuales`
      });
    }

    // Permitir despacho parcial: ajustar cantidad a despachar si hay stock disponible pero insuficiente
    let actualQuantityToDispense = quantityValue;
    let isPartialDispatch = false;

    if (batch.quantity < quantityValue) {
      // Hay stock disponible pero es menor que lo solicitado
      // Despachar solo lo disponible (despacho parcial)
      actualQuantityToDispense = Math.min(batch.quantity, quantityRemaining);
      isPartialDispatch = true;
      
      if (actualQuantityToDispense <= 0) {
        connection.release();
        return res.status(400).json({
          success: false,
          error: `Stock insuficiente. Disponible: ${batch.quantity} unidades individuales, pero ya se despachó todo lo requerido (${quantityAlreadyDispensed}/${item.quantity_required})`
        });
      }
    } else {
      // Hay stock suficiente, pero verificar que no exceda lo requerido
      actualQuantityToDispense = Math.min(quantityValue, quantityRemaining);
      if (actualQuantityToDispense < quantityValue) {
        isPartialDispatch = true;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INICIO DE TRANSACCIÓN - Despachar item y decrementar stock de forma atómica
    // ═══════════════════════════════════════════════════════════════════════════
    await connection.beginTransaction();
    console.log('🔄 Transacción iniciada para despacho de receta');
    
    // Despachar item (usar cantidad ajustada para despacho parcial) - PASANDO LA CONEXIÓN DE TRANSACCIÓN
    await db.fulfillPrescriptionItem(parseInt(id), prescriptionItemId, batchId, actualQuantityToDispense, req.userId, connection);

    // Retirar stock del lote (usar cantidad ajustada) - PASANDO LA CONEXIÓN DE TRANSACCIÓN
    const decrementResult = await db.decrementBatchStock(batch.rfid_uid, actualQuantityToDispense, null, connection);
    
    // Obtener el product_id correcto del batch que se descontó
    // decrementResult contiene el batch actualizado después del descuento
    const actualProductId = decrementResult?.product_id || batch.product_id;
    const actualBatchId = decrementResult?.id || batchId;
    
    console.log(`📊 [FULFILL] Batch descontado - Batch ID: ${actualBatchId}, Product ID: ${actualProductId}, RFID: ${batch.rfid_uid}`);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // COMMIT DE TRANSACCIÓN - Despacho y decremento de stock completados
    // ═══════════════════════════════════════════════════════════════════════════
    await connection.commit();
    console.log('✅ Transacción de despacho completada exitosamente');

    // ═══════════════════════════════════════════════════════════════════════════
    // CALCULAR STOCK TOTAL DESPUÉS DEL COMMIT - Usar query directa para asegurar datos actualizados
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`📊 [FULFILL] Calculando stock total del producto después del commit. Product ID: ${actualProductId}`);
    
    // Esperar un momento para asegurar que el commit se haya propagado
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Usar query directa para calcular stock total (después del commit, los datos están actualizados)
    // Usar una nueva conexión del pool para leer después del commit
    let totalProductStock = 0;
    let batchStock = 0;
    const tempConnection = await db.pool.getConnection();
    try {
      const [stockTotalRows] = await tempConnection.execute(
        'SELECT COALESCE(SUM(quantity), 0) as total_stock FROM product_batches WHERE product_id = ?',
        [actualProductId]
      );
      totalProductStock = parseInt(stockTotalRows[0]?.total_stock || 0);
      console.log(`📊 [FULFILL] Stock total calculado después del commit: ${totalProductStock} unidades (Product ID: ${actualProductId})`);
      
      // Verificar también el stock del batch específico que se descontó
      const [batchStockRows] = await tempConnection.execute(
        'SELECT quantity, rfid_uid, lot_number FROM product_batches WHERE id = ?',
        [actualBatchId]
      );
      if (batchStockRows.length > 0) {
        batchStock = batchStockRows[0].quantity || 0;
        console.log(`📊 [FULFILL] Stock del batch específico (ID: ${actualBatchId}, RFID: ${batchStockRows[0].rfid_uid}, Lote: ${batchStockRows[0].lot_number}): ${batchStock} unidades`);
      }
    } finally {
      tempConnection.release();
    }

    // Obtener receta actualizada
    const updatedPrescription = await db.getPrescriptionById(parseInt(id));
    const updatedItems = await db.getPrescriptionItems(parseInt(id));

    // ✅ Obtener el batch actualizado para mostrar el stock correcto
    // El stock puede haber cambiado si se descontó de múltiples lotes
    const updatedBatchInfo = await db.getBatchById(actualBatchId);
    const remainingStock = updatedBatchInfo ? updatedBatchInfo.quantity : 0;
    
    console.log(`📊 [FULFILL] Batch actualizado - ID: ${actualBatchId}, RFID: ${updatedBatchInfo?.rfid_uid || batch.rfid_uid}, Lote: ${updatedBatchInfo?.lot_number || 'N/A'}, Stock restante: ${remainingStock}`);
    
    // Verificar que el cálculo manual coincida con el cálculo de getProductBatches
    const allProductBatches = await db.getProductBatches(actualProductId);
    const manualTotalStock = allProductBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    
    if (totalProductStock !== manualTotalStock) {
      console.warn(`⚠️ [FULFILL] Discrepancia en cálculo de stock: Query directa=${totalProductStock}, Manual=${manualTotalStock}`);
    }
    
    // Filtrar información de stock según rol
    const canSeeStock = req.user?.role === 'admin' || req.user?.role === 'farmaceutico';
    const filteredItems = canSeeStock 
      ? updatedItems 
      : updatedItems.map(item => {
          const { stock_available, ...itemWithoutStock } = item;
          return {
            ...itemWithoutStock,
            is_out_of_stock: item.is_out_of_stock || false
          };
        });
    
    // Construir mensaje según si fue despacho parcial o completo
    let dispatchMessage = `Se despacharon ${actualQuantityToDispense} unidades individuales del medicamento "${item.product_name || 'N/A'}".`;
    
    if (isPartialDispatch) {
      const totalDispensedNow = quantityAlreadyDispensed + actualQuantityToDispense;
      const stillPending = item.quantity_required - totalDispensedNow;
      dispatchMessage += ` Despacho parcial: aún faltan ${stillPending} unidades por despachar de las ${item.quantity_required} requeridas.`;
      
      if (batch.quantity < quantityValue) {
        dispatchMessage += ` Solo había ${batch.quantity} unidades disponibles en stock.`;
      }
    } else {
      const totalDispensedNow = quantityAlreadyDispensed + actualQuantityToDispense;
      if (totalDispensedNow >= item.quantity_required) {
        dispatchMessage += ` Receta completada para este medicamento.`;
      }
    }
    
    // Construir respuesta según rol
    const responseData = {
      success: true,
      data: {
        ...updatedPrescription,
        items: filteredItems,
        items_count: filteredItems.length
      },
      message: dispatchMessage,
      quantity_dispensed: actualQuantityToDispense,
      is_partial_dispatch: isPartialDispatch
    };
    
    // Solo incluir remaining_stock si es admin
    if (canSeeStock) {
      responseData.message += ` Stock restante del lote (ID: ${actualBatchId}, RFID: ${batch.rfid_uid}): ${remainingStock} unidades individuales.`;
      responseData.message += ` Stock total del producto: ${totalProductStock} unidades.`;
      responseData.remaining_stock = remainingStock;
      responseData.total_product_stock = totalProductStock;
      responseData.batch_used = {
        batch_id: actualBatchId,
        rfid_uid: batch.rfid_uid,
        lot_number: updatedBatchInfo?.lot_number || batch.lot_number,
        quantity_after: remainingStock
      };
    }
    
    res.json(responseData);
  } catch (error) {
    // Intentar rollback si la transacción estaba activa
    try {
      await connection.rollback();
      console.log('⚠️ Transacción de despacho revertida por error');
    } catch (rollbackError) {
      // Ignorar error de rollback si la transacción no estaba activa
    }
    
    console.error('Error al despachar item:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    // Siempre liberar la conexión al pool
    connection.release();
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
    if (generatePrescriptionImage) {
      try {
        prescriptionImageBuffer = await generatePrescriptionImage(prescriptionData);
        console.log('✅ Imagen de receta generada correctamente');
      } catch (imageError) {
        console.error('⚠️ Error al generar imagen de receta:', imageError.message);
        // Continuar sin imagen, solo enviar QR
      }
    } else {
      console.warn('⚠️ Generación de imágenes de recetas no disponible (canvas no instalado)');
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
        error: businessRules.ERROR_MESSAGES.ROLE_CANNOT_CANCEL
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
    const validStatuses = Object.values(businessRules.PRESCRIPTION_STATUSES);
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

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDACIONES DE NEGOCIO - CANCELAR RECETA
    // ═══════════════════════════════════════════════════════════════════════════

    // Si se intenta cancelar, validar que no tenga despachos
    if (status === 'cancelled') {
      // Verificar si la receta tiene items despachados
      const items = await db.getPrescriptionItems(parseInt(id));
      const hasDispensedItems = items.some(item => (item.quantity_dispensed || 0) > 0);
      
      if (hasDispensedItems || prescription.status === 'partial' || prescription.status === 'fulfilled') {
        return res.status(400).json({
          success: false,
          error: businessRules.ERROR_MESSAGES.PRESCRIPTION_ALREADY_DISPATCHED
        });
      }
    }
    
    // Actualizar el estado
    const updateConnection = await db.pool.getConnection();
    try {
      await updateConnection.execute(
        `UPDATE prescriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, parseInt(id)]
      );
    } finally {
      updateConnection.release();
    }
    
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

