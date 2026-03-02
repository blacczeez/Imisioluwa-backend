import { Request, Response } from 'express';
import prisma from '../utils/database';
import { generateOrderNumber } from '../utils/helpers';
import { logger } from '../utils/logger';
import { emailService } from '../services/emailService';

export const orderController = {
  // Create order (no auth required - guest checkout)
  create: async (req: Request, res: Response) => {
    try {
      const {
        customer_name,
        customer_email,
        phone,
        delivery_address,
        notes,
        items,
      } = req.body;

      // Validate items
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Order items are required' });
      }

      // Calculate total and verify stock
      let total_amount = 0;
      const orderItems = [];

      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.product_id },
        });

        if (!product) {
          return res.status(404).json({ error: `Product ${item.product_id} not found` });
        }

        if (product.stock_quantity < item.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for product ${product.name_en}`,
          });
        }

        const subtotal = product.price * item.quantity;
        total_amount += subtotal;

        orderItems.push({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: product.price,
          subtotal,
        });
      }

      // Create order
      const order = await prisma.order.create({
        data: {
          order_number: generateOrderNumber(),
          customer_name,
          customer_email,
          phone,
          delivery_address,
          notes,
          total_amount,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Update product stock and create inventory logs
      for (const item of orderItems) {
        await prisma.product.update({
          where: { id: item.product_id },
          data: {
            stock_quantity: {
              decrement: item.quantity,
            },
          },
        });

        await prisma.inventoryLog.create({
          data: {
            product_id: item.product_id,
            change_type: 'SALE',
            quantity_change: -item.quantity,
            notes: `Order ${order.order_number}`,
          },
        });
      }

      // Send confirmation email
      emailService.sendOrderConfirmation(
        customer_email,
        order.order_number,
        customer_name,
        total_amount
      );

      // Send admin alert
      emailService.sendAdminNewOrderAlert(order.order_number, total_amount);

      logger.info(`Order created: ${order.order_number}`);
      res.status(201).json(order);
    } catch (error) {
      logger.error('Create order error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Track order (no auth required)
  track: async (req: Request, res: Response) => {
    try {
      const { orderNumber, phone } = req.query;

      if (!orderNumber || !phone) {
        return res.status(400).json({ error: 'Order number and phone are required' });
      }

      const order = await prisma.order.findFirst({
        where: {
          order_number: orderNumber as string,
          phone: phone as string,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          deliveries: true,
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json(order);
    } catch (error) {
      logger.error('Track order error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  // Get order by ID (no auth required if order number and phone match)
  getById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          deliveries: true,
        },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json(order);
    } catch (error) {
      logger.error('Get order error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },
};
