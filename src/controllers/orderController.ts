import { Request, Response } from 'express';
import prisma from '../utils/database';
import { generateOrderNumber } from '../utils/helpers';
import { logger } from '../utils/logger';
import { orderEmitter, ORDER_EVENTS, OrderEventPayload } from '../events/orderEvents';

function buildEventPayload(order: any, paymentMethod: string): OrderEventPayload {
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    phone: order.phone,
    deliveryAddress: order.delivery_address,
    totalAmount: order.total_amount,
    paymentMethod,
    items: order.items.map((item: any) => ({
      productId: item.product_id,
      productName: item.product?.name_en || '',
      quantity: item.quantity,
      unitPrice: item.unit_price,
      subtotal: item.subtotal,
    })),
  };
}

function getProductPrice(product: any, currency: string): number | null {
  switch (currency) {
    case 'USD': return product.price_usd;
    case 'GBP': return product.price_gbp;
    case 'EUR': return product.price_eur;
    default: return product.price;
  }
}

export const orderController = {
  create: async (req: Request, res: Response) => {
    try {
      const {
        customer_name,
        customer_email,
        phone,
        delivery_address,
        notes,
        items,
        payment_method,
        currency,
        country,
      } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Order items are required' });
      }

      if (!payment_method || !['online', 'cod'].includes(payment_method)) {
        return res.status(400).json({ error: 'Valid payment method is required (online or cod)' });
      }

      // Validate currency
      const validCurrencies = ['NGN', 'USD', 'GBP', 'EUR'];
      const orderCurrency = currency && validCurrencies.includes(currency.toUpperCase()) ? currency.toUpperCase() : 'NGN';

      // COD only available for NGN
      if (payment_method === 'cod' && orderCurrency !== 'NGN') {
        return res.status(400).json({ error: 'Pay on delivery is only available for orders in Naira' });
      }

      // Verify payment method is enabled
      const methodKey = payment_method === 'online' ? 'payment_online_enabled' : 'payment_cod_enabled';
      const setting = await prisma.setting.findUnique({ where: { key: methodKey } });
      if (setting && setting.value === 'false') {
        return res.status(400).json({ error: 'This payment method is not currently available' });
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
            error: `Insufficient stock for ${product.name_en}`,
          });
        }

        const price = getProductPrice(product, orderCurrency);
        if (price === null || price === undefined) {
          return res.status(400).json({
            error: `${product.name_en} is not available in ${orderCurrency}`,
          });
        }

        const subtotal = price * item.quantity;
        total_amount += subtotal;

        orderItems.push({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: price,
          subtotal,
        });
      }

      // Calculate shipping cost
      let shipping_cost = 0;
      if (country) {
        const countryCode = country.toUpperCase();
        const zone = await prisma.shippingZone.findFirst({
          where: { is_active: true, countries: { has: countryCode } },
        }) || await prisma.shippingZone.findFirst({
          where: { is_active: true, countries: { has: '*' } },
        });

        if (zone) {
          shipping_cost = zone.flat_rate;
          if (zone.free_shipping_above && total_amount >= zone.free_shipping_above) {
            shipping_cost = 0;
          }
        }
      }

      // Set initial status based on payment method
      const initialStatus = payment_method === 'online' ? 'PENDING_PAYMENT' : 'CONFIRMED';

      // Create order
      const order = await prisma.order.create({
        data: {
          order_number: generateOrderNumber(),
          customer_name,
          customer_email,
          phone,
          delivery_address,
          notes,
          total_amount: total_amount + shipping_cost,
          status: initialStatus,
          payment_method,
          currency: orderCurrency,
          country: country?.toUpperCase() || null,
          shipping_cost,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      // Decrement stock and log inventory
      for (const item of orderItems) {
        await prisma.product.update({
          where: { id: item.product_id },
          data: { stock_quantity: { decrement: item.quantity } },
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

      // Emit event
      const payload = buildEventPayload(order, payment_method);
      orderEmitter.emit(ORDER_EVENTS.CREATED, payload);

      logger.info(`Order created: ${order.order_number} (${payment_method}, ${orderCurrency})`);
      res.status(201).json(order);
    } catch (error) {
      logger.error('Create order error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

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
          items: { include: { product: true } },
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

  getById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          items: { include: { product: true } },
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
