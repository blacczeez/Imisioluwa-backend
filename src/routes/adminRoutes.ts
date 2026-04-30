import { Router } from 'express';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';
import { adminController } from '../controllers/adminController';
import { settingsController } from '../controllers/settingsController';
import { shippingController } from '../controllers/shippingController';
import { auth } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import { validate } from '../middleware/validation';
import { addSSEClient } from '../events/listeners/sseListener';
import { jwtConfig } from '../config/jwt';

const router = Router();

// SSE endpoint — uses token query param since EventSource doesn't support headers
router.get('/orders/stream', (req, res) => {
  const token = req.query.token as string;
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    jwt.verify(token, jwtConfig.secret);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.write('event: connected\ndata: {}\n\n');
  addSSEClient(res);

  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// All remaining routes require admin auth
router.use(auth);
router.use(adminAuth);

router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/analytics', adminController.getAnalytics);
router.get('/orders', adminController.getAllOrders);
router.put(
  '/orders/:id/status',
  [
    body('status').notEmpty().withMessage('Status is required'),
    validate,
  ],
  adminController.updateOrderStatus
);
router.get('/inventory', adminController.getInventoryStatus);
router.get('/customers', adminController.getAllCustomers);

// Settings
router.get('/settings', settingsController.getAll);
router.put('/settings', settingsController.update);

// Shipping zones
router.get('/shipping-zones', shippingController.getAll);
router.post('/shipping-zones', shippingController.create);
router.put('/shipping-zones/:id', shippingController.update);
router.delete('/shipping-zones/:id', shippingController.delete);
router.get('/shipping-nigeria-rates', shippingController.getNigeriaRates);
router.post('/shipping-nigeria-rates', shippingController.upsertNigeriaRate);
router.delete('/shipping-nigeria-rates/:id', shippingController.deleteNigeriaRate);

export default router;
