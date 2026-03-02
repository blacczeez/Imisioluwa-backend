import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../utils/database';

export const adminAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Verify admin user exists
    const adminUser = await prisma.adminUser.findUnique({
      where: { user_id: req.user.id },
    });

    if (!adminUser) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
