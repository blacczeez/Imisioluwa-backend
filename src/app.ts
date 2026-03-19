import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from './utils/logger';
import { registerEmailListeners } from './events/listeners/emailListener';
import { registerStockListeners } from './events/listeners/stockListener';
import { registerWhatsAppListeners } from './events/listeners/whatsappListener';
import { registerSSEListeners } from './events/listeners/sseListener';
import { startPaymentExpiryJob } from './jobs/paymentExpiry';
import { settingsController } from './controllers/settingsController';
import { shippingController } from './controllers/shippingController';
import { sitemapController } from './controllers/sitemapController';
import { geoController } from './controllers/geoController';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import categoryRoutes from './routes/categoryRoutes';
import orderRoutes from './routes/orderRoutes';
import paymentRoutes from './routes/paymentRoutes';
import adminRoutes from './routes/adminRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Stripe webhook needs raw body — must come before json middleware
app.use('/api/payments/webhook/stripe', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Public routes (no auth)
app.get('/api/settings/payment-methods', settingsController.getPaymentMethods);
app.get('/api/shipping/rate', shippingController.getRateByCountry);
app.get('/api/geo', geoController.getCountry);

// Register event listeners
registerEmailListeners();
registerStockListeners();
registerWhatsAppListeners();
registerSSEListeners();

// Start background jobs
startPaymentExpiryJob();

// Sitemap
app.get('/sitemap.xml', sitemapController.generate);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
