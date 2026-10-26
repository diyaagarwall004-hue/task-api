-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "assignedById" INTEGER,
ADD COLUMN     "dayBeforeSentAt" TIMESTAMP(3),
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "hourBeforeSentAt" TIMESTAMP(3),
ADD COLUMN     "lastOverdueSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
