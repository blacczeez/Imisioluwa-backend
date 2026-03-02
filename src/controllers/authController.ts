import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../utils/database';
import { jwtConfig } from '../config/jwt';
import { logger } from '../utils/logger';

export const authController = {
  // Register customer (optional)
  register: async (req: Request, res: Response) => {
    try {
      const { email, password, name, phone } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password_hash,
          name,
          phone,
          role: 'CUSTOMER',
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          created_at: true,
        },
      });

      // Generate token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      logger.info(`User registered: ${email}`);
      res.status(201).json({ user, token });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Login (customer or admin)
  login: async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if admin
      let isAdmin = false;
      if (user.role === 'ADMIN') {
        const adminUser = await prisma.adminUser.findUnique({
          where: { user_id: user.id },
        });
        isAdmin = !!adminUser;
      }

      // Generate token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        jwtConfig.refreshSecret,
        { expiresIn: jwtConfig.refreshExpiresIn }
      );

      logger.info(`User logged in: ${email}`);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
        token,
        refreshToken,
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Admin login (specific endpoint)
  adminLogin: async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
        include: { admin_user: true },
      });

      if (!user || user.role !== 'ADMIN' || !user.admin_user) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      // Generate token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
      );

      logger.info(`Admin logged in: ${email}`);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          adminRole: user.admin_user.role,
        },
        token,
      });
    } catch (error) {
      logger.error('Admin login error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Get current user
  me: async (req: any, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          created_at: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      logger.error('Get user error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },
};
