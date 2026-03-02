import { Router } from 'express';
import { body } from 'express-validator';
import { categoryController } from '../controllers/categoryController';
import { auth } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import { validate } from '../middleware/validation';

const router = Router();

// Public route
router.get('/', categoryController.getAll);

// Admin routes
router.post(
  '/',
  auth,
  adminAuth,
  [
    body('name_en').notEmpty().withMessage('English name is required'),
    body('name_yo').notEmpty().withMessage('Yoruba name is required'),
    body('slug').notEmpty().withMessage('Slug is required'),
    validate,
  ],
  categoryController.create
);

router.put('/:id', auth, adminAuth, categoryController.update);
router.delete('/:id', auth, adminAuth, categoryController.delete);

export default router;
