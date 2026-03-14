import { Request, Response } from 'express';
import prisma from '../utils/database';
import { logger } from '../utils/logger';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export const sitemapController = {
  generate: async (req: Request, res: Response) => {
    try {
      const products = await prisma.product.findMany({
        where: { is_active: true, stock_quantity: { gt: 0 } },
        select: { id: true, updated_at: true },
        orderBy: { updated_at: 'desc' },
      });

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      // Home page
      xml += '  <url>\n';
      xml += `    <loc>${FRONTEND_URL}/</loc>\n`;
      xml += '    <changefreq>daily</changefreq>\n';
      xml += '    <priority>1.0</priority>\n';
      xml += '  </url>\n';

      // Product pages
      for (const product of products) {
        const lastmod = product.updated_at.toISOString().split('T')[0];
        xml += '  <url>\n';
        xml += `    <loc>${FRONTEND_URL}/product/${product.id}</loc>\n`;
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
