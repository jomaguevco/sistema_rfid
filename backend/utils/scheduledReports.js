const cron = require('node-cron');
const db = require('../database_medical');
const reportGenerator = require('./reportGenerator');
const emailUtils = require('./email');

let scheduledTasks = new Map();

/**
 * Inicializar y programar todos los reportes activos
 */
async function initializeScheduledReports() {
  try {
    const reports = await db.getAllScheduledReports();
    const activeReports = reports.filter(r => r.is_active);
    
    console.log(`📅 Inicializando ${activeReports.length} reportes programados...`);
    
    activeReports.forEach(report => {
      scheduleReport(report);
    });
    
    console.log('✓ Reportes programados inicializados');
  } catch (error) {
    // Si la tabla no existe, solo mostrar advertencia pero no fallar
    if (error.code === 'ER_NO_SUCH_TABLE' || error.message.includes("doesn't exist")) {
      console.log('⚠️  Tabla scheduled_reports no existe. Los reportes programados estarán deshabilitados.');
      console.log('💡 Ejecuta: node crear_scheduled_reports.js para crear las tablas necesarias');
    } else {
      console.error('Error al inicializar reportes programados:', error);
    }
  }
}

/**
 * Programar un reporte
 */
function scheduleReport(report) {
  // Detener tarea existente si hay una
  if (scheduledTasks.has(report.id)) {
    scheduledTasks.get(report.id).stop();
  }
  
  if (!report.is_active) {
    return;
  }
  
  const cronExpression = getCronExpression(report.schedule_type, report.schedule_config);
  
  if (!cronExpression) {
    console.warn(`⚠️  No se pudo crear expresión cron para reporte ${report.id}`);
    return;
  }
  
  const task = cron.schedule(cronExpression, async () => {
    await executeScheduledReport(report);
  }, {
    scheduled: true,
    timezone: 'America/Mexico_City' // Ajustar según necesidad
  });
  
  scheduledTasks.set(report.id, task);
  console.log(`✓ Reporte "${report.report_name}" programado: ${cronExpression}`);
}

/**
 * Ejecutar un reporte programado
 */
async function executeScheduledReport(report) {
  const startTime = Date.now();
  let executionRecord = null;
  
  try {
    console.log(`📊 Ejecutando reporte programado: ${report.report_name}`);
    
    // Crear registro de ejecución
    executionRecord = await db.createScheduledReportExecution({
      scheduled_report_id: report.id,
      status: 'pending',
      records_generated: 0
    });
    
    // Generar reporte
    const reportData = await generateReportData(report);
    const filters = report.filters ? (typeof report.filters === 'string' ? JSON.parse(report.filters) : report.filters) : {};
    const filePath = await reportGenerator.generateReport(report.report_type, report.format, reportData, filters);
    
    // Actualizar registro de ejecución
    const executionTime = Date.now() - startTime;
    await db.pool.execute(
      `UPDATE scheduled_report_executions 
       SET status = 'success', records_generated = ?, file_path = ?, execution_time_ms = ?
       WHERE id = ?`,
      [reportData.length || 0, filePath, executionTime, executionRecord.id]
    );
    
    // Actualizar last_run_at y next_run_at del reporte
    const nextRunAt = calculateNextRun(report.schedule_type, report.schedule_config);
    await db.pool.execute(
      `UPDATE scheduled_reports 
       SET last_run_at = NOW(), next_run_at = ?
       WHERE id = ?`,
      [nextRunAt, report.id]
    );
    
    // Enviar por email si hay destinatarios
    if (report.recipients && emailUtils && typeof emailUtils.sendEmail === 'function') {
      try {
        await sendScheduledReportEmail(report, filePath, reportData.length || 0);
      } catch (emailError) {
        console.error('Error al enviar email del reporte:', emailError);
        // No fallar la ejecución del reporte si el email falla
      }
    }
    
    console.log(`✓ Reporte "${report.report_name}" ejecutado exitosamente`);
  } catch (error) {
    console.error(`✗ Error al ejecutar reporte ${report.report_name}:`, error);
    
    if (executionRecord) {
      await db.pool.execute(
        `UPDATE scheduled_report_executions 
         SET status = 'failed', error_message = ?, execution_time_ms = ?
         WHERE id = ?`,
        [error.message.substring(0, 500), Date.now() - startTime, executionRecord.id]
      );
    }
  }
}

/**
 * Generar datos del reporte según tipo
 */
