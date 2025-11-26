// Cargar variables de entorno
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const serialHandler = require('./serialHandler_medical');
const { apiLimiter, authLimiter, sensitiveOperationLimiter } = require('./middleware/rateLimiter');
const { sanitizeInput } = require('./middleware/validation');
const { enforceHTTPS } = require('./middleware/https');
const { authenticateToken } = require('./middleware/auth');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./utils/swagger');
const productsRouter = require('./routes/products_medical');
const categoriesRouter = require('./routes/categories');
const areasRouter = require('./routes/areas');
const batchesRouter = require('./routes/batches');
const alertsRouter = require('./routes/alerts');
const predictionsRouter = require('./routes/predictions');
const dashboardRouter = require('./routes/dashboard');
const reportsRouter = require('./routes/reports');
const traceabilityRouter = require('./routes/traceability');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const importRouter = require('./routes/import');
const backupRouter = require('./routes/backup');
const notificationsRouter = require('./routes/notifications');
const printingRouter = require('./routes/printing');
const auditRouter = require('./routes/audit');
const suppliersRouter = require('./routes/suppliers');
const ordersRouter = require('./routes/orders');
const receiptsRouter = require('./routes/receipts');
const webhooksRouter = require('./routes/webhooks');
const adminRouter = require('./routes/admin');
const prescriptionsRouter = require('./routes/prescriptions');
const stockRouter = require('./routes/stock');
const doctorsRouter = require('./routes/doctors');
const patientsRouter = require('./routes/patients');
const pharmacistsRouter = require('./routes/pharmacists');

const app = express();

// Configurar HTTPS con certificados autofirmados para permitir acceso desde móviles
let server;
const certsPath = path.join(__dirname, 'certs');
const keyPath = path.join(certsPath, 'key.pem');
const certPath = path.join(certsPath, 'cert.pem');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  // Usar HTTPS si los certificados existen
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  server = https.createServer(httpsOptions, app);
  console.log('🔒 Servidor configurado con HTTPS');
} else {
  // Fallback a HTTP si no hay certificados
  server = http.createServer(app);
  console.log('⚠️  Servidor configurado con HTTP (sin certificados SSL)');
}

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Guardar instancia de io globalmente
global.io = io;

const PORT = process.env.PORT || 3000;

// Forzar HTTPS en producción (si está detrás de un proxy)
if (process.env.NODE_ENV === 'production') {
  app.use(enforceHTTPS);
}

// Seguridad: Helmet para headers de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",  // Para Chart.js
        "https://cdn.socket.io"       // Para Socket.IO si se usa desde CDN
      ],
      scriptSrcAttr: ["'unsafe-inline'"],  // Permitir event handlers inline
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'", 
        "ws:", 
        "wss:",
        "https://cdn.jsdelivr.net"  // Para Chart.js source maps
      ],  // Para WebSockets y source maps
      fontSrc: ["'self'", "https:", "data:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configurado correctamente
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting general para API (solo para operaciones de escritura)
// Las rutas GET están excluidas del rate limiting en el middleware
app.use('/api/', (req, res, next) => {
  // Solo aplicar rate limiting a operaciones de escritura (POST, PUT, DELETE)
  if (req.method !== 'GET') {
    return apiLimiter(req, res, next);
  }
  next();
});

// Sanitización de entrada
app.use(sanitizeInput);

// Body parser con límites y validación JSON
app.use(bodyParser.json({ 
  charset: 'utf-8',
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ success: false, error: 'JSON inválido' });
      throw new Error('JSON inválido');
    }
  }
}));
app.use(bodyParser.urlencoded({ 
  extended: true, 
  charset: 'utf-8',
  limit: '10mb'
}));

// Configurar headers UTF-8 para todas las respuestas
app.use((req, res, next) => {
  // Solo establecer charset para respuestas JSON, no para archivos estáticos
  if (req.path.startsWith('/api')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});

// Documentación API (Swagger)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'API - Sistema Médico RFID'
}));

// Rutas API (antes de servir archivos estáticos)
// Rutas públicas (sin autenticación)
app.use('/api/auth', authRouter);

// Rutas protegidas (requieren autenticación)
app.use('/api/users', authenticateToken, usersRouter);
app.use('/api/import', authenticateToken, importRouter);
app.use('/api/backup', authenticateToken, backupRouter);
app.use('/api/notifications', authenticateToken, notificationsRouter);
app.use('/api/printing', authenticateToken, printingRouter);
app.use('/api/audit', authenticateToken, auditRouter);
app.use('/api/suppliers', authenticateToken, suppliersRouter);
app.use('/api/orders', authenticateToken, ordersRouter);
app.use('/api/receipts', authenticateToken, receiptsRouter);
app.use('/api/webhooks', authenticateToken, webhooksRouter);
app.use('/api/admin', authenticateToken, adminRouter);
app.use('/api/products', authenticateToken, productsRouter);
app.use('/api/categories', authenticateToken, categoriesRouter);
app.use('/api/areas', authenticateToken, areasRouter);
app.use('/api/batches', authenticateToken, batchesRouter);
app.use('/api/alerts', authenticateToken, alertsRouter);
app.use('/api/predictions', authenticateToken, predictionsRouter);
app.use('/api/dashboard', authenticateToken, dashboardRouter);
app.use('/api/reports', authenticateToken, reportsRouter);
app.use('/api/traceability', authenticateToken, traceabilityRouter);
app.use('/api/prescriptions', authenticateToken, prescriptionsRouter);
app.use('/api/stock', authenticateToken, stockRouter);
app.use('/api/doctors', authenticateToken, doctorsRouter);
app.use('/api/patients', authenticateToken, patientsRouter);
app.use('/api/pharmacists', authenticateToken, pharmacistsRouter);

