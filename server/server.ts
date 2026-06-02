import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import apiRoutes from './apiRoutes';
import { validateEnv } from './env';

console.log('🚀 [STARTUP] Initializing AstroBar Server...');

// Clear module cache to force fresh DB connection
delete require.cache[require.resolve('./db')];

// Validate environment variables at startup
console.log('🔍 [STARTUP] Validating environment variables...');
try {
  validateEnv();
  console.log('✅ [STARTUP] Environment variables validated');
} catch (error: any) {
  console.error('❌ [STARTUP] Environment validation failed:', error.message);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy - required for rate limiting behind Replit's / Railway's proxy
app.set('trust proxy', 1);

// Security middleware - disable CSP for SPA
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: true,
  credentials: true
}));

// Rate limiting (Aumentado en producción para evitar bloqueos por uso normal)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 2000 : 10000, // Subido de 100 a 2000
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode >= 400) {
      // Log errors if needed
    }
    return originalSend.call(this, data);
  };
  next();
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Serve Expo static bundles (for Expo Go deployment)
const staticBuildPath = path.join(process.cwd(), 'static-build');
app.use('/ios', express.static(path.join(staticBuildPath, 'ios')));
app.use('/android', express.static(path.join(staticBuildPath, 'android')));
// Serve bundle assets with dynamic timestamp paths
app.use(express.static(staticBuildPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// API routes
app.use('/api', apiRoutes);

// Admin Panel routes
import adminPanelRoutes from './routes/adminPanelRoutes';
app.use('/api/admin', adminPanelRoutes);

// FASE 2 routes
import phase2Routes from './routes/phase2Routes';
app.use('/api/phase2', phase2Routes);

// Admin Complete routes
import adminCompleteRoutes from './routes/adminCompleteRoutes';
app.use('/api/admin-complete', adminCompleteRoutes);

// Public routes
import publicRoutes from './routes/publicRoutes';
app.use('/api/public', publicRoutes);

// Order routes
import orderRoutes from './routes/orderRoutes';
app.use('/api/orders', orderRoutes);

// Upload routes
import uploadRoutes from './routes/uploadRoutes';
app.use('/api/upload', uploadRoutes);

// Mercado Pago routes
import mercadopagoRoutes from './routes/mercadopagoRoutes';
app.use('/api/mp', mercadopagoRoutes);

// Customer Mercado Pago routes
import customerMercadopagoRoutes from './routes/customerMercadopagoRoutes';
app.use('/api/customer-mp', customerMercadopagoRoutes);

// Favorites routes
import favoriteRoutes from './routes/favoriteRoutes';
app.use('/api/favorites', favoriteRoutes);

// Migration routes (temporal)
import migrationRoutes from './routes/migrationRoutes';
app.use('/api/migrations', migrationRoutes);

// Webhook routes
import webhookRoutes from './routes/webhookRoutes';
app.use('/webhooks', webhookRoutes);

// Geolocation routes
import geolocationRoutes from './routes/geolocationRoutes';
app.use('/api/geolocation', geolocationRoutes);

// Directions routes
import directionsRoutes from './routes/directionsRoutes';
app.use('/api/directions', directionsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production (Expo web build)
if (isProduction) {
  app.use(express.static(path.join(process.cwd(), 'dist')));
  
  // SPA fallback - serve index.html for all non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
  });
} else {
  // Development: just show API is running
  app.get('/', (req, res) => {
    res.json({ 
      message: '🌙 AstroBar API - Promociones Nocturnas',
      location: 'Buenos Aires, Argentina 🇦🇷',
      frontend: process.env.FRONTEND_URL || 'http://localhost:8081',
      docs: '/api'
    });
  });
}