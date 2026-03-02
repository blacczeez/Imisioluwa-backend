import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const emailService = {
  sendOrderConfirmation: async (
    email: string,
    orderNumber: string,
    customerName: string,
    totalAmount: number
  ) => {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: email,
        subject: `Order Confirmation - ${orderNumber}`,
        html: `
          <h1>Thank You for Your Order!</h1>
          <p>Hi ${customerName},</p>
          <p>Your order has been received and is being processed.</p>
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <p><strong>Total Amount:</strong> ₦${totalAmount.toLocaleString()}</p>
          <p>You can track your order using your order number and phone number.</p>
          <br>
          <p>Thank you for shopping with us!</p>
        `,
      });
      logger.info(`Order confirmation email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending order confirmation email:', error);
    }
  },

  sendOrderStatusUpdate: async (
    email: string,
    orderNumber: string,
    customerName: string,
    status: string
  ) => {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: email,
        subject: `Order Update - ${orderNumber}`,
        html: `
          <h1>Order Status Update</h1>
          <p>Hi ${customerName},</p>
          <p>Your order status has been updated.</p>
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <p><strong>New Status:</strong> ${status}</p>
          <br>
          <p>Thank you!</p>
        `,
      });
      logger.info(`Order status update email sent to ${email}`);
    } catch (error) {
      logger.error('Error sending order status update email:', error);
    }
  },

  sendAdminNewOrderAlert: async (orderNumber: string, totalAmount: number) => {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: adminEmail,
        subject: `New Order Received - ${orderNumber}`,
        html: `
          <h1>New Order Alert</h1>
          <p>A new order has been placed.</p>
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <p><strong>Total Amount:</strong> ₦${totalAmount.toLocaleString()}</p>
          <p>Please check the admin dashboard for details.</p>
        `,
      });
      logger.info(`New order alert sent to admin`);
    } catch (error) {
      logger.error('Error sending admin new order alert:', error);
    }
  },
};
