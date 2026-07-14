import { Request, Response } from 'express';
import prisma from '../utils/database';
import { logger } from '../utils/logger';
import {
  buildContentsSnapshot,
  getMaxPackageQuantity,
  getPackageStockBlockers,
  isPackageInStock,
  slugify,
  PackageWithItems,
} from '../utils/packageHelpers';
import { imageUploadService } from '../services/imageUploadService';

const packageInclude = {
  items: {
    include: {
      variant: {
        include: { product: true },
      },
    },
    orderBy: { quantity: 'asc' as const },
  },
};

function serializePackage(
  pkg: PackageWithItems,
  options?: { admin?: boolean; hideIfUnavailable?: boolean }
) {
  const inStock = isPackageInStock(pkg);
  const maxQuantity = getMaxPackageQuantity(pkg);
  const stockBlockers = getPackageStockBlockers(pkg);

  // Storefront listings hide inactive / out-of-stock packages.
  // Direct package pages still return the package so buyers (and admin View) can see it.
  if (options?.hideIfUnavailable && (!pkg.is_active || !inStock)) {
    return null;
  }

  if (!options?.admin && !pkg.is_active) {
    return null;
  }

  return {
    ...pkg,
    in_stock: inStock,
    max_quantity: maxQuantity,
    stock_blockers: options?.admin ? stockBlockers : undefined,
    items: pkg.items.map((item) => ({
      id: item.id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      variant: {
        id: item.variant.id,
        weight_ml: item.variant.weight_ml,
        stock_quantity: item.variant.stock_quantity,
        is_active: item.variant.is_active,
        product: {
          id: item.variant.product.id,
          slug: item.variant.product.slug,
          name_en: item.variant.product.name_en,
          name_yo: item.variant.product.name_yo,
          image_urls: item.variant.product.image_urls,
          is_active: item.variant.product.is_active,
        },
      },
    })),
  };
}

export const packageController = {
  getAll: async (req: Request, res: Response) => {
    try {
      const { promoted, include_inactive } = req.query;
      const isAdmin = include_inactive === 'true';

      const packages = await prisma.package.findMany({
        where: {
          ...(promoted === 'true' ? { is_promoted: true } : {}),
          ...(isAdmin ? {} : { is_active: true }),
        },
        include: packageInclude,
        orderBy: [{ is_promoted: 'desc' }, { created_at: 'desc' }],
      });

      const serialized = packages
        .map((pkg) =>
          serializePackage(pkg, {
            admin: isAdmin,
            hideIfUnavailable: !isAdmin,
          })
        )
        .filter(Boolean);

      res.json(serialized);
    } catch (error) {
      logger.error('Get packages error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  getBySlug: async (req: Request, res: Response) => {
    try {
      const pkg = await prisma.package.findUnique({
        where: { slug: req.params.slug },
        include: packageInclude,
      });

      if (!pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }

      const serialized = serializePackage(pkg);
      if (!serialized) {
        return res.status(404).json({ error: 'Package not available' });
      }

      res.json(serialized);
    } catch (error) {
      logger.error('Get package by slug error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  getById: async (req: Request, res: Response) => {
    try {
      const pkg = await prisma.package.findUnique({
        where: { id: req.params.id },
        include: packageInclude,
      });

      if (!pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }

      res.json(serializePackage(pkg, { admin: true }));
    } catch (error) {
      logger.error('Get package by id error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  create: async (req: Request, res: Response) => {
    try {
      const {
        name_en,
        name_yo,
        problem_statement_en,
        description_en,
        description_yo,
        price,
        image_url,
        is_active = true,
        is_promoted = false,
        items,
        slug: requestedSlug,
      } = req.body;

      const slug = requestedSlug?.trim() || slugify(name_en);
      const existing = await prisma.package.findUnique({ where: { slug } });
      if (existing) {
        return res.status(400).json({ error: 'A package with this slug already exists' });
      }

      const variantIds = items.map((item: { variant_id: string }) => item.variant_id);
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: true },
      });

      if (variants.length !== variantIds.length) {
        return res.status(400).json({ error: 'One or more variants were not found' });
      }

      const pkg = await prisma.package.create({
        data: {
          slug,
          name_en,
          name_yo,
          problem_statement_en,
          description_en,
          description_yo,
          price,
          image_url: image_url || null,
          is_active,
          is_promoted,
          items: {
            create: items.map((item: { variant_id: string; quantity: number }) => ({
              variant_id: item.variant_id,
              quantity: item.quantity,
            })),
          },
        },
        include: packageInclude,
      });

      logger.info(`Package created: ${pkg.slug}`);
      res.status(201).json(serializePackage(pkg, { admin: true }));
    } catch (error) {
      logger.error('Create package error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        name_en,
        name_yo,
        problem_statement_en,
        description_en,
        description_yo,
        price,
        image_url,
        is_active,
        is_promoted,
        items,
        slug: requestedSlug,
      } = req.body;

      const existing = await prisma.package.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Package not found' });
      }

      const slug = requestedSlug?.trim() || existing.slug;
      if (slug !== existing.slug) {
        const slugTaken = await prisma.package.findFirst({
          where: { slug, NOT: { id } },
        });
        if (slugTaken) {
          return res.status(400).json({ error: 'A package with this slug already exists' });
        }
      }

      if (items) {
        const variantIds = items.map((item: { variant_id: string }) => item.variant_id);
        const variants = await prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
        });
        if (variants.length !== variantIds.length) {
          return res.status(400).json({ error: 'One or more variants were not found' });
        }

        await prisma.packageItem.deleteMany({ where: { package_id: id } });
      }

      const pkg = await prisma.package.update({
        where: { id },
        data: {
          ...(slug !== undefined ? { slug } : {}),
          ...(name_en !== undefined ? { name_en } : {}),
          ...(name_yo !== undefined ? { name_yo } : {}),
          ...(problem_statement_en !== undefined ? { problem_statement_en } : {}),
          ...(description_en !== undefined ? { description_en } : {}),
          ...(description_yo !== undefined ? { description_yo } : {}),
          ...(price !== undefined ? { price } : {}),
          ...(image_url !== undefined ? { image_url } : {}),
          ...(is_active !== undefined ? { is_active } : {}),
          ...(is_promoted !== undefined ? { is_promoted } : {}),
          ...(items
            ? {
                items: {
                  create: items.map((item: { variant_id: string; quantity: number }) => ({
                    variant_id: item.variant_id,
                    quantity: item.quantity,
                  })),
                },
              }
            : {}),
        },
        include: packageInclude,
      });

      logger.info(`Package updated: ${pkg.slug}`);
      res.json(serializePackage(pkg, { admin: true }));
    } catch (error) {
      logger.error('Update package error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  delete: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await prisma.package.delete({ where: { id } });
      logger.info(`Package deleted: ${id}`);
      res.json({ message: 'Package deleted' });
    } catch (error) {
      logger.error('Delete package error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  uploadImage: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: 'Image file is required' });
      }

      const imageUrl = await imageUploadService.saveImage(req.file);
      const pkg = await prisma.package.update({
        where: { id },
        data: { image_url: imageUrl },
        include: packageInclude,
      });

      res.json(serializePackage(pkg, { admin: true }));
    } catch (error) {
      logger.error('Upload package image error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },
};
