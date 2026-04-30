-- Add Nigeria-specific shipping fields to orders
ALTER TABLE "orders"
ADD COLUMN "shipping_state" TEXT,
ADD COLUMN "shipping_lga" TEXT;

-- Add dedicated pricing table for Nigeria state/LGA shipping
CREATE TABLE "nigeria_lga_shipping_rates" (
  "id" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "lga" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "nigeria_lga_shipping_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nigeria_lga_shipping_rates_state_lga_key"
ON "nigeria_lga_shipping_rates"("state", "lga");
