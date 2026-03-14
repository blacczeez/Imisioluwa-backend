import axios from 'axios';
import { orderEmitter, ORDER_EVENTS, OrderEventPayload } from '../orderEvents';
import prisma from '../../utils/database';
import { logger } from '../../utils/logger';

async function getWhatsAppNumber(): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key: 'whatsapp_number' } });
  return setting?.value || null;
}

async function sendWhatsAppMessage(phone: string, message: string) {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;

  if (!apiUrl || !apiToken) {
    logger.warn('WhatsApp API not configured, skipping notification');
    return;
  }

  try {
    await axios.post(
      apiUrl,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message },
      },
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      }
    );
  } catch (error) {
    logger.error('WhatsApp send error:', error);
  }
}

export function registerWhatsAppListeners() {
  orderEmitter.on(ORDER_EVENTS.CREATED, async (payload: OrderEventPayload) => {
    const phone = await getWhatsAppNumber();
    if (!phone) return;

    const paymentLabel = payload.paymentMethod === 'cod' ? 'Pay on Delivery' : 'Online Payment';
    const message =
      `New Order! #${payload.orderNumber}\n` +
      `Customer: ${payload.customerName}\n` +
      `Amount: ₦${payload.totalAmount.toLocaleString()}\n` +
      `Payment: ${paymentLabel}\n` +
      `Phone: ${payload.phone}\n` +
      `Address: ${payload.deliveryAddress}`;

    await sendWhatsAppMessage(phone, message);
  });

  orderEmitter.on(ORDER_EVENTS.PAYMENT_CONFIRMED, async (payload: OrderEventPayload) => {
    const phone = await getWhatsAppNumber();
    if (!phone) return;

    const message =
      `Payment Received! #${payload.orderNumber}\n` +
      `Amount: ₦${payload.totalAmount.toLocaleString()}\n` +
      `Customer: ${payload.customerName}`;

    await sendWhatsAppMessage(phone, message);
  });
}
