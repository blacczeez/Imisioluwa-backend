import { Router } from 'express';
import { body } from 'express-validator';
import { authController } from '../controllers/authController';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

// Register (optional for customers)
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    validate,
  ],
  authController.register
);

// Login (customer or admin)
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
  ],
  authController.login
);

// Admin login
router.post(
  '/admin/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
  ],
  authController.adminLogin
);

// Get current user
router.get('/me', auth, authController.me);

export default router;
