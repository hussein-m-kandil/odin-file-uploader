-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "fullname" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password" CHAR(60) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
