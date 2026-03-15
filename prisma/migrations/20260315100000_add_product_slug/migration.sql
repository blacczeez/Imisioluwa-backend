-- Step 1: Add slug column as nullable
ALTER TABLE "products" ADD COLUMN "slug" TEXT;

-- Step 2: Generate slugs from name_en for existing products
-- Uses lowercase, replaces spaces/special chars with hyphens, strips non-alphanumeric
UPDATE "products" SET "slug" = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE("name_en", '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  )
);

-- Step 3: Handle duplicate slugs by appending row number
WITH duplicates AS (
  SELECT id, slug, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) as rn
  FROM "products"
)
UPDATE "products" p
SET slug = d.slug || '-' || d.rn
FROM duplicates d
WHERE p.id = d.id AND d.rn > 1;

-- Step 4: Trim leading/trailing hyphens
UPDATE "products" SET "slug" = TRIM(BOTH '-' FROM "slug");

-- Step 5: Make slug NOT NULL and UNIQUE
ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
