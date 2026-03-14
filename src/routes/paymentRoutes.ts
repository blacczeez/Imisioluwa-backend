import { Router } from 'express';
import express from 'express';
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

// Paystack verification
router.post('/verify/paystack', paymentController.verifyPaystack);

// Stripe verification (from frontend)
router.post('/verify/stripe', paymentController.verifyStripe);

// Stripe webhook (needs raw body)
router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  paymentController.stripeWebhook
);

router.get('/:orderId', paymentController.getByOrderId);

export default router;
