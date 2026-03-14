import Stripe from 'stripe';
import { stripeConfig } from '../config/payment';
import { logger } from '../utils/logger';

const stripe = new Stripe(stripeConfig.secretKey);

export const stripeService = {
  createCheckoutSession: async (
    orderId: string,
    email: string,
    amount: number,
    currency: string,
    lineItems: Array<{ name: string; quantity: number; unitPrice: number }>
  ) => {
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: email,
        line_items: lineItems.map((item) => ({
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: item.name },
            unit_amount: Math.round(item.unitPrice * 100),
          },
          quantity: item.quantity,
        })),
        metadata: { order_id: orderId },
        success_url: `${stripeConfig.callbackUrl}?order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${stripeConfig.callbackUrl}?order=${orderId}&cancelled=true`,
      });

      return {
        sessionId: session.id,
        url: session.url,
      };
    } catch (error) {
      logger.error('Stripe checkout session error:', error);
      throw new Error('Failed to create Stripe checkout session');
    }
  },

  verifyWebhookEvent: (payload: Buffer, signature: string): Stripe.Event => {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      stripeConfig.webhookSecret
    );
  },

  retrieveSession: async (sessionId: string) => {
    return stripe.checkout.sessions.retrieve(sessionId);
  },
};
