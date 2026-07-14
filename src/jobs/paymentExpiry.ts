import prisma from '../utils/database';
import { orderEmitter, ORDER_EVENTS } from '../events/orderEvents';
import { buildOrderEventPayload } from '../utils/orderEventPayload';
import { logger } from '../utils/logger';

export function startPaymentExpiryJob() {
  setInterval(async () => {
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: 'payment_expiry_minutes' },
      });
      const expiryMinutes = parseInt(setting?.value || '30', 10);
      const cutoff = new Date(Date.now() - expiryMinutes * 60 * 1000);

      const expiredOrders = await prisma.order.findMany({
        where: {
          status: 'PENDING_PAYMENT',
          created_at: { lt: cutoff },
        },
        include: {
          items: { include: { product: true, variant: true } },
          package_items: true,
        },
      });

      for (const order of expiredOrders) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', payment_status: 'FAILED' },
        });

        orderEmitter.emit(ORDER_EVENTS.CANCELLED, buildOrderEventPayload(order, 'online'));

        logger.info(`Expired order cancelled: ${order.order_number}`);
      }

      if (expiredOrders.length > 0) {
        logger.info(`Payment expiry job: cancelled ${expiredOrders.length} expired orders`);
      }
    } catch (error) {
      logger.error('Payment expiry job error:', error);
    }
  }, 5 * 60 * 1000);

  logger.info('Payment expiry job started (checks every 5 minutes)');
}
