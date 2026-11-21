-- CreateEnum
CREATE TYPE "EducationStage" AS ENUM ('INFANTIL', 'FUNDAMENTAL_I', 'FUNDAMENTAL_II', 'MEDIO');

-- CreateTable
CREATE TABLE "application_years" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "EducationStage" NOT NULL,
    "target_age" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bncc_skills" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bncc_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curricular_components" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curricular_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ApplicationYearToBnccSkill" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ApplicationYearToBnccSkill_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BnccSkillToCurricularComponent" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BnccSkillToCurricularComponent_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "application_years_name_key" ON "application_years"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bncc_skills_code_key" ON "bncc_skills"("code");

-- CreateIndex
CREATE UNIQUE INDEX "curricular_components_name_key" ON "curricular_components"("name");

-- CreateIndex
CREATE INDEX "_ApplicationYearToBnccSkill_B_index" ON "_ApplicationYearToBnccSkill"("B");

-- CreateIndex
CREATE INDEX "_BnccSkillToCurricularComponent_B_index" ON "_BnccSkillToCurricularComponent"("B");

-- AddForeignKey
ALTER TABLE "_ApplicationYearToBnccSkill" ADD CONSTRAINT "_ApplicationYearToBnccSkill_A_fkey" FOREIGN KEY ("A") REFERENCES "application_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ApplicationYearToBnccSkill" ADD CONSTRAINT "_ApplicationYearToBnccSkill_B_fkey" FOREIGN KEY ("B") REFERENCES "bncc_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BnccSkillToCurricularComponent" ADD CONSTRAINT "_BnccSkillToCurricularComponent_A_fkey" FOREIGN KEY ("A") REFERENCES "bncc_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BnccSkillToCurricularComponent" ADD CONSTRAINT "_BnccSkillToCurricularComponent_B_fkey" FOREIGN KEY ("B") REFERENCES "curricular_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;
