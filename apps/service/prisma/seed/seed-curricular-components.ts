import type { PrismaClient } from '@prisma/client';

export const CURRICULAR_COMPONENTS = [
  'Física',
  'Matemática',
  'Química',
  'Biologia',
  'Língua Portuguesa',
  'Geografia',
  'História',
  'Ciências',
  'Educação Física',
  'Ensino Religioso',
  'Língua Inglesa',
  'Arte',
  'O eu, o outro e o nós',
  'Corpo, gestos e movimentos',
  'Traços, sons, cores e formas',
  'Escuta, fala, pensamento e imaginação',
  'Espaços, tempos, quantidades, relações e transformações',
  'Filosofia',
  'Sociologia',
  'Computação',
] as const;

export async function seedCurricularComponents(prisma: PrismaClient) {
  console.log(
    `Seeding ${CURRICULAR_COMPONENTS.length} curricular components...`,
  );

  await Promise.all(
    CURRICULAR_COMPONENTS.map((name) =>
      prisma.curricularComponent.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  console.log(`Curricular components seeded successfully.`);
}
