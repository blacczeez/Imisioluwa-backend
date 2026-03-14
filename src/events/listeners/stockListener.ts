import { orderEmitter, ORDER_EVENTS, OrderEventPayload } from '../orderEvents';
import prisma from '../../utils/database';
import { logger } from '../../utils/logger';

export function registerStockListeners() {
  orderEmitter.on(ORDER_EVENTS.CANCELLED, async (payload: OrderEventPayload) => {
    try {
      for (const item of payload.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock_quantity: { increment: item.quantity } },
        });

        await prisma.inventoryLog.create({
          data: {
            product_id: item.productId,
            change_type: 'ADJUSTMENT',
            quantity_change: item.quantity,
            notes: `Stock restored - Order ${payload.orderNumber} cancelled`,
          },
        });
      }
      logger.info(`Stock restored for cancelled order ${payload.orderNumber}`);
    } catch (error) {
      logger.error('Stock listener error (cancelled):', error);
    }
  });
}
