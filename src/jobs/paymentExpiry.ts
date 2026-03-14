import prisma from '../utils/database';
import { orderEmitter, ORDER_EVENTS } from '../events/orderEvents';
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
          items: { include: { product: true } },
        },
      });

      for (const order of expiredOrders) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', payment_status: 'FAILED' },
        });

        orderEmitter.emit(ORDER_EVENTS.CANCELLED, {
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.customer_name,
          customerEmail: order.customer_email,
          phone: order.phone,
          deliveryAddress: order.delivery_address,
          totalAmount: order.total_amount,
          paymentMethod: 'online',
          items: order.items.map((item: any) => ({
            productId: item.product_id,
            productName: item.product?.name_en || '',
            quantity: item.quantity,
            unitPrice: item.unit_price,
            subtotal: item.subtotal,
          })),
        });

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
