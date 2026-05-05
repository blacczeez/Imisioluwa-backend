import { Request, Response } from 'express';
import prisma from '../utils/database';
import { paginate, slugify } from '../utils/helpers';
import { logger } from '../utils/logger';
import { imageUploadService } from '../services/imageUploadService';

const parseOptionalFloat = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseOptionalInt = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

type VariantInput = {
  id?: string;
  weight_ml?: number | string;
  price?: number | string;
  price_usd?: number | string;
  price_gbp?: number | string;
  price_eur?: number | string;
  stock_quantity?: number | string;
  is_active?: boolean;
};

const normalizeVariants = (variantsRaw: unknown): Array<{
  id?: string;
  weight_ml: number;
  price: number;
  price_usd?: number;
  price_gbp?: number;
  price_eur?: number;
  stock_quantity: number;
  is_active: boolean;
}> => {
  if (!Array.isArray(variantsRaw)) return [];

  return (variantsRaw as VariantInput[])
    .map((variant) => {
      const weight_ml = parseOptionalInt(variant.weight_ml);
      const price = parseOptionalFloat(variant.price);
      const stock_quantity = parseOptionalInt(variant.stock_quantity) ?? 0;
      if (!weight_ml || weight_ml <= 0 || price === undefined || price <= 0) return null;
      return {
        id: variant.id,
        weight_ml,
        price,
        price_usd: parseOptionalFloat(variant.price_usd),
        price_gbp: parseOptionalFloat(variant.price_gbp),
        price_eur: parseOptionalFloat(variant.price_eur),
        stock_quantity,
        is_active: variant.is_active ?? true,
      };
    })
    .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant));
};

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
        include_out_of_stock = 'false',
        include_inactive = 'false',
      } = req.query;

      const { skip, take } = paginate(Number(page), Number(limit));

      const where: any = {};

      if (include_inactive !== 'true') {
        where.is_active = is_active === 'true';
      }

      if (include_out_of_stock !== 'true') {
        where.stock_quantity = { gt: 0 };
      }

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
          include: {
            category: true,
            variants: { orderBy: { weight_ml: 'asc' } },
          },
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
        include: {
          category: true,
          variants: { orderBy: { weight_ml: 'asc' } },
        },
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

  // Get single product by slug or id (public) — supports /product/my-slug or /product/uuid for backwards compatibility
  getBySlug: async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

      let product = await prisma.product.findUnique({
        where: { slug },
        include: {
          category: true,
          variants: { orderBy: { weight_ml: 'asc' } },
        },
      });

      if (!product) {
        product = await prisma.product.findFirst({
          where: {
            slug: { equals: slug, mode: 'insensitive' },
          },
          include: {
            category: true,
            variants: { orderBy: { weight_ml: 'asc' } },
          },
        });
      }

      if (!product && isUuid) {
        product = await prisma.product.findUnique({
          where: { id: slug },
          include: {
            category: true,
            variants: { orderBy: { weight_ml: 'asc' } },
          },
        });
      }

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json(product);
    } catch (error) {
      logger.error('Get product by slug error:', error);
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
        price_usd,
        price_gbp,
        price_eur,
        weight_kg,
        variants,
        category_id,
        stock_quantity,
      } = req.body;

      const normalizedVariants = normalizeVariants(variants);
      const fallbackWeightMl = Math.max(1, Math.round((parseOptionalFloat(weight_kg) ?? 1) * 1000));
      const fallbackPrice = parseOptionalFloat(price) ?? 0;
      const fallbackStock = parseOptionalInt(stock_quantity) ?? 0;
      const finalVariants = normalizedVariants.length > 0
        ? normalizedVariants
        : [{
          weight_ml: fallbackWeightMl,
          price: fallbackPrice,
          price_usd: parseOptionalFloat(price_usd),
          price_gbp: parseOptionalFloat(price_gbp),
          price_eur: parseOptionalFloat(price_eur),
          stock_quantity: fallbackStock,
          is_active: true,
        }];

      const primaryVariant = [...finalVariants].sort((a, b) => a.weight_ml - b.weight_ml)[0];

      // Generate unique slug from name_en
      let slug = slugify(name_en);
      const existingSlug = await prisma.product.findUnique({ where: { slug } });
      if (existingSlug) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      const product = await prisma.product.create({
        data: {
          name_en,
          name_yo,
          description_en,
          description_yo,
          price: parseFloat(price),
          ...(parseOptionalFloat(price_usd) !== undefined && { price_usd: parseOptionalFloat(price_usd) }),
          ...(parseOptionalFloat(price_gbp) !== undefined && { price_gbp: parseOptionalFloat(price_gbp) }),
          ...(parseOptionalFloat(price_eur) !== undefined && { price_eur: parseOptionalFloat(price_eur) }),
          weight_kg: primaryVariant.weight_ml / 1000,
          category_id,
          stock_quantity: primaryVariant.stock_quantity,
          image_urls: [],
          slug,
          variants: {
            create: finalVariants.map((variant) => ({
              weight_ml: variant.weight_ml,
              price: variant.price,
              ...(variant.price_usd !== undefined && { price_usd: variant.price_usd }),
              ...(variant.price_gbp !== undefined && { price_gbp: variant.price_gbp }),
              ...(variant.price_eur !== undefined && { price_eur: variant.price_eur }),
              stock_quantity: variant.stock_quantity,
              is_active: variant.is_active,
            })),
          },
        },
        include: {
          category: true,
          variants: { orderBy: { weight_ml: 'asc' } },
        },
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
        price_usd,
        price_gbp,
        price_eur,
        weight_kg,
        variants,
        category_id,
        stock_quantity,
        is_active,
      } = req.body;

      const normalizedVariants = normalizeVariants(variants);

      // Regenerate slug if name_en changes
      let slugData: { slug?: string } = {};
      if (name_en) {
        let slug = slugify(name_en);
        const existingSlug = await prisma.product.findFirst({
          where: { slug, id: { not: id } },
        });
        if (existingSlug) {
          slug = `${slug}-${Date.now().toString(36)}`;
        }
        slugData = { slug };
      }

      const product = await prisma.product.update({
        where: { id },
        data: {
          ...(name_en && { name_en }),
          ...(name_yo && { name_yo }),
          ...(description_en && { description_en }),
          ...(description_yo && { description_yo }),
          ...(parseOptionalFloat(price) !== undefined && { price: parseOptionalFloat(price) }),
          ...(parseOptionalFloat(price_usd) !== undefined && { price_usd: parseOptionalFloat(price_usd) }),
          ...(parseOptionalFloat(price_gbp) !== undefined && { price_gbp: parseOptionalFloat(price_gbp) }),
          ...(parseOptionalFloat(price_eur) !== undefined && { price_eur: parseOptionalFloat(price_eur) }),
          ...(parseOptionalFloat(weight_kg) !== undefined && { weight_kg: parseOptionalFloat(weight_kg) }),
          ...(category_id && { category_id }),
          ...(stock_quantity !== undefined && { stock_quantity: parseInt(stock_quantity) }),
          ...(is_active !== undefined && { is_active }),
          ...slugData,
        },
        include: {
          category: true,
          variants: { orderBy: { weight_ml: 'asc' } },
        },
      });

      if (normalizedVariants.length > 0) {
        const existingVariants = await prisma.productVariant.findMany({
          where: { product_id: id },
          select: { id: true },
        });
        const incomingIds = new Set(normalizedVariants.map((variant) => variant.id).filter(Boolean) as string[]);

        await prisma.productVariant.deleteMany({
          where: {
            product_id: id,
            id: { notIn: Array.from(incomingIds) },
          },
        });

        for (const variant of normalizedVariants) {
          if (variant.id && existingVariants.some((existing) => existing.id === variant.id)) {
            await prisma.productVariant.update({
              where: { id: variant.id },
              data: {
                weight_ml: variant.weight_ml,
                price: variant.price,
                price_usd: variant.price_usd,
                price_gbp: variant.price_gbp,
                price_eur: variant.price_eur,
                stock_quantity: variant.stock_quantity,
                is_active: variant.is_active,
              },
            });
          } else {
            await prisma.productVariant.create({
              data: {
                product_id: id,
                weight_ml: variant.weight_ml,
                price: variant.price,
                price_usd: variant.price_usd,
                price_gbp: variant.price_gbp,
                price_eur: variant.price_eur,
                stock_quantity: variant.stock_quantity,
                is_active: variant.is_active,
              },
            });
          }
        }

        const refreshedVariants = await prisma.productVariant.findMany({
          where: { product_id: id, is_active: true },
          orderBy: { weight_ml: 'asc' },
        });
        const primaryVariant = refreshedVariants[0];
        if (primaryVariant) {
          await prisma.product.update({
            where: { id },
            data: {
              price: primaryVariant.price,
              price_usd: primaryVariant.price_usd,
              price_gbp: primaryVariant.price_gbp,
              price_eur: primaryVariant.price_eur,
              stock_quantity: primaryVariant.stock_quantity,
              weight_kg: primaryVariant.weight_ml / 1000,
            },
          });
        }
      }

      const updatedProduct = await prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          variants: { orderBy: { weight_ml: 'asc' } },
        },
      });

      logger.info(`Product updated: ${product.id}`);
      res.json(updatedProduct ?? product);
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
        await imageUploadService.deleteMultipleImages(product.image_urls);
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

      const imageUrls = await Promise.all(files.map((file) => imageUploadService.saveImage(file)));
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
      await imageUploadService.deleteImage(imageUrl);

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
