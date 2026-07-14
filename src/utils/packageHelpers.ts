import { Prisma } from '@prisma/client';

export type PackageWithItems = Prisma.PackageGetPayload<{
  include: {
    items: {
      include: {
        variant: {
          include: { product: true };
        };
      };
    };
  };
}>;

export interface PackageContentsSnapshotEntry {
  variant_id: string;
  product_id: string;
  quantity: number;
}

export function isPackageItemAvailable(item: PackageWithItems['items'][number]): boolean {
  const variant = item.variant;
  return Boolean(
    variant &&
      variant.is_active &&
      variant.product?.is_active &&
      variant.stock_quantity >= item.quantity
  );
}

export function isPackageInStock(pkg: PackageWithItems): boolean {
  if (pkg.items.length === 0) {
    return false;
  }

  return pkg.items.every(isPackageItemAvailable);
}

export function getMaxPackageQuantity(pkg: PackageWithItems): number {
  if (pkg.items.length === 0) {
    return 0;
  }

  let max = Number.MAX_SAFE_INTEGER;
  for (const item of pkg.items) {
    if (!item.variant?.is_active || !item.variant.product?.is_active || item.quantity <= 0) {
      return 0;
    }
    max = Math.min(max, Math.floor(item.variant.stock_quantity / item.quantity));
  }

  return Math.max(0, max === Number.MAX_SAFE_INTEGER ? 0 : max);
}

export function getPackageStockBlockers(pkg: PackageWithItems): string[] {
  return pkg.items
    .filter((item) => !isPackageItemAvailable(item))
    .map((item) => {
      const name = item.variant?.product?.name_en || 'Unknown product';
      const weight = item.variant?.weight_ml ? `${item.variant.weight_ml}ml` : '';
      const stock = item.variant?.stock_quantity ?? 0;
      return `${name}${weight ? ` (${weight})` : ''}: needs ${item.quantity}, has ${stock}`;
    });
}

export function buildContentsSnapshot(pkg: PackageWithItems): PackageContentsSnapshotEntry[] {
  return pkg.items.map((item) => ({
    variant_id: item.variant_id,
    product_id: item.variant.product_id,
    quantity: item.quantity,
  }));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
