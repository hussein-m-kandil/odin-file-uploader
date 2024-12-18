-- CreateTable
CREATE TABLE "files_metadata" (
    "id" SERIAL NOT NULL,
    "file_id" UUID NOT NULL,
    "size" INTEGER NOT NULL,
    "encoding" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "path" TEXT NOT NULL,

    CONSTRAINT "files_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_metadata_file_id_key" ON "files_metadata"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_metadata_path_key" ON "files_metadata"("path");

-- AddForeignKey
ALTER TABLE "files_metadata" ADD CONSTRAINT "files_metadata_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("file_id") ON DELETE CASCADE ON UPDATE CASCADE;
