const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sistema de Gestión de Stock Médico con RFID',
      version: '1.0.0',
      description: 'API REST para gestión de medicamentos e insumos médicos con monitoreo RFID',
      contact: {
        name: 'Soporte API',
        email: 'soporte@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desarrollo'
      },
      {
        url: 'https://api.example.com',
        description: 'Servidor de producción'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido del endpoint /api/auth/login'
        }
      },
      schemas: {
        Product: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            description: { type: 'string' },
            product_type: { type: 'string', enum: ['medicamento', 'insumo'] },
            active_ingredient: { type: 'string' },
            concentration: { type: 'string' },
            presentation: { type: 'string' },
            administration_route: { type: 'string' },
            category_id: { type: 'integer' },
            min_stock: { type: 'integer' },
            requires_refrigeration: { type: 'boolean' },
            rfid_uid: { type: 'string' },
            total_stock: { type: 'integer' }
          }
        },
        Batch: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            product_id: { type: 'integer' },
            lot_number: { type: 'string' },
            expiry_date: { type: 'string', format: 'date' },
            quantity: { type: 'integer' },
            rfid_uid: { type: 'string' },
            entry_date: { type: 'string', format: 'date' },
            is_expired: { type: 'boolean' },
            days_to_expiry: { type: 'integer' }
          }
        },
        Area: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            description: { type: 'string' },
            is_active: { type: 'boolean' }
          }
        },
        Alert: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            product_id: { type: 'integer' },
            batch_id: { type: 'integer' },
            alert_type: { type: 'string', enum: ['expired', 'expiring_soon', 'low_stock', 'prediction_insufficient', 'no_rfid'] },
            severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            message: { type: 'string' },
            is_resolved: { type: 'boolean' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './routes/*.js',
    './server_medical.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