async function generateReportData(report) {
  const filters = report.filters ? JSON.parse(report.filters) : {};
  
  switch (report.report_type) {
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
      return expiredRows;
      
    case 'expiring':
      const days = filters.days || 30;
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
      return expiringRows;
      
    case 'low_stock':
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
      return lowStockRows;
      
    default:
      return [];
  }
}

/**
 * Enviar reporte por email
 */
async function sendScheduledReportEmail(report, filePath, recordCount) {
  try {
    if (!emailUtils || typeof emailUtils.sendEmail !== 'function') {
      console.warn('Email utils no disponible, omitiendo envío de email');
      return;
    }
    
    const recipients = report.recipients.split(',').map(r => r.trim());
    
    await emailUtils.sendEmail({
      to: recipients,
      subject: `Reporte Programado: ${report.report_name}`,
      html: `
        <h2>Reporte Programado: ${report.report_name}</h2>
        <p>Se ha generado el reporte programado "${report.report_name}".</p>
        <p><strong>Tipo:</strong> ${report.report_type}</p>
        <p><strong>Registros generados:</strong> ${recordCount}</p>
        <p><strong>Formato:</strong> ${report.format.toUpperCase()}</p>
        <p>El archivo adjunto contiene los detalles del reporte.</p>
      `,
      attachments: filePath ? [{ path: filePath }] : []
    });
  } catch (error) {
    console.error('Error al enviar email del reporte:', error);
  }
}

/**
 * Obtener expresión cron según tipo de programación
 */
function getCronExpression(scheduleType, scheduleConfig) {
  const config = scheduleConfig ? (typeof scheduleConfig === 'string' ? JSON.parse(scheduleConfig) : scheduleConfig) : {};
  
  switch (scheduleType) {
    case 'daily':
      const hour = config.hour || 8;
      const minute = config.minute || 0;
      return `${minute} ${hour} * * *`; // Cada día a la hora especificada
      
    case 'weekly':
      const dayOfWeek = config.dayOfWeek || 1; // 1 = Lunes
      const hourWeekly = config.hour || 8;
      const minuteWeekly = config.minute || 0;
      return `${minuteWeekly} ${hourWeekly} * * ${dayOfWeek}`;
      
    case 'monthly':
      const dayOfMonth = config.dayOfMonth || 1;
      const hourMonthly = config.hour || 8;
      const minuteMonthly = config.minute || 0;
      return `${minuteMonthly} ${hourMonthly} ${dayOfMonth} * *`;
      
    default:
      return null;
  }
}

/**
 * Calcular próxima ejecución
 */
function calculateNextRun(scheduleType, scheduleConfig) {
  const now = new Date();
  const nextRun = new Date();
  const config = scheduleConfig ? (typeof scheduleConfig === 'string' ? JSON.parse(scheduleConfig) : scheduleConfig) : {};
  
  switch (scheduleType) {
    case 'daily':
      const hour = config.hour || 8;
      const minute = config.minute || 0;
      nextRun.setHours(hour, minute, 0, 0);
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
      
    case 'weekly':
      const dayOfWeek = config.dayOfWeek || 1;
      const hourWeekly = config.hour || 8;
      const minuteWeekly = config.minute || 0;
      const currentDay = now.getDay();
      const daysUntilNext = (dayOfWeek - currentDay + 7) % 7 || 7;
      nextRun.setDate(now.getDate() + daysUntilNext);
      nextRun.setHours(hourWeekly, minuteWeekly, 0, 0);
      break;
      
    case 'monthly':
      const dayOfMonth = config.dayOfMonth || 1;
      const hourMonthly = config.hour || 8;
      const minuteMonthly = config.minute || 0;
      nextRun.setDate(dayOfMonth);
      nextRun.setHours(hourMonthly, minuteMonthly, 0, 0);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
      
    default:
      return null;
  }
  
  return nextRun.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Detener y eliminar tarea programada
 */
function unscheduleReport(reportId) {
  if (scheduledTasks.has(reportId)) {
    scheduledTasks.get(reportId).stop();
    scheduledTasks.delete(reportId);
    console.log(`✓ Reporte ${reportId} desprogramado`);
  }
}

/**
 * Recargar reporte programado
 */
async function reloadScheduledReport(reportId) {
  try {
    const report = await db.getScheduledReportById(reportId);
    if (report) {
      scheduleReport(report);
    }
  } catch (error) {
    console.error(`Error al recargar reporte ${reportId}:`, error);
  }
}

module.exports = {
  initializeScheduledReports,
  scheduleReport,
  unscheduleReport,
  reloadScheduledReport,
  executeScheduledReport,
  calculateNextRun
};

