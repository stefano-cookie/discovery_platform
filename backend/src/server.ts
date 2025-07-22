import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
import authRoutes from './routes/auth';
import partnerRoutes from './routes/partner';
import registrationRoutes from './routes/registration';
import paymentRoutes from './routes/payment';
import offerRoutes from './routes/offers';

app.use('/api/auth', authRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/registration', registrationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/offers', offerRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;