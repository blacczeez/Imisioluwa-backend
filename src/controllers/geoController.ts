import { Request, Response } from 'express';
import { logger } from '../utils/logger';

const GEO_HEADERS = {
  'User-Agent': 'ImisioluwaShop/1.0 (Geolocation)',
  Accept: 'application/json',
} as const;

/**
 * GET /api/geo — returns country code for the request's IP.
 * Tries ipapi.co (free, no key); falls back to returning null so frontend keeps default.
 */
export const geoController = {
  getCountry: async (req: Request, res: Response) => {
    try {
      const forwarded = req.headers['x-forwarded-for'];
      const clientIp =
        typeof forwarded === 'string'
          ? forwarded.split(',')[0].trim()
          : req.socket.remoteAddress || '';

      // ipapi.co: GET https://ipapi.co/{ip}/json/ returns { country_code: "US" }; no IP = current request IP
      const path = clientIp ? `/${clientIp}/json/` : '/json/';
      const url = `https://ipapi.co${path}`;

      const response = await fetch(url, { headers: GEO_HEADERS });
      if (!response.ok) {
        logger.warn(`Geo lookup failed: ${response.status} ${response.statusText}`);
        return res.json({ countryCode: null });
      }

      const data = (await response.json()) as { country_code?: string };
      const countryCode = data?.country_code ?? null;
      if (!countryCode) {
        return res.json({ countryCode: null });
      }

      res.json({ countryCode });
    } catch (error) {
      logger.error('Geo controller error:', error);
      res.json({ countryCode: null });
    }
  },
};
