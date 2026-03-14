-- Migrate existing order data to new status values BEFORE changing the enum
UPDATE "orders" SET "status" = 'CONFIRMED' WHERE "status" = 'PENDING';
UPDATE "orders" SET "status" = 'CONFIRMED' WHERE "status" = 'PROCESSING';
UPDATE "orders" SET "status" = 'SHIPPED' WHERE "status" = 'SHIPPED';

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;

-- Map SHIPPED to OUT_FOR_DELIVERY during the type cast
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus_new"
  USING (
    CASE "status"::text
      WHEN 'SHIPPED' THEN 'OUT_FOR_DELIVERY'::"OrderStatus_new"
      ELSE "status"::text::"OrderStatus_new"
    END
  );

ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
COMMIT;

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- Seed default settings
INSERT INTO "settings" ("key", "value", "updated_at") VALUES
  ('payment_online_enabled', 'true', NOW()),
  ('payment_cod_enabled', 'true', NOW()),
  ('payment_expiry_minutes', '30', NOW()),
  ('whatsapp_number', '', NOW())
ON CONFLICT ("key") DO NOTHING;
