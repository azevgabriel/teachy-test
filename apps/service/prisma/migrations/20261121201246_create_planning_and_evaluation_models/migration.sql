-- CreateEnum
CREATE TYPE "planning_granularity" AS ENUM ('ANNUAL', 'SEMESTER', 'TRIMESTER', 'BIMONTHLY', 'MONTHLY', 'WEEKLY', 'DAILY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "specification_table_ref" AS ENUM ('PLANNING', 'PLANNING_BLOCK');

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "planning_id" TEXT,
    "planning_block_id" TEXT,
    "name" TEXT,
    "instrument_type" TEXT,
    "grade" DECIMAL(5,2),
    "criteria" TEXT,
    "description" TEXT,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_objectives" (
    "id" TEXT NOT NULL,
    "bncc_skill_id" TEXT NOT NULL,
    "planning_id" TEXT,
    "planning_block_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_blocks" (
    "id" TEXT NOT NULL,
    "planning_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "granularity" "planning_granularity",
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "metodologia" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planning_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_metadata_values" (
    "id" TEXT NOT NULL,
    "specification_id" TEXT NOT NULL,
    "planning_id" TEXT,
    "planning_block_id" TEXT,
    "text_value" TEXT,
    "jsonb_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planning_metadata_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plannings" (
    "id" TEXT NOT NULL,
    "school_id" TEXT,
    "session_id" TEXT NOT NULL,
    "application_year_id" TEXT,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "granularity" "planning_granularity",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plannings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specifications" (
    "id" TEXT NOT NULL,
    "school_id" TEXT,
    "session_id" TEXT NOT NULL,
    "table_ref" "specification_table_ref" NOT NULL,
    "col_name" TEXT NOT NULL,
    "custom_label" TEXT,
    "field_type" TEXT,
    "description" TEXT,
    "avg_char_limit" INTEGER,
    "font_size" TEXT,
    "font_family" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CurricularComponentToPlanning" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CurricularComponentToPlanning_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CurricularComponentToPlanning_B_index" ON "_CurricularComponentToPlanning"("B");

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_planning_id_fkey" FOREIGN KEY ("planning_id") REFERENCES "plannings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_planning_block_id_fkey" FOREIGN KEY ("planning_block_id") REFERENCES "planning_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_objectives" ADD CONSTRAINT "learning_objectives_bncc_skill_id_fkey" FOREIGN KEY ("bncc_skill_id") REFERENCES "bncc_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_objectives" ADD CONSTRAINT "learning_objectives_planning_id_fkey" FOREIGN KEY ("planning_id") REFERENCES "plannings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_objectives" ADD CONSTRAINT "learning_objectives_planning_block_id_fkey" FOREIGN KEY ("planning_block_id") REFERENCES "planning_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_blocks" ADD CONSTRAINT "planning_blocks_planning_id_fkey" FOREIGN KEY ("planning_id") REFERENCES "plannings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_blocks" ADD CONSTRAINT "planning_blocks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "planning_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_metadata_values" ADD CONSTRAINT "planning_metadata_values_specification_id_fkey" FOREIGN KEY ("specification_id") REFERENCES "specifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_metadata_values" ADD CONSTRAINT "planning_metadata_values_planning_id_fkey" FOREIGN KEY ("planning_id") REFERENCES "plannings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_metadata_values" ADD CONSTRAINT "planning_metadata_values_planning_block_id_fkey" FOREIGN KEY ("planning_block_id") REFERENCES "planning_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_application_year_id_fkey" FOREIGN KEY ("application_year_id") REFERENCES "application_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specifications" ADD CONSTRAINT "specifications_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specifications" ADD CONSTRAINT "specifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CurricularComponentToPlanning" ADD CONSTRAINT "_CurricularComponentToPlanning_A_fkey" FOREIGN KEY ("A") REFERENCES "curricular_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CurricularComponentToPlanning" ADD CONSTRAINT "_CurricularComponentToPlanning_B_fkey" FOREIGN KEY ("B") REFERENCES "plannings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraints (XOR exclusive owner checks)
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_exclusive_owner_check" CHECK (
    ("planning_id" IS NOT NULL AND "planning_block_id" IS NULL) OR
    ("planning_id" IS NULL AND "planning_block_id" IS NOT NULL)
);

ALTER TABLE "learning_objectives" ADD CONSTRAINT "learning_objectives_exclusive_owner_check" CHECK (
    ("planning_id" IS NOT NULL AND "planning_block_id" IS NULL) OR
    ("planning_id" IS NULL AND "planning_block_id" IS NOT NULL)
);

ALTER TABLE "planning_metadata_values" ADD CONSTRAINT "planning_metadata_values_exclusive_owner_check" CHECK (
    ("planning_id" IS NOT NULL AND "planning_block_id" IS NULL) OR
    ("planning_id" IS NULL AND "planning_block_id" IS NOT NULL)
);
