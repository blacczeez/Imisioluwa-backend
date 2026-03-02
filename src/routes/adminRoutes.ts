import { Router } from 'express';
import { body } from 'express-validator';
import { adminController } from '../controllers/adminController';
import { auth } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import { validate } from '../middleware/validation';

const router = Router();

// All routes require admin auth
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

export default router;
