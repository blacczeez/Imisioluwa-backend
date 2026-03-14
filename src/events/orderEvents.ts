import { EventEmitter } from 'events';

export const orderEmitter = new EventEmitter();

export const ORDER_EVENTS = {
  CREATED: 'order.created',
  PAYMENT_CONFIRMED: 'order.payment_confirmed',
  OUT_FOR_DELIVERY: 'order.out_for_delivery',
  DELIVERED: 'order.delivered',
  CANCELLED: 'order.cancelled',
} as const;

export interface OrderEventPayload {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  phone: string;
  deliveryAddress: string;
  totalAmount: number;
  paymentMethod: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}
