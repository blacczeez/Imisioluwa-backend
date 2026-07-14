import { OrderEventPayload } from '../events/orderEvents';

export function buildOrderEventPayload(order: any, paymentMethod?: string): OrderEventPayload {
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    phone: order.phone,
    deliveryAddress: order.delivery_address,
    totalAmount: order.total_amount,
    paymentMethod: paymentMethod || order.payment_method || 'online',
    items: order.items.map((item: any) => ({
      productId: item.product_id,
      variantId: item.variant_id,
      productName: item.product?.name_en || '',
      variantWeightMl: item.variant?.weight_ml || null,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      subtotal: item.subtotal,
    })),
    packageItems: (order.package_items || []).map((item: any) => ({
      packageId: item.package_id || undefined,
      packageName: item.package_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      subtotal: item.subtotal,
      contents: item.contents_snapshot || [],
    })),
  };
}
