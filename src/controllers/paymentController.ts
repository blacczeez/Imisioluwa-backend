import { Request, Response } from 'express';
import prisma from '../utils/database';
import { paymentService } from '../services/paymentService';
import { stripeService } from '../services/stripeService';
import { logger } from '../utils/logger';
import { orderEmitter, ORDER_EVENTS } from '../events/orderEvents';

function buildPaymentPayload(order: any) {
  return {
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
}

export const paymentController = {
  // Initialize payment — routes to Paystack or Stripe based on currency
  initialize: async (req: Request, res: Response) => {
    try {
      const { orderId, email, amount } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (order.status !== 'PENDING_PAYMENT') {
        return res.status(400).json({ error: 'Order is not awaiting payment' });
      }

      const currency = order.currency || 'NGN';

      if (currency === 'NGN') {
        // Paystack for Naira
        const paymentData = await paymentService.initializePayment(email, amount, orderId);
        await prisma.order.update({
          where: { id: orderId },
          data: { payment_gateway: 'paystack' },
        });
        logger.info(`Paystack payment initialized for order: ${order.order_number}`);
        res.json({ gateway: 'paystack', ...paymentData });
      } else {
        // Stripe for international
        const lineItems = order.items.map((item: any) => ({
          name: item.product?.name_en || 'Product',
          quantity: item.quantity,
          unitPrice: item.unit_price,
        }));

        // Add shipping as a line item if present
        if (order.shipping_cost > 0) {
          lineItems.push({
            name: 'Shipping',
            quantity: 1,
            unitPrice: order.shipping_cost,
          });
        }

        const sessionData = await stripeService.createCheckoutSession(
          orderId,
          email,
          amount,
          currency,
          lineItems
        );

        await prisma.order.update({
          where: { id: orderId },
          data: { payment_gateway: 'stripe' },
        });

        logger.info(`Stripe session created for order: ${order.order_number}`);
        res.json({ gateway: 'stripe', ...sessionData });
      }
    } catch (error) {
      logger.error('Initialize payment error:', error);
      res.status(500).json({ error: 'Payment initialization failed' });
    }
  },

  // Verify Paystack payment
  verifyPaystack: async (req: Request, res: Response) => {
    try {
      const { reference } = req.body;

      const paymentData = await paymentService.verifyPayment(reference);

      if (paymentData.status === 'success') {
        const orderId = paymentData.metadata.order_id;

        const order = await prisma.order.update({
          where: { id: orderId },
          data: {
            payment_status: 'PAID',
            payment_reference: reference,
            status: 'CONFIRMED',
          },
          include: { items: { include: { product: true } } },
        });

        await prisma.payment.create({
          data: {
            order_id: orderId,
            amount: paymentData.amount / 100,
            payment_reference: reference,
            gateway_response: paymentData,
            status: 'PAID',
          },
        });

        orderEmitter.emit(ORDER_EVENTS.PAYMENT_CONFIRMED, buildPaymentPayload(order));

        logger.info(`Paystack payment verified for order: ${order.order_number}`);
        res.json({ message: 'Payment verified', order });
      } else {
        res.status(400).json({ error: 'Payment verification failed' });
      }
    } catch (error) {
      logger.error('Verify Paystack payment error:', error);
      res.status(500).json({ error: 'Payment verification failed' });
    }
  },

  // Stripe webhook handler
  stripeWebhook: async (req: Request, res: Response) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const event = stripeService.verifyWebhookEvent(req.body, signature);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const orderId = session.metadata.order_id;

        const order = await prisma.order.update({
          where: { id: orderId },
          data: {
            payment_status: 'PAID',
            payment_reference: session.id,
            status: 'CONFIRMED',
          },
          include: { items: { include: { product: true } } },
        });

        await prisma.payment.create({
          data: {
            order_id: orderId,
            amount: session.amount_total / 100,
            payment_reference: session.id,
            gateway_response: session as any,
            status: 'PAID',
          },
        });

        orderEmitter.emit(ORDER_EVENTS.PAYMENT_CONFIRMED, buildPaymentPayload(order));

        logger.info(`Stripe payment confirmed for order: ${order.order_number}`);
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Stripe webhook error:', error);
      res.status(400).json({ error: 'Webhook error' });
    }
  },

  // Verify Stripe session (called from frontend on return)
  verifyStripe: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      const session = await stripeService.retrieveSession(sessionId);

      if (session.payment_status === 'paid') {
        const orderId = session.metadata?.order_id;
        const order = await prisma.order.findUnique({ where: { id: orderId } });

        res.json({ message: 'Payment verified', order });
      } else {
        res.status(400).json({ error: 'Payment not completed' });
      }
    } catch (error) {
      logger.error('Verify Stripe session error:', error);
      res.status(500).json({ error: 'Verification failed' });
    }
  },

  getByOrderId: async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      const payments = await prisma.payment.findMany({
        where: { order_id: orderId },
        orderBy: { created_at: 'desc' },
      });

      res.json(payments);
    } catch (error) {
      logger.error('Get payments error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },
};
