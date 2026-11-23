-- CreateTable
CREATE TABLE "reference_documents" (
    "id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "stored_file_name" TEXT NOT NULL,
    "local_file_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "extracted_text" TEXT,
    "extracted_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ReferenceDocumentToSession" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ReferenceDocumentToSession_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ReferenceDocumentToSession_B_index" ON "_ReferenceDocumentToSession"("B");

-- AddForeignKey
ALTER TABLE "_ReferenceDocumentToSession" ADD CONSTRAINT "_ReferenceDocumentToSession_A_fkey" FOREIGN KEY ("A") REFERENCES "reference_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReferenceDocumentToSession" ADD CONSTRAINT "_ReferenceDocumentToSession_B_fkey" FOREIGN KEY ("B") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
