-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('PENDING', 'ACTIVE', 'UNSUBSCRIBED');

-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "SubscriberStatus" NOT NULL DEFAULT 'PENDING',
    "confirmationToken" TEXT,
    "confirmationExpiry" TIMESTAMP(3),
    "subscribedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_email_key" ON "subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_confirmationToken_key" ON "subscribers"("confirmationToken");

-- CreateIndex
CREATE INDEX "subscribers_status_idx" ON "subscribers"("status");

-- CreateIndex
CREATE INDEX "subscribers_createdAt_idx" ON "subscribers"("createdAt");
