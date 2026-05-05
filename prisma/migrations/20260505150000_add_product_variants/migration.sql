-- Create product variants table
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "weight_ml" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "price_usd" DOUBLE PRECISION,
    "price_gbp" DOUBLE PRECISION,
    "price_eur" DOUBLE PRECISION,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- Add optional variant link to order items
ALTER TABLE "order_items" ADD COLUMN "variant_id" TEXT;

-- Indexes and constraints
CREATE UNIQUE INDEX "product_variants_product_id_weight_ml_key"
ON "product_variants"("product_id", "weight_ml");

ALTER TABLE "product_variants"
ADD CONSTRAINT "product_variants_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_variant_id_fkey"
FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill one default variant per existing product (idempotent)
INSERT INTO "product_variants" (
  "id",
  "product_id",
  "weight_ml",
  "price",
  "price_usd",
  "price_gbp",
  "price_eur",
  "stock_quantity",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  p."id",
  GREATEST(1, CAST(ROUND(COALESCE(p."weight_kg", 1) * 1000) AS INTEGER)),
  p."price",
  p."price_usd",
  p."price_gbp",
  p."price_eur",
  p."stock_quantity",
  p."is_active",
  NOW(),
  NOW()
FROM "products" p
WHERE NOT EXISTS (
  SELECT 1
  FROM "product_variants" v
  WHERE v."product_id" = p."id"
);
