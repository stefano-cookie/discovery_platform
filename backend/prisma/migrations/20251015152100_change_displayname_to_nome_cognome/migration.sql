-- AlterTable: Change displayName to nome and cognome
-- Step 1: Add new columns with defaults
ALTER TABLE "AdminAccount" ADD COLUMN "nome" TEXT NOT NULL DEFAULT 'Admin';
ALTER TABLE "AdminAccount" ADD COLUMN "cognome" TEXT NOT NULL DEFAULT 'Discovery';

-- Step 2: Migrate existing data (split displayName into nome/cognome)
-- For existing records, try to split displayName by space
UPDATE "AdminAccount"
SET
  "nome" = SPLIT_PART("displayName", ' ', 1),
  "cognome" = CASE
    WHEN SPLIT_PART("displayName", ' ', 2) != ''
    THEN SPLIT_PART("displayName", ' ', 2)
    ELSE 'Admin'
  END
WHERE "displayName" IS NOT NULL;

-- Step 3: Drop displayName column
ALTER TABLE "AdminAccount" DROP COLUMN "displayName";

-- Step 4: Remove defaults (fields should be explicitly set from now on)
ALTER TABLE "AdminAccount" ALTER COLUMN "nome" DROP DEFAULT;
ALTER TABLE "AdminAccount" ALTER COLUMN "cognome" DROP DEFAULT;
