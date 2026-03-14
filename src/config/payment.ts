export const paystackConfig = {
  secretKey: process.env.PAYSTACK_SECRET_KEY || '',
  publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
  callbackUrl: `${process.env.FRONTEND_URL}/order-confirmation`,
};

export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  callbackUrl: `${process.env.FRONTEND_URL}/order-confirmation`,
};
