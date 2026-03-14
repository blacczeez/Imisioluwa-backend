import { Response } from 'express';
import { orderEmitter, ORDER_EVENTS, OrderEventPayload } from '../orderEvents';
import { logger } from '../../utils/logger';

const sseClients: Set<Response> = new Set();

export function addSSEClient(res: Response) {
  sseClients.add(res);
  res.on('close', () => {
    sseClients.delete(res);
  });
}

function broadcast(event: string, data: any) {
  for (const client of sseClients) {
    client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

export function registerSSEListeners() {
  orderEmitter.on(ORDER_EVENTS.CREATED, (payload: OrderEventPayload) => {
    broadcast('new_order', {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      customerName: payload.customerName,
      totalAmount: payload.totalAmount,
      paymentMethod: payload.paymentMethod,
    });
  });

  orderEmitter.on(ORDER_EVENTS.PAYMENT_CONFIRMED, (payload: OrderEventPayload) => {
    broadcast('payment_confirmed', {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
    });
  });

  orderEmitter.on(ORDER_EVENTS.CANCELLED, (payload: OrderEventPayload) => {
    broadcast('order_cancelled', {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
    });
  });
}
