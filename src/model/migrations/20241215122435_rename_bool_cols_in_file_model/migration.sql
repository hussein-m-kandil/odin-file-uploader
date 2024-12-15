/*
  Warnings:

  - You are about to drop the column `shared` on the `files` table. All the data in the column will be lost.
  - You are about to drop the column `type_dir` on the `files` table. All the data in the column will be lost.
  - Added the required column `is_dir` to the `files` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "files"
DROP COLUMN "shared",
DROP COLUMN "type_dir",
ADD COLUMN     "is_dir" BOOLEAN NOT NULL,
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false;
