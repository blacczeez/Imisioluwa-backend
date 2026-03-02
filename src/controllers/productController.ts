import { Request, Response } from 'express';
import prisma from '../utils/database';
import { paginate } from '../utils/helpers';
import { logger } from '../utils/logger';
import { imageUploadService } from '../services/imageUploadService';

export const productController = {
  // Get all products (public)
  getAll: async (req: Request, res: Response) => {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        search,
        is_active = 'true',
      } = req.query;

      const { skip, take } = paginate(Number(page), Number(limit));

      const where: any = {
        is_active: is_active === 'true',
      };

      if (category) {
        where.category_id = category;
      }

      if (search) {
        where.OR = [
          { name_en: { contains: search as string, mode: 'insensitive' } },
          { name_yo: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: { category: true },
          skip,
          take,
          orderBy: { created_at: 'desc' },
        }),
        prisma.product.count({ where }),
      ]);

      res.json({ products, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      logger.error('Get products error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Get single product (public)
  getById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const product = await prisma.product.findUnique({
        where: { id },
        include: { category: true },
      });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json(product);
    } catch (error) {
      logger.error('Get product error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Create product (admin only)
  create: async (req: Request, res: Response) => {
    try {
      const {
        name_en,
        name_yo,
        description_en,
        description_yo,
        price,
        category_id,
        stock_quantity,
      } = req.body;

      const product = await prisma.product.create({
        data: {
          name_en,
          name_yo,
          description_en,
          description_yo,
          price: parseFloat(price),
          category_id,
          stock_quantity: parseInt(stock_quantity),
          image_urls: [],
        },
        include: { category: true },
      });

      logger.info(`Product created: ${product.id}`);
      res.status(201).json(product);
    } catch (error) {
      logger.error('Create product error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Update product (admin only)
  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        name_en,
        name_yo,
        description_en,
        description_yo,
        price,
        category_id,
        stock_quantity,
        is_active,
      } = req.body;

      const product = await prisma.product.update({
        where: { id },
        data: {
          ...(name_en && { name_en }),
          ...(name_yo && { name_yo }),
          ...(description_en && { description_en }),
          ...(description_yo && { description_yo }),
          ...(price && { price: parseFloat(price) }),
          ...(category_id && { category_id }),
          ...(stock_quantity !== undefined && { stock_quantity: parseInt(stock_quantity) }),
          ...(is_active !== undefined && { is_active }),
        },
        include: { category: true },
      });

      logger.info(`Product updated: ${product.id}`);
      res.json(product);
    } catch (error) {
      logger.error('Update product error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Delete product (admin only)
  delete: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Delete associated images
      if (product.image_urls.length > 0) {
        imageUploadService.deleteMultipleImages(product.image_urls);
      }

      await prisma.product.delete({ where: { id } });

      logger.info(`Product deleted: ${id}`);
      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      logger.error('Delete product error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Upload product images (admin only)
  uploadImages: async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const imageUrls = files.map((file) => imageUploadService.saveImage(file));
      const updatedImageUrls = [...product.image_urls, ...imageUrls];

      const updatedProduct = await prisma.product.update({
        where: { id },
        data: { image_urls: updatedImageUrls },
      });

      logger.info(`Images uploaded for product: ${id}`);
      res.json(updatedProduct);
    } catch (error) {
      logger.error('Upload images error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Delete product image (admin only)
  deleteImage: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { imageUrl } = req.body;

      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const updatedImageUrls = product.image_urls.filter((url) => url !== imageUrl);
      imageUploadService.deleteImage(imageUrl);

      const updatedProduct = await prisma.product.update({
        where: { id },
        data: { image_urls: updatedImageUrls },
      });

      logger.info(`Image deleted from product: ${id}`);
      res.json(updatedProduct);
    } catch (error) {
      logger.error('Delete image error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },
};
