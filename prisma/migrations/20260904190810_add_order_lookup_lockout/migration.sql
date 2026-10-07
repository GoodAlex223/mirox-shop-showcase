-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "lookupFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lookupLockedUntil" TIMESTAMP(3);
