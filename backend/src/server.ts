import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import path from 'path';

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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

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

app.use('/api/auth', authRoutes);
app.use('/api/partners', partnerRoutes);
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

const PORT = parseInt(process.env.PORT || '8000', 10);

const server = app.listen(PORT, () => {
  const host = process.env.HOST || 'localhost';
  console.log(`Server running on http://${host}:${PORT}`);
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