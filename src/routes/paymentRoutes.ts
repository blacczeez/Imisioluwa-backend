import { Router } from 'express';
import { body } from 'express-validator';
import { paymentController } from '../controllers/paymentController';
import { validate } from '../middleware/validation';

const router = Router();

router.post(
  '/initialize',
  [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Valid amount is required'),
    validate,
  ],
  paymentController.initialize
);

router.post('/verify', paymentController.verify);
router.get('/:orderId', paymentController.getByOrderId);

export default router;