// Ruta para procesar retiro con área (desde frontend) - requiere autenticación
app.post('/api/removal/process', authenticateToken, async (req, res) => {
  try {
    const { rfid_uid, area_id } = req.body;
    if (!rfid_uid) {
      return res.status(400).json({
        success: false,
        error: 'rfid_uid es requerido'
      });
    }
    const result = await serialHandler.processRemovalWithArea(rfid_uid, area_id || null);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Servir archivos estáticos del frontend (después de las rutas API)
// IMPORTANTE: Solo servir archivos estáticos si NO es una ruta API
const staticMiddleware = express.static(path.join(__dirname, '../frontend'), {
  index: false
});

app.use((req, res, next) => {
  // Si es una ruta API, pasar al siguiente middleware sin servir archivos estáticos
  if (req.path.startsWith('/api')) {
    return next();
  }
  // Si no es API, servir archivos estáticos
  staticMiddleware(req, res, next);
});

// Ruta raíz - servir index_medical.html específicamente
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, '../frontend/index_medical.html'));
});

// Ruta para login
app.get('/login.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// WebSocket para actualizaciones en tiempo real
io.on('connection', (socket) => {
  console.log('✓ Cliente Socket.IO conectado:', socket.id);
  console.log(`   Total de clientes conectados: ${io.sockets.sockets.size}`);
  
  socket.on('disconnect', () => {
    console.log('✗ Cliente Socket.IO desconectado:', socket.id);
    console.log(`   Total de clientes conectados: ${io.sockets.sockets.size}`);
  });
  
  // Escuchar eventos de prueba del cliente
  socket.on('test', (data) => {
    console.log('📨 Evento de prueba recibido del cliente:', data);
    socket.emit('testResponse', { message: 'Servidor recibió el test' });
  });
});

// Inicializar comunicación serial con Arduino
console.log('🚀 Iniciando servidor médico...');
serialHandler.initSerial().catch(err => {
  console.error('✗ Error al inicializar comunicación serial:', err.message);
});

// Ruta para verificar estado del puerto serial
app.get('/api/serial/status', authenticateToken, async (req, res) => {
  try {
    const isOpen = serialHandler.isSerialOpen();
    const ports = await serialHandler.getAvailablePorts();
    
    res.json({
      success: true,
      data: {
        isOpen,
        configuredPort: process.env.SERIAL_PORT || 'COM4',
        baudRate: parseInt(process.env.BAUD_RATE || '115200'),
        availablePorts: ports.map(p => ({
          path: p.path,
          manufacturer: p.manufacturer,
          vendorId: p.vendorId,
          productId: p.productId
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Verificar alertas al iniciar
const db = require('./database_medical');
setTimeout(async () => {
  try {
    await db.checkAndGenerateAlerts();
    console.log('✓ Verificación inicial de alertas completada');
  } catch (error) {
    console.error('Error en verificación inicial de alertas:', error.message);
  }
}, 2000);

// Inicializar reportes programados
const scheduledReports = require('./utils/scheduledReports');
setTimeout(async () => {
  try {
    await scheduledReports.initializeScheduledReports();
  } catch (error) {
    console.error('Error al inicializar reportes programados:', error.message);
  }
}, 3000);

// Inicializar backups programados (diario a las 2 AM)
const { scheduleDailyBackup } = require('./utils/backup');
setTimeout(() => {
  try {
    scheduleDailyBackup((error, backup) => {
      if (error) {
        console.error('Error en backup programado:', error);
      } else {
        console.log('✓ Backup programado completado:', backup.filename);
      }
    });
    console.log('✓ Backup diario programado (2 AM)');
  } catch (error) {
    console.error('Error al programar backup diario:', error.message);
  }
}, 4000);

// Middleware de manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  
  // Error de CORS
  if (err.message === 'No permitido por CORS') {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado por CORS'
    });
  }
  
  // Error de validación JSON
  if (err.message === 'JSON inválido') {
    return; // Ya se envió la respuesta
  }
  
  // Error genérico
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor' 
      : err.message
  });
});

// Middleware para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`✓ API disponible en http://localhost:${PORT}/api`);
  console.log(`✓ Documentación API: http://localhost:${PORT}/api-docs`);
  console.log(`✓ Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ Seguridad: Rate limiting y validación activados`);
  console.log('📡 Esperando conexión con Arduino...');
});

// Manejar cierre graceful
process.on('SIGINT', () => {
  console.log('\n⚠️  Cerrando servidor...');
  serialHandler.closeSerial();
  server.close(() => {
    console.log('✓ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Cerrando servidor...');
  serialHandler.closeSerial();
  server.close(() => {
    console.log('✓ Servidor cerrado correctamente');
    process.exit(0);
  });
});

