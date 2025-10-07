import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { StorageConfig } from './config/storage';
import { initializeSocketIO, setSocketIOInstance, getWebSocketHealth } from './sockets';

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

const app = express();
const prisma = new PrismaClient();

// Log the configuration being used
console.log('Server Configuration:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('PORT:', process.env.PORT);

const corsOptions = {
  origin: process.env.FRONTEND_URL || '*', // Use wildcard in production if FRONTEND_URL not set
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Configure Helmet with relaxed CSP for document preview in iframes
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameSrc: ["'self'"],
      // Allow this backend to be embedded in iframes from frontend
      frameAncestors: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

// Trust proxy for Render deployment (needed for WebSocket)
app.set('trust proxy', 1);

app.use(cors(corsOptions));
app.use(express.json());

/**
 * Calculate the project root directory
 * Works in both development and production environments
 */
function getProjectRoot(): string {
  // In development: __dirname is like /path/to/project/backend/src
  // In production: __dirname is like /path/to/project/backend/dist

  let currentDir = __dirname;

  // Walk up the directory tree to find the project root
  // Look for package.json or backend directory to identify project root
  while (currentDir !== path.dirname(currentDir)) { // Not at filesystem root
    const parentDir = path.dirname(currentDir);

    // Check if parent contains backend directory (indicating project root)
    if (fs.existsSync(path.join(parentDir, 'backend')) &&
        (fs.existsSync(path.join(parentDir, 'package.json')) ||
         fs.existsSync(path.join(parentDir, 'frontend')))) {
      console.log(`[SERVER] Found project root: ${parentDir}`);
      return parentDir;
    }

    currentDir = parentDir;
  }

  // Fallback: assume current working directory is project root
  console.log(`[SERVER] Using fallback project root: ${process.cwd()}`);
  return process.cwd();
}

// Ensure uploads directory exists - Use consistent project root path
const projectRoot = getProjectRoot();
const uploadsDir = path.join(projectRoot, 'backend/uploads');
const contractsDir = path.join(uploadsDir, 'contracts');
const documentsDir = path.join(uploadsDir, 'documents');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}
if (!fs.existsSync(contractsDir)) {
  fs.mkdirSync(contractsDir, { recursive: true });
  console.log('Created contracts directory:', contractsDir);
}
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
  console.log('Created documents directory:', documentsDir);
}

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));

// Basic health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
import authRoutes from './routes/auth';
import partnerRoutes from './routes/partner';
import registrationRoutes from './routes/registration';
import paymentRoutes from './routes/payment';
import offerRoutes from './routes/offers';
import userRoutes from './routes/userClean';
import courseRoutes from './routes/courses';
import enrollmentRoutes from './routes/enrollment';
import offerTypesRoutes from './routes/offerTypes';
import adminRoutes from './routes/admin';
import userDocumentRoutes from './routes/userDocuments';
import documentUploadRoutes from './routes/documentUpload';
import documentsRoutes from './routes/documents';
import partnerEmployeesRoutes from './routes/partnerEmployees';
import subPartnersRoutes from './routes/subPartners';
import offerInheritanceRoutes from './routes/offerInheritance';
import partnerCouponsRoutes from './routes/_refactored/partnerCoupons';
import partnerUsersRoutes from './routes/_refactored/partnerUsers';
import documentUploadUnifiedRoutes from './routes/documentUploadUnified';
import partnerUnifiedRoutes from './routes/partnerUnified';
import documentDiagnosticsRoutes from './routes/documentDiagnostics';
import archiveRoutes from './routes/archive';
import noticesRoutes from './routes/notices';
import noticeUploadRoutes from './routes/notices/upload';
// TODO: Fix partnerRegistrations.ts - has compilation errors with legacy partner system
// import partnerRegistrationsRoutes from './routes/_refactored/partnerRegistrations';

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV
  });
});

app.use('/api/auth', authRoutes);

// UNIFIED STORAGE ROUTES - Must be BEFORE legacy routes for proper override
app.use('/api/document-upload-unified', documentUploadUnifiedRoutes);
app.use('/api/partners', partnerUnifiedRoutes); // ✅ Unified partner routes with proper R2 proxy
// TODO: Fix and re-enable partnerRegistrations routes
// app.use('/api/partners', partnerRegistrationsRoutes); // ✅ Refactored partner registration routes

app.use('/api/partners', partnerRoutes); // Main partner routes (legacy - some endpoints still used)
app.use('/api/partner-employees', partnerEmployeesRoutes); // NEW: Simplified partner routes
app.use('/api/sub-partners', subPartnersRoutes); // NEW: Sub-partner management for premium accounts
app.use('/api/offer-inheritance', offerInheritanceRoutes); // NEW: Offer inheritance system for sub-partners
app.use('/api/partners', partnerCouponsRoutes); // NEW: Refactored coupon management
app.use('/api/partners', partnerUsersRoutes); // NEW: Refactored partner users management
app.use('/api/registration', registrationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/offers', offerRoutes);
// app.use('/api/user/documents', userDocumentRoutes); // Disabled - now handled by userRoutes
app.use('/api/user', userRoutes); // Clean user routes with integrated document handling
app.use('/api/documents', documentsRoutes); // New unified documents API
app.use('/api/document-upload', documentUploadRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/offer-types', offerTypesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/archive', archiveRoutes);
app.use('/api/notices/upload', noticeUploadRoutes); // Notice file uploads - MUST be BEFORE main notices routes
app.use('/api/notices', noticesRoutes); // Notice Board system

// Serve uploaded notice files
app.use('/uploads/notices', express.static(path.join(__dirname, '../uploads/notices')));

// DIAGNOSTICS ROUTES (Admin tools for document troubleshooting)
app.use('/api/document-diagnostics', documentDiagnosticsRoutes);

const PORT = parseInt(process.env.PORT || '8000', 10);

// 🔥 ANTI-DEPLOYMENT BREAKAGE: Inizializza directory storage
console.log('🏗️ Initializing storage directories...');
StorageConfig.initializeDirectories();

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocketIO(httpServer);
setSocketIOInstance(io);

// WebSocket health check endpoint
app.get('/api/health/websocket', (_req, res) => {
  try {
    const health = getWebSocketHealth(io);
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to get WebSocket health',
    });
  }
});

const server = httpServer.listen(PORT, () => {
  const host = process.env.HOST || 'localhost';
  console.log(`✅ Server running on http://${host}:${PORT}`);
  console.log(`🔌 WebSocket server ready on ws://${host}:${PORT}`);
  console.log(`📁 Upload base path: ${StorageConfig.uploadBasePath}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

export default app;