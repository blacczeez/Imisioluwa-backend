import { Router } from 'express';
import { body } from 'express-validator';
import { orderController } from '../controllers/orderController';
import { validate } from '../middleware/validation';

const router = Router();

// Public routes (no auth required for guest checkout)
router.post(
  '/',
  [
    body('customer_name').notEmpty().withMessage('Customer name is required'),
    body('customer_email').isEmail().withMessage('Valid email is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('delivery_address').notEmpty().withMessage('Delivery address is required'),
    body('items').isArray({ min: 1 }).withMessage('Order items are required'),
    body('payment_method').isIn(['online', 'cod']).withMessage('Payment method must be online or cod'),
    body('currency').optional().isIn(['NGN', 'USD', 'GBP', 'EUR']).withMessage('Invalid currency'),
    body('country').optional().isLength({ min: 2, max: 2 }).withMessage('Country must be ISO 2-letter code'),
    validate,
  ],
  orderController.create
);

router.get('/track', orderController.track);
router.get('/:id', orderController.getById);

export default router;
