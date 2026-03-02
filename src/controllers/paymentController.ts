import { Request, Response } from 'express';
import prisma from '../utils/database';
import { paymentService } from '../services/paymentService';
import { logger } from '../utils/logger';
import { emailService } from '../services/emailService';

export const paymentController = {
  // Initialize payment
  initialize: async (req: Request, res: Response) => {
    try {
      const { orderId, email, amount } = req.body;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const paymentData = await paymentService.initializePayment(
        email,
        amount,
        orderId
      );

      logger.info(`Payment initialized for order: ${order.order_number}`);
      res.json(paymentData);
    } catch (error) {
      logger.error('Initialize payment error:', error);
      res.status(500).json({ error: 'Payment initialization failed' });
    }
  },

  // Verify payment (webhook)
  verify: async (req: Request, res: Response) => {
    try {
      const { reference } = req.body;

      const paymentData = await paymentService.verifyPayment(reference);

      if (paymentData.status === 'success') {
        const orderId = paymentData.metadata.order_id;

        // Update order payment status
        const order = await prisma.order.update({
          where: { id: orderId },
          data: {
            payment_status: 'PAID',
            payment_reference: reference,
            status: 'CONFIRMED',
          },
        });

        // Create payment record
        await prisma.payment.create({
          data: {
            order_id: orderId,
            amount: paymentData.amount / 100, // Convert from kobo
            payment_reference: reference,
            gateway_response: paymentData,
            status: 'PAID',
          },
        });

        // Send confirmation email
        emailService.sendOrderStatusUpdate(
          order.customer_email,
          order.order_number,
          order.customer_name,
          'Confirmed - Payment Received'
        );

        logger.info(`Payment verified for order: ${order.order_number}`);
        res.json({ message: 'Payment verified', order });
      } else {
        res.status(400).json({ error: 'Payment verification failed' });
      }
    } catch (error) {
      logger.error('Verify payment error:', error);
      res.status(500).json({ error: 'Payment verification failed' });
    }
  },

  // Get payment status by order ID
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
