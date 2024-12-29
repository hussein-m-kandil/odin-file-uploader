-- CreateTable
CREATE TABLE "files" (
    "file_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "file_name" VARCHAR(100) NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "type_dir" BOOLEAN NOT NULL,
    "parent_id" UUID,
    "owner_id" INTEGER NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("file_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_file_name_parent_id_key" ON "files"("file_name", "parent_id");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "files"("file_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
