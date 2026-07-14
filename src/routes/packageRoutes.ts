import { Router } from 'express';
import { body } from 'express-validator';
import { packageController } from '../controllers/packageController';
import { auth } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import { upload } from '../middleware/upload';
import { validate } from '../middleware/validation';

const router = Router();

router.get('/', packageController.getAll);
router.get('/slug/:slug', packageController.getBySlug);
router.get('/:id', packageController.getById);

router.post(
  '/',
  auth,
  adminAuth,
  [
    body('name_en').notEmpty().withMessage('English name is required'),
    body('name_yo').notEmpty().withMessage('Yoruba name is required'),
    body('problem_statement_en').notEmpty().withMessage('Problem statement is required'),
    body('description_en').notEmpty().withMessage('English description is required'),
    body('description_yo').notEmpty().withMessage('Yoruba description is required'),
    body('price').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
    body('items').isArray({ min: 1 }).withMessage('At least one package item is required'),
    body('items.*.variant_id').notEmpty().withMessage('Variant is required'),
    body('items.*.quantity').isInt({ gt: 0 }).withMessage('Item quantity must be greater than 0'),
    validate,
  ],
  packageController.create
);

router.put('/:id', auth, adminAuth, packageController.update);
router.delete('/:id', auth, adminAuth, packageController.delete);
router.post(
  '/:id/image',
  auth,
  adminAuth,
  upload.single('image') as any,
  packageController.uploadImage
);

export default router;
