-- Fix any unexpected values first, so the conversion to enums cannot fail.
UPDATE "User" SET "role" = 'user' WHERE "role" NOT IN ('user', 'admin', 'super_admin');
UPDATE "Task" SET "status" = 'pending' WHERE "status" NOT IN ('pending', 'completed');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'completed');

-- AlterTable: role becomes an enum, add updatedAt
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: status becomes an enum, add updatedAt
ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "TaskStatus" USING ("status"::"TaskStatus");
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'pending';
ALTER TABLE "Task" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Task_userId_createdAt_idx" ON "Task"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_assignedById_idx" ON "Task"("assignedById");
