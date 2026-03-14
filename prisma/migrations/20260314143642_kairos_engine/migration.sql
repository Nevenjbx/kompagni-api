/*
  Warnings:

  - You are about to drop the column `endTime` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `providerId` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `breed` on the `pets` table. All the data in the column will be lost.
  - You are about to drop the column `character` on the `pets` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `pets` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `pets` table. All the data in the column will be lost.
  - You are about to drop the column `animalType` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `services` table. All the data in the column will be lost.
  - You are about to drop the `provider_pet_notes` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `actualDurationMinutes` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clientDurationMax` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `estimatedPrice` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceDisplayMode` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `salonId` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slotEnd` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slotStart` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `staffId` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tableDurationMinutes` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `theoreticalDurationMinutes` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Made the column `petId` on table `appointments` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `birthDate` to the `pets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `breedId` to the `pets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `pets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `coatType` to the `pets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `groomingBehavior` to the `pets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sex` to the `pets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `species` to the `pets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weightKg` to the `pets` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CoatType" AS ENUM ('SHORT', 'NORMAL', 'LONG', 'CURLY', 'DOUBLE_COAT', 'MATTED');

-- CreateEnum
CREATE TYPE "GroomingBehavior" AS ENUM ('EASY', 'NERVOUS', 'DIFFICULT');

-- CreateEnum
CREATE TYPE "SkinCondition" AS ENUM ('NORMAL', 'SENSITIVE', 'PROBLEM');

-- CreateEnum
CREATE TYPE "AnimalCategory" AS ENUM ('SMALL', 'LARGE', 'GIANT', 'CAT', 'NAC');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('PROFESSIONAL', 'APPRENTICE');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('FULL_DAY', 'HALF_DAY', 'TIME_RANGE');

-- CreateEnum
CREATE TYPE "BlockScope" AS ENUM ('SALON', 'STAFF');

-- CreateEnum
CREATE TYPE "ValidationMode" AS ENUM ('AUTO', 'MANUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppointmentStatus" ADD VALUE 'REJECTED';
ALTER TYPE "AppointmentStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "AppointmentStatus" ADD VALUE 'NO_SHOW';

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_petId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_providerId_fkey";

-- DropForeignKey
ALTER TABLE "provider_pet_notes" DROP CONSTRAINT "provider_pet_notes_petId_fkey";

-- DropForeignKey
ALTER TABLE "provider_pet_notes" DROP CONSTRAINT "provider_pet_notes_providerId_fkey";

-- DropIndex
DROP INDEX "appointments_clientId_startTime_idx";

-- DropIndex
DROP INDEX "appointments_providerId_startTime_idx";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "endTime",
DROP COLUMN "notes",
DROP COLUMN "providerId",
DROP COLUMN "startTime",
ADD COLUMN     "actualDurationMinutes" INTEGER NOT NULL,
ADD COLUMN     "appliedModifiers" TEXT[],
ADD COLUMN     "clientDurationMax" INTEGER NOT NULL,
ADD COLUMN     "clientFreeNote" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "estimatedPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "hasKnotsToday" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "lockExpiresAt" TIMESTAMP(3),
ADD COLUMN     "lockToken" TEXT,
ADD COLUMN     "precautions" TEXT,
ADD COLUMN     "priceDisplayDisclaimer" TEXT,
ADD COLUMN     "priceDisplayMode" TEXT NOT NULL,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "salonId" TEXT NOT NULL,
ADD COLUMN     "slotEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "slotStart" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "staffId" TEXT NOT NULL,
ADD COLUMN     "tableDurationMinutes" INTEGER NOT NULL,
ADD COLUMN     "theoreticalDurationMinutes" INTEGER NOT NULL,
ALTER COLUMN "petId" SET NOT NULL;

-- AlterTable
ALTER TABLE "pets" DROP COLUMN "breed",
DROP COLUMN "character",
DROP COLUMN "size",
DROP COLUMN "type",
ADD COLUMN     "birthDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "breedId" TEXT NOT NULL,
ADD COLUMN     "category" "AnimalCategory" NOT NULL,
ADD COLUMN     "coatType" "CoatType" NOT NULL,
ADD COLUMN     "groomingBehavior" "GroomingBehavior" NOT NULL,
ADD COLUMN     "isNeutered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastGroomedAt" TIMESTAMP(3),
ADD COLUMN     "sex" TEXT NOT NULL,
ADD COLUMN     "skinCondition" "SkinCondition" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "species" TEXT NOT NULL,
ADD COLUMN     "weightKg" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "services" DROP COLUMN "animalType",
DROP COLUMN "duration",
DROP COLUMN "price",
ADD COLUMN     "animalTypes" TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "blockedReason" TEXT,
ADD COLUMN     "cancellationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "provider_pet_notes";

-- DropEnum
DROP TYPE "AnimalType";

-- DropEnum
DROP TYPE "PetCharacter";

-- DropEnum
DROP TYPE "PetSize";

-- CreateTable
CREATE TABLE "salon_configs" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "validationMode" "ValidationMode" NOT NULL DEFAULT 'AUTO',
    "pendingExpiryHours" INTEGER NOT NULL DEFAULT 24,
    "slotGranularityMin" INTEGER NOT NULL DEFAULT 30,
    "planningHorizonDays" INTEGER NOT NULL DEFAULT 14,
    "concurrentLimits" JSONB NOT NULL DEFAULT '{"SMALL":2,"LARGE":1,"GIANT":1,"CAT":1,"NAC":1}',
    "cancelDeadlineHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salon_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "speedIndex" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "allowedServiceIds" TEXT[],
    "weeklySchedule" JSONB NOT NULL DEFAULT '[]',
    "leaves" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "base_rules" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "minWeightKg" DOUBLE PRECISION NOT NULL,
    "maxWeightKg" DOUBLE PRECISION NOT NULL,
    "baseDurationMinutes" INTEGER NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "includedMinutes" DOUBLE PRECISION NOT NULL,
    "overtimeRatePerMin" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "base_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_rules" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "addedMinutes" INTEGER NOT NULL DEFAULT 0,
    "priceEffectFlat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceEffectPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_blocks" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "type" "BlockType" NOT NULL,
    "scope" "BlockScope" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "halfDay" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "targetStaffId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_locks" (
    "id" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_refinements" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "coatType" "CoatType",
    "groomingBehavior" "GroomingBehavior",
    "skinCondition" "SkinCondition",
    "toiletteurNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_refinements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_adjustments" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salon_configs_salonId_key" ON "salon_configs"("salonId");

-- CreateIndex
CREATE UNIQUE INDEX "base_rules_salonId_serviceId_minWeightKg_key" ON "base_rules"("salonId", "serviceId", "minWeightKg");

-- CreateIndex
CREATE UNIQUE INDEX "modifier_rules_salonId_triggerType_key" ON "modifier_rules"("salonId", "triggerType");

-- CreateIndex
CREATE INDEX "slot_locks_slotKey_idx" ON "slot_locks"("slotKey");

-- CreateIndex
CREATE INDEX "slot_locks_expiresAt_idx" ON "slot_locks"("expiresAt");

-- CreateIndex
CREATE INDEX "appointments_salonId_slotStart_idx" ON "appointments"("salonId", "slotStart");

-- CreateIndex
CREATE INDEX "appointments_clientId_slotStart_idx" ON "appointments"("clientId", "slotStart");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_staffId_slotStart_idx" ON "appointments"("staffId", "slotStart");

-- AddForeignKey
ALTER TABLE "salon_configs" ADD CONSTRAINT "salon_configs_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "base_rules" ADD CONSTRAINT "base_rules_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "base_rules" ADD CONSTRAINT "base_rules_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_rules" ADD CONSTRAINT "modifier_rules_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_blocks" ADD CONSTRAINT "manual_blocks_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_refinements" ADD CONSTRAINT "animal_refinements_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_refinements" ADD CONSTRAINT "animal_refinements_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_adjustments" ADD CONSTRAINT "price_adjustments_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_adjustments" ADD CONSTRAINT "price_adjustments_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
