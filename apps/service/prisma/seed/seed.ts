import type { PrismaClient } from '@prisma/client';
import { seedCurricularComponents } from './seed-curricular-components.js';
import { seedApplicationYears } from './seed-application-years.js';
import { seedBnccSkills } from './seed-bncc-skills.js';

export async function runSeed(prisma: PrismaClient) {
  console.log('--- Starting Database Seeding ---');
  await seedCurricularComponents(prisma);
  await seedApplicationYears(prisma);
  await seedBnccSkills(prisma);
  console.log('--- Database Seeding Completed ---');
}
