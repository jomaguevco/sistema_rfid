const nodemailer = require('nodemailer');

// Configuración SMTP desde variables de entorno
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros puertos
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || ''
  }
};

// Crear transporter
let transporter = null;

function initEmailTransporter() {
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.warn('⚠️  Configuración SMTP no completa. Las notificaciones por email estarán deshabilitadas.');
    return null;
  }
  
  transporter = nodemailer.createTransport(emailConfig);
  return transporter;
}

// Inicializar al cargar el módulo
if (emailConfig.auth.user && emailConfig.auth.pass) {
  transporter = initEmailTransporter();
}

/**
 * Enviar email
 */
async function sendEmail(to, subject, html, text = null) {
  if (!transporter) {
    console.warn('Transporter de email no configurado');
    return { success: false, error: 'Email no configurado' };
  }
  
  try {
    const info = await transporter.sendMail({
      from: `"Sistema Stock Médico" <${emailConfig.auth.user}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
      text: text || html.replace(/<[^>]*>/g, ''),
      html: html
    });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error al enviar email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Template para alerta de producto vencido
 */
function getExpiredProductTemplate(product, batch) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
        .content { background: #f8f9fa; padding: 20px; }
        .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Alerta: Producto Vencido</h1>
        </div>
        <div class="content">
          <p>Se ha detectado un producto vencido en el sistema:</p>
          <div class="alert-box">
            <h3>${product.name}</h3>
            <p><strong>Lote:</strong> ${batch.lot_number}</p>
            <p><strong>Fecha de Vencimiento:</strong> ${new Date(batch.expiry_date).toLocaleDateString('es-ES')}</p>
            <p><strong>Cantidad:</strong> ${batch.quantity} unidades</p>
          </div>
          <p>Por favor, revisa el inventario y toma las medidas necesarias.</p>
        </div>
        <div class="footer">
          <p>Sistema de Gestión de Stock Médico RFID</p>
          <p>Este es un mensaje automático, por favor no responder.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Template para alerta de producto por vencer
 */
function getExpiringProductTemplate(product, batch, daysLeft) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ffc107; color: #333; padding: 20px; text-align: center; }
        .content { background: #f8f9fa; padding: 20px; }
        .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏰ Alerta: Producto por Vencer</h1>
        </div>
        <div class="content">
          <p>Un producto está próximo a vencer:</p>
          <div class="alert-box">
            <h3>${product.name}</h3>
            <p><strong>Lote:</strong> ${batch.lot_number}</p>
            <p><strong>Fecha de Vencimiento:</strong> ${new Date(batch.expiry_date).toLocaleDateString('es-ES')}</p>
            <p><strong>Días restantes:</strong> ${daysLeft} días</p>
            <p><strong>Cantidad:</strong> ${batch.quantity} unidades</p>
          </div>
          <p>Por favor, revisa el inventario y planifica su uso.</p>
        </div>
        <div class="footer">
          <p>Sistema de Gestión de Stock Médico RFID</p>
          <p>Este es un mensaje automático, por favor no responder.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Template para alerta de stock bajo
 */
function getLowStockTemplate(product, currentStock, minStock) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #fd7e14; color: white; padding: 20px; text-align: center; }
        .content { background: #f8f9fa; padding: 20px; }
        .alert-box { background: #ffe5d0; border-left: 4px solid #fd7e14; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📉 Alerta: Stock Bajo</h1>
        </div>
        <div class="content">
          <p>El stock de un producto está por debajo del mínimo:</p>
          <div class="alert-box">
            <h3>${product.name}</h3>
            <p><strong>Stock Actual:</strong> ${currentStock} unidades</p>
            <p><strong>Stock Mínimo:</strong> ${minStock} unidades</p>
            <p><strong>Déficit:</strong> ${minStock - currentStock} unidades</p>
          </div>
          <p>Por favor, considera realizar un pedido de reabastecimiento.</p>
        </div>
        <div class="footer">
          <p>Sistema de Gestión de Stock Médico RFID</p>
          <p>Este es un mensaje automático, por favor no responder.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Template para resumen diario de alertas
 */
function getDailyAlertsSummaryTemplate(alerts) {
  const expiredCount = alerts.filter(a => a.alert_type === 'expired').length;
  const expiringCount = alerts.filter(a => a.alert_type === 'expiring_soon').length;
  const lowStockCount = alerts.filter(a => a.alert_type === 'low_stock').length;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c5282; color: white; padding: 20px; text-align: center; }
        .content { background: #f8f9fa; padding: 20px; }
        .summary-box { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .summary-item { padding: 10px; margin: 5px 0; border-left: 4px solid #2c5282; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Resumen Diario de Alertas</h1>
        </div>
        <div class="content">
          <p>Resumen de alertas del sistema al ${new Date().toLocaleDateString('es-ES')}:</p>
          <div class="summary-box">
            <div class="summary-item">
              <strong>Productos Vencidos:</strong> ${expiredCount}
            </div>
            <div class="summary-item">
              <strong>Productos por Vencer:</strong> ${expiringCount}
            </div>
            <div class="summary-item">
              <strong>Stock Bajo:</strong> ${lowStockCount}
            </div>
            <div class="summary-item">
              <strong>Total de Alertas:</strong> ${alerts.length}
            </div>
          </div>
          <p>Ingresa al sistema para ver los detalles completos.</p>
        </div>
        <div class="footer">
          <p>Sistema de Gestión de Stock Médico RFID</p>
          <p>Este es un mensaje automático, por favor no responder.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  sendEmail,
  getExpiredProductTemplate,
  getExpiringProductTemplate,
  getLowStockTemplate,
  getDailyAlertsSummaryTemplate,
  initEmailTransporter
};

