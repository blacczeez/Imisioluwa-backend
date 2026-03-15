import { Request, Response } from 'express';
import prisma from '../utils/database';
import { logger } from '../utils/logger';

export const categoryController = {
  // Get all categories (public)
  getAll: async (req: Request, res: Response) => {
    try {
      const categories = await prisma.category.findMany({
        include: {
          children: true,
          _count: {
            select: { products: true },
          },
        },
        orderBy: { name_en: 'asc' },
      });

      res.json(categories);
    } catch (error) {
      logger.error('Get categories error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Get category by slug with its products (public)
  getBySlug: async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      const category = await prisma.category.findUnique({
        where: { slug },
        include: {
          products: {
            where: { is_active: true, stock_quantity: { gt: 0 } },
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      res.json(category);
    } catch (error) {
      logger.error('Get category by slug error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Create category (admin only)
  create: async (req: Request, res: Response) => {
    try {
      const { name_en, name_yo, slug, image_url, parent_id } = req.body;

      const category = await prisma.category.create({
        data: {
          name_en,
          name_yo,
          slug,
          image_url,
          parent_id,
        },
      });

      logger.info(`Category created: ${category.id}`);
      res.status(201).json(category);
    } catch (error) {
      logger.error('Create category error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Update category (admin only)
  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name_en, name_yo, slug, image_url, parent_id } = req.body;

      const category = await prisma.category.update({
        where: { id },
        data: {
          ...(name_en && { name_en }),
          ...(name_yo && { name_yo }),
          ...(slug && { slug }),
          ...(image_url !== undefined && { image_url }),
          ...(parent_id !== undefined && { parent_id }),
        },
      });

      logger.info(`Category updated: ${category.id}`);
      res.json(category);
    } catch (error) {
      logger.error('Update category error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Delete category (admin only)
  delete: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await prisma.category.delete({ where: { id } });

      logger.info(`Category deleted: ${id}`);
      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      logger.error('Delete category error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },
};
