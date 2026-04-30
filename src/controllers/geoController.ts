import { Request, Response } from 'express';
import { logger } from '../utils/logger';

const GEO_HEADERS = {
  'User-Agent': 'ImisioluwaShop/1.0 (Geolocation)',
  Accept: 'application/json',
} as const;

function normalizeIp(rawIp: string): string {
  if (!rawIp) return '';
  // Express/Node can expose IPv4 addresses as "::ffff:127.0.0.1"
  if (rawIp.startsWith('::ffff:')) {
    return rawIp.replace('::ffff:', '');
  }
  // Keep plain IPv6 as-is (ipapi can parse real public IPv6)
  return rawIp;
}

function isLocalOrPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
  return false;
}

/**
 * GET /api/geo — returns country code for the request's IP.
 * Tries ipapi.co (free, no key); falls back to returning null so frontend keeps default.
 */
export const geoController = {
  getCountry: async (req: Request, res: Response) => {
    try {
      const forwarded = req.headers['x-forwarded-for'];
      const rawClientIp =
        typeof forwarded === 'string'
          ? forwarded.split(',')[0].trim()
          : req.socket.remoteAddress || '';
      const clientIp = normalizeIp(rawClientIp);

      // ipapi.co: GET https://ipapi.co/{ip}/json/ returns { country_code: "US" }; no IP = current request IP
      // For local/private IPs in dev, do not send IP path (providers usually return "reserved IP" result).
      const path = clientIp && !isLocalOrPrivateIp(clientIp) ? `/${clientIp}/json/` : '/json/';
      const url = `https://ipapi.co${path}`;

      const response = await fetch(url, { headers: GEO_HEADERS });
      if (!response.ok) {
        logger.error(`Geo lookup failed: ${response.status} ${response.statusText} (${url})`);
        return res.json({ countryCode: null });
      }

      const data = (await response.json()) as {
        country_code?: string;
        ip?: string;
        reason?: string;
        error?: boolean;
      };
      const countryCode = data?.country_code ?? null;
      if (!countryCode) {
        logger.info(
          `Geo lookup returned no country_code (requestedIp=${clientIp || 'none'}, providerIp=${data?.ip || 'unknown'}, reason=${data?.reason || 'none'})`
        );
        return res.json({ countryCode: null });
      }

      res.json({ countryCode });
    } catch (error) {
      logger.error('Geo controller error:', error);
      res.json({ countryCode: null });
    }
  },
};
