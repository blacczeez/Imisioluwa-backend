import { Request, Response } from 'express';
import prisma from '../utils/database';
import { logger } from '../utils/logger';
import { getNigeriaLgaDefaultShippingPrice } from '../utils/nigeriaShipping';

function isNigeriaOnlyZoneCountries(countries: string[]): boolean {
  if (!Array.isArray(countries) || countries.length !== 1) return false;
  return countries[0].toUpperCase() === 'NG';
}

export const shippingController = {
  // Public — get shipping rate for a country
  getRateByCountry: async (req: Request, res: Response) => {
    try {
      const { country, state, lga } = req.query;

      if (!country) {
        return res.status(400).json({ error: 'Country code is required' });
      }

      const countryCode = (country as string).toUpperCase();

      // Nigeria-specific shipping: must resolve by state + LGA (if provided)
      if (countryCode === 'NG') {
        if (!state || !lga) {
          return res.json({
            available: false,
            message: 'Select your state and local government to get shipping cost.',
          });
        }

        const nigeriaRate = await prisma.nigeriaLgaShippingRate.findFirst({
          where: {
            state: state as string,
            lga: lga as string,
            is_active: true,
          },
        });

        if (nigeriaRate) {
          return res.json({
            available: true,
            zone: `${nigeriaRate.state} - ${nigeriaRate.lga}`,
            currency: 'NGN',
            flatRate: nigeriaRate.price,
            freeShippingAbove: null,
            usingDefault: false,
          });
        }

        const defaultPrice = await getNigeriaLgaDefaultShippingPrice();
        if (defaultPrice !== null) {
          return res.json({
            available: true,
            zone: `${state} - ${lga} (default)`,
            currency: 'NGN',
            flatRate: defaultPrice,
            freeShippingAbove: null,
            usingDefault: true,
          });
        }

        return res.json({
          available: false,
          message: 'Shipping is not set for this LGA and no default Nigeria shipping price is configured.',
        });
      }

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

      if (isNigeriaOnlyZoneCountries(countries)) {
        return res.status(400).json({
          error:
            'Do not add Nigeria (NG) as a shipping zone. Configure Nigeria under Shipping → Nigeria (state + LGA) and default.',
        });
      }

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

      if (data.countries !== undefined && isNigeriaOnlyZoneCountries(data.countries)) {
        return res.status(400).json({
          error:
            'Do not use Nigeria (NG) as a shipping zone. Configure Nigeria under Shipping → Nigeria (state + LGA) and default.',
        });
      }

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

  // Admin — get all Nigeria state/LGA rates
  getNigeriaRates: async (_req: Request, res: Response) => {
    try {
      const rates = await prisma.nigeriaLgaShippingRate.findMany({
        orderBy: [{ state: 'asc' }, { lga: 'asc' }],
      });
      res.json(rates);
    } catch (error) {
      logger.error('Get Nigeria shipping rates error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Admin — create or update Nigeria state/LGA rate
  upsertNigeriaRate: async (req: Request, res: Response) => {
    try {
      const { state, lga, price, is_active } = req.body;
      if (!state || !lga || price === undefined || price === null) {
        return res.status(400).json({ error: 'State, LGA and price are required' });
      }

      const rate = await prisma.nigeriaLgaShippingRate.upsert({
        where: {
          state_lga: {
            state,
            lga,
          },
        },
        create: {
          state,
          lga,
          price: Number(price),
          is_active: is_active !== false,
        },
        update: {
          price: Number(price),
          is_active: typeof is_active === 'boolean' ? is_active : true,
        },
      });

      res.json(rate);
    } catch (error) {
      logger.error('Upsert Nigeria shipping rate error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Admin — delete Nigeria state/LGA rate
  deleteNigeriaRate: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await prisma.nigeriaLgaShippingRate.delete({ where: { id } });
      res.json({ message: 'Nigeria shipping rate deleted' });
    } catch (error) {
      logger.error('Delete Nigeria shipping rate error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },
};
