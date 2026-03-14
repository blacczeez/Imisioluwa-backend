import { Request, Response } from 'express';
import prisma from '../utils/database';
import { paginate } from '../utils/helpers';
import { logger } from '../utils/logger';
import { orderEmitter, ORDER_EVENTS } from '../events/orderEvents';

export const adminController = {
  // Get dashboard statistics
  getDashboardStats: async (req: Request, res: Response) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalOrders,
        todayOrders,
        totalRevenue,
        todayRevenue,
        lowStockProducts,
        recentOrders,
      ] = await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { created_at: { gte: today } } }),
        prisma.order.aggregate({
          where: { payment_status: 'PAID' },
          _sum: { total_amount: true },
        }),
        prisma.order.aggregate({
          where: {
            payment_status: 'PAID',
            created_at: { gte: today },
          },
          _sum: { total_amount: true },
        }),
        prisma.product.count({ where: { stock_quantity: { lte: 10 } } }),
        prisma.order.findMany({
          take: 10,
          orderBy: { created_at: 'desc' },
          include: {
            items: {
              include: { product: true },
            },
          },
        }),
      ]);

      res.json({
        totalOrders,
        todayOrders,
        totalRevenue: totalRevenue._sum.total_amount || 0,
        todayRevenue: todayRevenue._sum.total_amount || 0,
        lowStockProducts,
        recentOrders,
      });
    } catch (error) {
      logger.error('Get dashboard stats error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Get all orders (admin)
  getAllOrders: async (req: Request, res: Response) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        payment_status,
        search,
      } = req.query;

      const { skip, take } = paginate(Number(page), Number(limit));

      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (payment_status) {
        where.payment_status = payment_status;
      }

      if (search) {
        where.OR = [
          { order_number: { contains: search as string, mode: 'insensitive' } },
          { customer_name: { contains: search as string, mode: 'insensitive' } },
          { customer_email: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            items: {
              include: { product: true },
            },
          },
          skip,
          take,
          orderBy: { created_at: 'desc' },
        }),
        prisma.order.count({ where }),
      ]);

      res.json({ orders, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      logger.error('Get all orders error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Update order status
  updateOrderStatus: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const allowedStatuses = ['CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
      }

      const order = await prisma.order.update({
        where: { id },
        data: { status },
        include: {
          items: { include: { product: true } },
        },
      });

      const payload = {
        orderId: order.id,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        phone: order.phone,
        deliveryAddress: order.delivery_address,
        totalAmount: order.total_amount,
        paymentMethod: order.payment_method || 'online',
        items: order.items.map((item: any) => ({
          productId: item.product_id,
          productName: item.product?.name_en || '',
          quantity: item.quantity,
          unitPrice: item.unit_price,
          subtotal: item.subtotal,
        })),
      };

      if (status === 'OUT_FOR_DELIVERY') {
        orderEmitter.emit(ORDER_EVENTS.OUT_FOR_DELIVERY, payload);
      } else if (status === 'DELIVERED') {
        orderEmitter.emit(ORDER_EVENTS.DELIVERED, payload);
      } else if (status === 'CANCELLED') {
        orderEmitter.emit(ORDER_EVENTS.CANCELLED, payload);
      }

      logger.info(`Order status updated: ${order.order_number} -> ${status}`);
      res.json(order);
    } catch (error) {
      logger.error('Update order status error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Get inventory status
  getInventoryStatus: async (req: Request, res: Response) => {
    try {
      const lowStockProducts = await prisma.product.findMany({
        where: { stock_quantity: { lte: 10 } },
        include: { category: true },
        orderBy: { stock_quantity: 'asc' },
      });

      const outOfStockProducts = await prisma.product.findMany({
        where: { stock_quantity: 0 },
        include: { category: true },
      });

      res.json({
        lowStockProducts,
        outOfStockProducts,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
      });
    } catch (error) {
      logger.error('Get inventory status error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Get analytics
  getAnalytics: async (req: Request, res: Response) => {
    try {
      const { period = '7d' } = req.query;
      
      let startDate = new Date();
      if (period === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else if (period === '90d') {
        startDate.setDate(startDate.getDate() - 90);
      }

      const [
        salesData,
        topProducts,
        ordersByStatus,
      ] = await Promise.all([
        prisma.order.groupBy({
          by: ['created_at'],
          where: {
            created_at: { gte: startDate },
            payment_status: 'PAID',
          },
          _sum: { total_amount: true },
          _count: true,
        }),
        prisma.orderItem.groupBy({
          by: ['product_id'],
          _sum: { quantity: true, subtotal: true },
          _count: true,
          orderBy: {
            _sum: { subtotal: 'desc' },
          },
          take: 10,
        }),
        prisma.order.groupBy({
          by: ['status'],
          _count: true,
        }),
      ]);

      res.json({
        salesData,
        topProducts,
        ordersByStatus,
      });
    } catch (error) {
      logger.error('Get analytics error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Get all customers
  getAllCustomers: async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const { skip, take } = paginate(Number(page), Number(limit));

      const [customers, total] = await Promise.all([
        prisma.order.groupBy({
          by: ['customer_email', 'customer_name', 'phone'],
          _count: { id: true },
          _sum: { total_amount: true },
          orderBy: { customer_email: 'asc' },
          skip,
          take,
        }),
        prisma.order.groupBy({
          by: ['customer_email'],
        }).then((result) => result.length),
      ]);

      res.json({ customers, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      logger.error('Get all customers error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },
};
