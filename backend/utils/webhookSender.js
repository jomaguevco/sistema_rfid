const crypto = require('crypto');

/**
 * Enviar webhook a una URL
 */
async function sendWebhook(url, event, payload, secret = null) {
  try {
    const timestamp = new Date().toISOString();
    const body = JSON.stringify(payload);
    
    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event,
      'X-Webhook-Timestamp': timestamp,
      'User-Agent': 'RFID-Stock-System/1.0'
    };
    
    // Firmar webhook si hay secret
    if (secret) {
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      timeout: 5000 // 5 segundos timeout
    });
    
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
    
    return {
      success: true,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    console.error(`Error al enviar webhook a ${url}:`, error);
    throw error;
  }
}

/**
 * Enviar webhook para evento de stock bajo
 */
async function sendLowStockWebhook(product, currentStock, minStock) {
  // Esta función se llamaría desde el sistema de alertas
  // Por ahora es un placeholder
  console.log(`Webhook: Stock bajo para ${product.name} (${currentStock}/${minStock})`);
}

/**
 * Enviar webhook para evento de producto vencido
 */
async function sendExpiredProductWebhook(product, batch) {
  // Esta función se llamaría desde el sistema de alertas
  console.log(`Webhook: Producto vencido ${product.name} - Lote ${batch.lot_number}`);
}

/**
 * Enviar webhook para evento de retiro de producto
 */
async function sendProductRemovalWebhook(product, batch, area, quantity) {
  // Esta función se llamaría desde el serial handler
  console.log(`Webhook: Retiro de producto ${product.name} desde ${area.name}`);
}

module.exports = {
  sendWebhook,
  sendLowStockWebhook,
  sendExpiredProductWebhook,
  sendProductRemovalWebhook
};

