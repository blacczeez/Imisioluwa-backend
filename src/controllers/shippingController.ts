import { Request, Response } from 'express';
import prisma from '../utils/database';
import { logger } from '../utils/logger';

export const shippingController = {
  // Public — get shipping rate for a country
  getRateByCountry: async (req: Request, res: Response) => {
    try {
      const { country } = req.query;

      if (!country) {
        return res.status(400).json({ error: 'Country code is required' });
      }

      const countryCode = (country as string).toUpperCase();

      // Find zone that includes this country
      let zone = await prisma.shippingZone.findFirst({
        where: {
          is_active: true,
          countries: { has: countryCode },
        },
      });

      // Fallback to "Rest of World" zone (uses * wildcard)
      if (!zone) {
        zone = await prisma.shippingZone.findFirst({
          where: {
            is_active: true,
            countries: { has: '*' },
          },
        });
      }

      if (!zone) {
        return res.json({
          available: false,
          message: 'We do not ship to your country yet. Please contact us.',
        });
      }

      res.json({
        available: true,
        zone: zone.name,
        currency: zone.currency,
        flatRate: zone.flat_rate,
        freeShippingAbove: zone.free_shipping_above,
      });
    } catch (error) {
      logger.error('Get shipping rate error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Admin — get all zones
  getAll: async (_req: Request, res: Response) => {
    try {
      const zones = await prisma.shippingZone.findMany({
        orderBy: { created_at: 'asc' },
      });
      res.json(zones);
    } catch (error) {
      logger.error('Get shipping zones error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Admin — create zone
  create: async (req: Request, res: Response) => {
    try {
      const { name, countries, currency, flat_rate, free_shipping_above } = req.body;

      const zone = await prisma.shippingZone.create({
        data: {
          name,
          countries,
          currency: currency.toUpperCase(),
          flat_rate,
          free_shipping_above: free_shipping_above || null,
        },
      });

      res.status(201).json(zone);
    } catch (error) {
      logger.error('Create shipping zone error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Admin — update zone
  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body;

      const zone = await prisma.shippingZone.update({
        where: { id },
        data,
      });

      res.json(zone);
    } catch (error) {
      logger.error('Update shipping zone error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Admin — delete zone
  delete: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await prisma.shippingZone.delete({ where: { id } });

      res.json({ message: 'Shipping zone deleted' });
    } catch (error) {
      logger.error('Delete shipping zone error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },
};
