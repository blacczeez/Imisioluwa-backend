import { Router } from 'express';
import { body } from 'express-validator';
import { productController } from '../controllers/productController';
import { auth } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import { upload } from '../middleware/upload';
import { validate } from '../middleware/validation';

const router = Router();

// Public routes
router.get('/', productController.getAll);
router.get('/:id', productController.getById);

// Admin routes
router.post(
  '/',
  auth,
  adminAuth,
  [
    body('name_en').notEmpty().withMessage('English name is required'),
    body('name_yo').notEmpty().withMessage('Yoruba name is required'),
    body('description_en').notEmpty().withMessage('English description is required'),
    body('description_yo').notEmpty().withMessage('Yoruba description is required'),
    body('price').isFloat({ gt: 0 }).withMessage('Valid price is required'),
    body('category_id').notEmpty().withMessage('Category is required'),
    body('stock_quantity').isInt({ min: 0 }).withMessage('Valid stock quantity is required'),
    validate,
  ],
  productController.create
);

router.put('/:id', auth, adminAuth, productController.update);
router.delete('/:id', auth, adminAuth, productController.delete);
router.post(
  '/:id/images',
  auth,
  adminAuth,
  upload.array('images', 5) as any,
  productController.uploadImages
);
router.delete('/:id/images', auth, adminAuth, productController.deleteImage);

export default router;
