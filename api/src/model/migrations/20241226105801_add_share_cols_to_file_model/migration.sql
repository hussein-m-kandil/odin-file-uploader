/*
  Warnings:

  - You are about to drop the column `is_public` on the `files` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "files" DROP COLUMN "is_public",
ADD COLUMN     "is_shared" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "share_exp_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
