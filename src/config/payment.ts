export const paystackConfig = {
  secretKey: process.env.PAYSTACK_SECRET_KEY || '',
  publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
  callbackUrl: `${process.env.FRONTEND_URL}/order-confirmation`,
};
