import prisma from './database';

const NIGERIA_LGA_DEFAULT_SETTING = 'shipping_nigeria_lga_default';

/** NGN amount used when no row exists for the selected state + LGA. */
export async function getNigeriaLgaDefaultShippingPrice(): Promise<number | null> {
  const row = await prisma.setting.findUnique({
    where: { key: NIGERIA_LGA_DEFAULT_SETTING },
  });
  if (!row?.value?.trim()) return null;
  const n = Number(row.value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
