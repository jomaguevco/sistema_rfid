const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/**
 * GET /api/reports/expired
 * Reporte de productos vencidos
 */
router.get('/expired', async (req, res) => {
  try {
    const [rows] = await db.pool.execute(
      `SELECT pb.*, p.name as product_name, p.product_type, 
              pc.name as category_name, p.active_ingredient,
              DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE pb.expiry_date < CURDATE() AND pb.quantity > 0
       ORDER BY pb.expiry_date ASC`
    );
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reports/expiring
 * Reporte de productos por vencer
 */
router.get('/expiring', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    const [rows] = await db.pool.execute(
      `SELECT pb.*, p.name as product_name, p.product_type,
              pc.name as category_name, p.active_ingredient,
              DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE DATEDIFF(pb.expiry_date, CURDATE()) BETWEEN 0 AND ?
       AND pb.expiry_date >= CURDATE() AND pb.quantity > 0
       ORDER BY pb.expiry_date ASC`,
      [days]
    );
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reports/low-stock
 * Reporte de productos con stock bajo
 */
router.get('/low-stock', async (req, res) => {
  try {
    const [rows] = await db.pool.execute(
      `SELECT p.*, pc.name as category_name,
              COALESCE(SUM(pb.quantity), 0) as current_stock
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       LEFT JOIN product_batches pb ON pb.product_id = p.id
       GROUP BY p.id
       HAVING current_stock <= p.min_stock
       ORDER BY current_stock ASC`
    );
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reports/traceability
 * Reporte de trazabilidad por producto
 */
router.get('/traceability', async (req, res) => {
  try {
    const productId = req.query.product_id;
    const areaId = req.query.area_id;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    
    let query = `
      SELECT sh.*, p.name as product_name, pb.lot_number, 
             pb.expiry_date, a.name as area_name
      FROM stock_history sh
      JOIN products p ON sh.product_id = p.id
      LEFT JOIN product_batches pb ON sh.batch_id = pb.id
      LEFT JOIN areas a ON sh.area_id = a.id
      WHERE 1=1
    `;
    const params = [];
    
    if (productId) {
      query += ' AND sh.product_id = ?';
      params.push(productId);
    }
    if (areaId) {
      query += ' AND sh.area_id = ?';
      params.push(areaId);
    }
    if (startDate) {
      query += ' AND sh.consumption_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND sh.consumption_date <= ?';
      params.push(endDate);
    }
    
    query += ' ORDER BY sh.created_at DESC LIMIT 1000';
    
    const [rows] = await db.pool.execute(query, params);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reports/consumption-by-area
 * Reporte de consumo por área
 */
router.get('/consumption-by-area', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const [rows] = await db.pool.execute(
      `SELECT a.id, a.name as area_name,
              COUNT(*) as total_removals,
              SUM(sh.previous_stock - sh.new_stock) as total_consumed,
              COUNT(DISTINCT sh.product_id) as unique_products
       FROM stock_history sh
       JOIN areas a ON sh.area_id = a.id
       WHERE sh.action = 'remove' 
       AND sh.consumption_date >= ?
       GROUP BY a.id, a.name
       ORDER BY total_consumed DESC`,
      [startDate.toISOString().split('T')[0]]
    );
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reports/predictions
 * Reporte de predicciones de consumo
 */
router.get('/predictions', async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const areaId = req.query.area_id || null;
    
    let query = `
      SELECT cp.*, p.name as product_name, p.product_type,
             COALESCE(SUM(pb.quantity), 0) as current_stock,
             a.name as area_name
      FROM consumption_predictions cp
      JOIN products p ON cp.product_id = p.id
      LEFT JOIN product_batches pb ON pb.product_id = p.id
      LEFT JOIN areas a ON cp.area_id = a.id
      WHERE cp.prediction_period = ?
      AND cp.calculation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `;
    const params = [period];
    
    if (areaId) {
      query += ' AND cp.area_id = ?';
      params.push(areaId);
    } else {
      query += ' AND cp.area_id IS NULL';
    }
    
    query += ' GROUP BY cp.id ORDER BY cp.predicted_quantity DESC';
    
    const [rows] = await db.pool.execute(query, params);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/reports/export/:type
 * Exportar reporte en diferentes formatos (CSV, Excel, PDF, JSON)
 */
router.get('/export/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const reportType = req.query.report || 'expired'; // expired, expiring, low-stock, traceability, etc.
    const format = type.toLowerCase(); // csv, excel, pdf, json
    
    if (!['csv', 'excel', 'pdf', 'json'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Formato no soportado. Use: csv, excel, pdf, json'
      });
    }
    
    // Obtener datos según el tipo de reporte
    let data = [];
    let reportName = '';
    
    switch (reportType) {
      case 'expired':
        const [expiredRows] = await db.pool.execute(
          `SELECT pb.*, p.name as product_name, p.product_type, 
                  pc.name as category_name, p.active_ingredient,
                  DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
           FROM product_batches pb
           JOIN products p ON pb.product_id = p.id
           LEFT JOIN product_categories pc ON p.category_id = pc.id
           WHERE pb.expiry_date < CURDATE() AND pb.quantity > 0
           ORDER BY pb.expiry_date ASC`
        );
        data = expiredRows;
        reportName = 'Productos Vencidos';
        break;
      case 'expiring':
        const days = parseInt(req.query.days) || 30;
        const [expiringRows] = await db.pool.execute(
          `SELECT pb.*, p.name as product_name, p.product_type,
                  pc.name as category_name, p.active_ingredient,
                  DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
           FROM product_batches pb
           JOIN products p ON pb.product_id = p.id
           LEFT JOIN product_categories pc ON p.category_id = pc.id
           WHERE DATEDIFF(pb.expiry_date, CURDATE()) BETWEEN 0 AND ?
           AND pb.expiry_date >= CURDATE() AND pb.quantity > 0
           ORDER BY pb.expiry_date ASC`,
          [days]
        );
        data = expiringRows;
        reportName = `Productos por Vencer (${days} días)`;
        break;
      case 'low-stock':
        const [lowStockRows] = await db.pool.execute(
          `SELECT p.*, pc.name as category_name,
                  COALESCE(SUM(pb.quantity), 0) as current_stock
           FROM products p
           LEFT JOIN product_categories pc ON p.category_id = pc.id
           LEFT JOIN product_batches pb ON pb.product_id = p.id
           GROUP BY p.id
           HAVING current_stock <= p.min_stock
           ORDER BY current_stock ASC`
        );
        data = lowStockRows;
        reportName = 'Productos con Stock Bajo';
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Tipo de reporte no válido'
        });
    }
    
    // Generar exportación según formato
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${reportName}.json"`);
      return res.json({
        success: true,
        report: reportName,
        generated_at: new Date().toISOString(),
        data
      });
    }
    
    if (format === 'csv') {
      const csv = require('../utils/csvParser');
      const csvData = await csv.generateCsv(data);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${reportName}.csv"`);
      return res.send(csvData);
    }
    
    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(reportName);
      
      // Agregar encabezados
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        worksheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
        worksheet.addRows(data);
      }
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${reportName}.xlsx"`);
      await workbook.xlsx.write(res);
      return res.end();
    }
    
    if (format === 'pdf') {
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${reportName}.pdf"`);
      doc.pipe(res);
      
      doc.fontSize(20).text(reportName, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generado: ${new Date().toLocaleString('es-ES')}`, { align: 'center' });
      doc.moveDown(2);
      
      // Agregar tabla simple
      doc.fontSize(10);
      let y = doc.y;
      const startX = 50;
      const rowHeight = 20;
      
      if (data.length > 0) {
        const headers = Object.keys(data[0]).slice(0, 5); // Primeras 5 columnas
        const colWidth = (doc.page.width - 100) / headers.length;
        
        // Encabezados
        headers.forEach((header, i) => {
          doc.text(header, startX + i * colWidth, y, { width: colWidth - 5 });
        });
        y += rowHeight;
        doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke();
        y += 5;
        
        // Datos (primeras 20 filas)
        data.slice(0, 20).forEach(row => {
          if (y > doc.page.height - 50) {
            doc.addPage();
            y = 50;
          }
          headers.forEach((header, i) => {
            const value = String(row[header] || '').substring(0, 30);
            doc.text(value, startX + i * colWidth, y, { width: colWidth - 5 });
          });
          y += rowHeight;
        });
      }
      
      doc.end();
    }
  } catch (error) {
    console.error('Error al exportar reporte:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

