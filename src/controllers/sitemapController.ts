import { Request, Response } from 'express';
import prisma from '../utils/database';
import { logger } from '../utils/logger';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export const sitemapController = {
  generate: async (req: Request, res: Response) => {
    try {
      const [products, categories] = await Promise.all([
        prisma.product.findMany({
          where: { is_active: true, stock_quantity: { gt: 0 } },
          select: { slug: true, updated_at: true },
          orderBy: { updated_at: 'desc' },
        }),
        prisma.category.findMany({
          select: { slug: true, created_at: true },
          orderBy: { name_en: 'asc' },
        }),
      ]);

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      // Home page
      xml += '  <url>\n';
      xml += `    <loc>${FRONTEND_URL}/</loc>\n`;
      xml += '    <changefreq>daily</changefreq>\n';
      xml += '    <priority>1.0</priority>\n';
      xml += '  </url>\n';

      // Category pages
      for (const category of categories) {
        xml += '  <url>\n';
        xml += `    <loc>${FRONTEND_URL}/category/${category.slug}</loc>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.9</priority>\n';
        xml += '  </url>\n';
      }

      // Product pages
      for (const product of products) {
        const lastmod = product.updated_at.toISOString().split('T')[0];
        xml += '  <url>\n';
        xml += `    <loc>${FRONTEND_URL}/product/${product.slug}</loc>\n`;
        xml += `    <lastmod>${lastmod}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.8</priority>\n';
        xml += '  </url>\n';
      }

      xml += '</urlset>';

      res.set('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      logger.error('Sitemap generation error:', error);
      res.status(500).send('Error generating sitemap');
    }
  },
};
