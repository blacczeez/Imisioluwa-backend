-- AlterTable: Add multi-currency price fields to products
ALTER TABLE "products" ADD COLUMN     "price_eur" DOUBLE PRECISION,
ADD COLUMN     "price_gbp" DOUBLE PRECISION,
ADD COLUMN     "price_usd" DOUBLE PRECISION,
ADD COLUMN     "weight_kg" DOUBLE PRECISION;

-- AlterTable: Add currency/shipping fields to orders
ALTER TABLE "orders" ADD COLUMN     "country" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "payment_gateway" TEXT,
ADD COLUMN     "shipping_cost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable: Shipping zones
CREATE TABLE "shipping_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countries" TEXT[],
    "currency" TEXT NOT NULL,
    "flat_rate" DOUBLE PRECISION NOT NULL,
    "free_shipping_above" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id")
);

-- Seed default shipping zones
INSERT INTO shipping_zones (id, name, countries, currency, flat_rate, free_shipping_above, is_active, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Local (Nigeria)', '{NG}', 'NGN', 2000, 50000, true, NOW(), NOW()),
  (gen_random_uuid(), 'United Kingdom', '{GB}', 'GBP', 15, 100, true, NOW(), NOW()),
  (gen_random_uuid(), 'US & Canada', '{US,CA}', 'USD', 25, 150, true, NOW(), NOW()),
  (gen_random_uuid(), 'Europe', '{FR,DE,IT,ES,NL,BE,AT,PT,IE,SE,DK,FI,NO,CH,PL,CZ}', 'EUR', 20, 120, true, NOW(), NOW()),
  (gen_random_uuid(), 'Rest of World', '{*}', 'USD', 30, NULL, true, NOW(), NOW());

-- Add Stripe setting
INSERT INTO settings (key, value, updated_at) VALUES
  ('stripe_enabled', 'false', NOW())
ON CONFLICT (key) DO NOTHING;
