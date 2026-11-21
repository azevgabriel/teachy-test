import type { EducationStage, PrismaClient } from '@prisma/client';

export interface ApplicationYearSeedData {
  name: string;
  stage: EducationStage;
  targetAge: string;
}

export const APPLICATION_YEARS: ApplicationYearSeedData[] = [
  {
    name: 'Ensino Infantil (zero a 1 ano e 6 meses)',
    stage: 'INFANTIL',
    targetAge: 'zero a 1 ano e 6 meses',
  },
  {
    name: 'Ensino Infantil (1 ano e 7 meses a 3 anos e 11 meses)',
    stage: 'INFANTIL',
    targetAge: '1 ano e 7 meses a 3 anos e 11 meses',
  },
  {
    name: 'Ensino Infantil (4 anos a 5 anos e 11 meses)',
    stage: 'INFANTIL',
    targetAge: '4 anos a 5 anos e 11 meses',
  },
  {
    name: '1º ano do Ensino Fundamental I',
    stage: 'FUNDAMENTAL_I',
    targetAge: '6 anos',
  },
  {
    name: '2º ano do Ensino Fundamental I',
    stage: 'FUNDAMENTAL_I',
    targetAge: '7 anos',
  },
  {
    name: '3º ano do Ensino Fundamental I',
    stage: 'FUNDAMENTAL_I',
    targetAge: '8 anos',
  },
  {
    name: '4º ano do Ensino Fundamental I',
    stage: 'FUNDAMENTAL_I',
    targetAge: '9 anos',
  },
  {
    name: '5º ano do Ensino Fundamental I',
    stage: 'FUNDAMENTAL_I',
    targetAge: '10 anos',
  },
  {
    name: '6º ano do Ensino Fundamental II',
    stage: 'FUNDAMENTAL_II',
    targetAge: '11 anos',
  },
  {
    name: '7º ano do Ensino Fundamental II',
    stage: 'FUNDAMENTAL_II',
    targetAge: '12 anos',
  },
  {
    name: '8º ano do Ensino Fundamental II',
    stage: 'FUNDAMENTAL_II',
    targetAge: '13 anos',
  },
  {
    name: '9º ano do Ensino Fundamental II',
    stage: 'FUNDAMENTAL_II',
    targetAge: '14 anos',
  },
  {
    name: '1º ano do Ensino Médio',
    stage: 'MEDIO',
    targetAge: '15 anos',
  },
  {
    name: '2º ano do Ensino Médio',
    stage: 'MEDIO',
    targetAge: '16 anos',
  },
  {
    name: '3º ano do Ensino Médio',
    stage: 'MEDIO',
    targetAge: '17 anos',
  },
  {
    name: 'EJA - Ensino Fundamental I',
    stage: 'FUNDAMENTAL_I',
    targetAge: 'mais de 15 anos',
  },
  {
    name: 'EJA - Ensino Fundamental II',
    stage: 'FUNDAMENTAL_II',
    targetAge: 'mais de 15 anos',
  },
  {
    name: 'EJA - Ensino Médio',
    stage: 'MEDIO',
    targetAge: 'mais de 18 anos',
  },
  {
    name: 'Outros',
    stage: 'FUNDAMENTAL_I',
    targetAge: '(Sem idade definida)',
  },
];

export async function seedApplicationYears(prisma: PrismaClient) {
  console.log(`Seeding ${APPLICATION_YEARS.length} application years...`);

  await Promise.all(
    APPLICATION_YEARS.map((year) =>
      prisma.applicationYear.upsert({
        where: { name: year.name },
        update: {
          stage: year.stage,
          targetAge: year.targetAge,
        },
        create: {
          name: year.name,
          stage: year.stage,
          targetAge: year.targetAge,
        },
      }),
    ),
  );

  console.log(`Application years seeded successfully.`);
}
