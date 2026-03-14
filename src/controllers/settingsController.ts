import { Request, Response } from 'express';
import prisma from '../utils/database';
import { logger } from '../utils/logger';

export const settingsController = {
  getAll: async (req: Request, res: Response) => {
    try {
      const settings = await prisma.setting.findMany();
      const result: Record<string, string> = {};
      for (const s of settings) {
        result[s.key] = s.value;
      }
      res.json(result);
    } catch (error) {
      logger.error('Get settings error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { settings } = req.body as { settings: Record<string, string> };

      const onlineEnabled = settings.payment_online_enabled ?? 'true';
      const codEnabled = settings.payment_cod_enabled ?? 'true';
      if (onlineEnabled === 'false' && codEnabled === 'false') {
        return res.status(400).json({ error: 'At least one payment method must be enabled' });
      }

      for (const [key, value] of Object.entries(settings)) {
        await prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }

      res.json({ message: 'Settings updated' });
    } catch (error) {
      logger.error('Update settings error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  getPaymentMethods: async (req: Request, res: Response) => {
    try {
      const settings = await prisma.setting.findMany({
        where: {
          key: { in: ['payment_online_enabled', 'payment_cod_enabled'] },
        },
      });

      const result: Record<string, boolean> = {
        online: true,
        cod: true,
      };

      for (const s of settings) {
        if (s.key === 'payment_online_enabled') result.online = s.value === 'true';
        if (s.key === 'payment_cod_enabled') result.cod = s.value === 'true';
      }

      res.json(result);
    } catch (error) {
      logger.error('Get payment methods error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },
};
