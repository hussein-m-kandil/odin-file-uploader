-- DropForeignKey
ALTER TABLE "files" DROP CONSTRAINT "files_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "files" DROP CONSTRAINT "files_parent_id_fkey";

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "files"("file_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
