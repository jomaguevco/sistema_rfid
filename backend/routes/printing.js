const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { generateLabelPDF, generateLabelHTML, generateMultipleLabelsPDF } = require('../utils/labelGenerator');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

/**
 * GET /api/printing/preview/:batchId
 * Vista previa de etiqueta HTML
 */
router.get('/preview/:batchId', authenticateToken, async (req, res) => {
  try {
    const batchId = parseInt(req.params.batchId);
    const batch = await db.getBatchById(batchId);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote no encontrado'
      });
    }
    
    const product = await db.getProductById(batch.product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }
    
    const html = generateLabelHTML(batch, product, {
      size: req.query.size || '100mm 50mm'
    });
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error al generar vista previa:', error);
    res.status(500).json({
      success: false,
      error: `Error al generar vista previa: ${error.message}`
    });
  }
});

/**
 * GET /api/printing/pdf/:batchId
 * Generar PDF de etiqueta individual
 */
router.get('/pdf/:batchId', authenticateToken, async (req, res) => {
  try {
    const batchId = parseInt(req.params.batchId);
    const batch = await db.getBatchById(batchId);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote no encontrado'
      });
    }
    
    const product = await db.getProductById(batch.product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }
    
    const pdfBuffer = await generateLabelPDF(batch, product, {
      size: req.query.size ? req.query.size.split('x').map(n => parseInt(n)) : [100, 50]
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="etiqueta_${batch.lot_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({
      success: false,
      error: `Error al generar PDF: ${error.message}`
    });
  }
});

/**
 * POST /api/printing/bulk
 * Generar PDF con múltiples etiquetas
 */
router.post('/bulk', authenticateToken, requirePermission('batches.read'), async (req, res) => {
  try {
    const { batchIds, productIds, options = {} } = req.body;
    
    let batches = [];
    
    if (batchIds && Array.isArray(batchIds)) {
      // Obtener lotes específicos
      batches = await Promise.all(
        batchIds.map(id => db.getBatchById(id))
      );
      batches = batches.filter(b => b !== null);
    } else if (productIds && Array.isArray(productIds)) {
      // Obtener todos los lotes de productos específicos
      for (const productId of productIds) {
        const productBatches = await db.getProductBatches(productId);
        batches.push(...productBatches);
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Se requiere batchIds o productIds'
      });
    }
    
    if (batches.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se encontraron lotes para imprimir'
      });
    }
    
    // Obtener productos
    const productIdsSet = new Set(batches.map(b => b.product_id));
    const products = await Promise.all(
      Array.from(productIdsSet).map(id => db.getProductById(id))
    );
    
    const pdfBuffer = await generateMultipleLabelsPDF(batches, products, options);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="etiquetas_${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al generar PDF masivo:', error);
    res.status(500).json({
      success: false,
      error: `Error al generar PDF: ${error.message}`
    });
  }
});

module.exports = router;

