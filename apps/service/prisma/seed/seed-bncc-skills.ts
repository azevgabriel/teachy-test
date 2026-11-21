import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';

export interface RawBnccSkill {
  code: string;
  description: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads the 1,705 BNCC skills from reference file tmp/createAllBnccSkills.ts
 * or from the local fixture fallback.
 */
export function loadRawBnccSkills(): RawBnccSkill[] {
  const tmpReferencePath = path.resolve(
    __dirname,
    '../../../../tmp/createAllBnccSkills.ts',
  );
  const fixturePath = path.resolve(
    __dirname,
    './fixtures/bncc-skills-raw.json',
  );

  if (fs.existsSync(tmpReferencePath)) {
    try {
      const content = fs.readFileSync(tmpReferencePath, 'utf-8');
      const caseRegex =
        /case '([A-Z0-9]+)':\s+return (?:'([^']*)'|"([^"]*)");/g;
      const descriptions = new Map<string, string>();
      let match: RegExpExecArray | null;

      while ((match = caseRegex.exec(content)) !== null) {
        descriptions.set(match[1], match[2] ?? match[3] ?? '');
      }

      const codesPart = content.substring(
        content.indexOf('export const bnccCodes'),
      );
      const codeRegex = /'([A-Z0-9]+)'/g;
      const codes: string[] = [];

      while ((match = codeRegex.exec(codesPart)) !== null) {
        codes.push(match[1]);
      }

      if (codes.length > 0 && descriptions.size >= codes.length) {
        return codes.map((code) => ({
          code,
          description: descriptions.get(code) ?? '',
        }));
      }
    } catch {
      // Fallback to local fixture if file read or parsing fails
    }
  }

  if (fs.existsSync(fixturePath)) {
    const raw = fs.readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw) as RawBnccSkill[];
  }

  throw new Error(
    'Could not load BNCC skills from reference tmp/createAllBnccSkills.ts or fixtures.',
  );
}

/**
 * Resolves Curricular Components for a given BNCC skill code
 * according to the 20 components defined in the project architecture
 * and tmp/load-bncc-skills.ts rules.
 */
export function resolveCurricularComponents(code: string): string[] {
  const components: string[] = [];

  if (code.startsWith('EI')) {
    const field = code.substring(4, 6);
    switch (field) {
      case 'EO':
        components.push('O eu, o outro e o nós');
        break;
      case 'CG':
        components.push('Corpo, gestos e movimentos');
        break;
      case 'TS':
        components.push('Traços, sons, cores e formas');
        break;
      case 'EF':
        components.push('Escuta, fala, pensamento e imaginação');
        break;
      case 'ET':
        components.push(
          'Espaços, tempos, quantidades, relações e transformações',
        );
        break;
      case 'CO':
        components.push('Computação');
        break;
    }
  } else if (code.startsWith('EF')) {
    const field = code.substring(4, 6);
    switch (field) {
      case 'AR':
        components.push('Arte');
        break;
      case 'CI':
        components.push('Ciências');
        break;
      case 'EF':
        components.push('Educação Física');
        break;
      case 'ER':
        components.push('Ensino Religioso');
        break;
      case 'GE':
        components.push('Geografia');
        break;
      case 'HI':
        components.push('História');
        break;
      case 'LI':
        components.push('Língua Inglesa');
        break;
      case 'LP':
        components.push('Língua Portuguesa');
        break;
      case 'MA':
        components.push('Matemática');
        break;
      case 'CO':
        components.push('Computação');
        break;
    }
  } else if (code.startsWith('EM')) {
    const sub = code.substring(4);
    if (sub.startsWith('MAT')) {
      components.push('Matemática');
    } else if (sub.startsWith('LP')) {
      components.push('Língua Portuguesa');
    } else if (sub.startsWith('CO')) {
      components.push('Computação');
    } else if (sub.startsWith('LGG')) {
      components.push(
        'Arte',
        'Educação Física',
        'Língua Inglesa',
        'Língua Portuguesa',
      );
    } else if (sub.startsWith('CNT')) {
      components.push('Biologia', 'Física', 'Química');
    } else if (sub.startsWith('CHS')) {
      components.push('Filosofia', 'Geografia', 'História', 'Sociologia');
    }
  } else if (
    code.startsWith('CDEM') ||
    code.startsWith('PCEM') ||
    code.startsWith('TDEM')
  ) {
    components.push('Computação');
  }

  return components;
}

/**
 * Resolves Application Years for a given BNCC skill code
 * based on tmp/applicationYear.ts and tmp/load-bncc-skills.ts rules.
 */
export function resolveApplicationYears(code: string): string[] {
  const years: string[] = [];

  if (code.startsWith('EI01')) {
    years.push('Ensino Infantil (zero a 1 ano e 6 meses)');
  } else if (code.startsWith('EI02')) {
    years.push('Ensino Infantil (1 ano e 7 meses a 3 anos e 11 meses)');
  } else if (code.startsWith('EI03')) {
    years.push('Ensino Infantil (4 anos a 5 anos e 11 meses)');
  } else if (code.startsWith('EF')) {
    // EJA Ensino Fundamental I and II match EF as per tmp/load-bncc-skills.ts rules
    years.push('EJA - Ensino Fundamental I', 'EJA - Ensino Fundamental II');

    const codeArr = code.split('');
    const initialYear = parseInt(codeArr[2] ?? '0', 10) || 0;
    const finalYear = parseInt(codeArr[3] ?? '0', 10) || 0;

    const efYearNames: Record<number, string> = {
      1: '1º ano do Ensino Fundamental I',
      2: '2º ano do Ensino Fundamental I',
      3: '3º ano do Ensino Fundamental I',
      4: '4º ano do Ensino Fundamental I',
      5: '5º ano do Ensino Fundamental I',
      6: '6º ano do Ensino Fundamental II',
      7: '7º ano do Ensino Fundamental II',
      8: '8º ano do Ensino Fundamental II',
      9: '9º ano do Ensino Fundamental II',
    };

    if (initialYear === 0) {
      if (efYearNames[finalYear]) {
        years.push(efYearNames[finalYear]);
      }
    } else {
      for (let y = initialYear; y <= finalYear; y++) {
        if (efYearNames[y]) {
          years.push(efYearNames[y]);
        }
      }
    }
  } else if (
    code.startsWith('EM') ||
    code.startsWith('CDEM') ||
    code.startsWith('PCEM') ||
    code.startsWith('TDEM')
  ) {
    // Matches EM years and EJA - Ensino Médio as per tmp/load-bncc-skills.ts rules
    years.push(
      '1º ano do Ensino Médio',
      '2º ano do Ensino Médio',
      '3º ano do Ensino Médio',
      'EJA - Ensino Médio',
    );
  }

  return years;
}

export async function seedBnccSkills(prisma: PrismaClient) {
  const rawSkills = loadRawBnccSkills();
  console.log(
    `Seeding ${rawSkills.length} BNCC skills with Many-to-Many relations...`,
  );

  // Pre-load components and application years into memory maps for fast lookup
  const [dbComponents, dbYears] = await Promise.all([
    prisma.curricularComponent.findMany({ select: { id: true, name: true } }),
    prisma.applicationYear.findMany({ select: { id: true, name: true } }),
  ]);

  const componentMap = new Map(dbComponents.map((c) => [c.name, c.id]));
  const yearMap = new Map(dbYears.map((y) => [y.name, y.id]));

  // Batching in chunks of 50 to optimize database round-trips
  const BATCH_SIZE = 50;
  let processed = 0;

  for (let i = 0; i < rawSkills.length; i += BATCH_SIZE) {
    const batch = rawSkills.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map((skill) => {
        const componentNames = resolveCurricularComponents(skill.code);
        const yearNames = resolveApplicationYears(skill.code);

        const componentIds = componentNames
          .map((name) => componentMap.get(name))
          .filter((id): id is string => typeof id === 'string');

        const yearIds = yearNames
          .map((name) => yearMap.get(name))
          .filter((id): id is string => typeof id === 'string');

        return prisma.bnccSkill.upsert({
          where: { code: skill.code },
          update: {
            description: skill.description,
            curricularComponents: {
              set: componentIds.map((id) => ({ id })),
            },
            applicationYears: {
              set: yearIds.map((id) => ({ id })),
            },
          },
          create: {
            code: skill.code,
            description: skill.description,
            curricularComponents: {
              connect: componentIds.map((id) => ({ id })),
            },
            applicationYears: {
              connect: yearIds.map((id) => ({ id })),
            },
          },
        });
      }),
    );

    processed += batch.length;
    if (processed % 250 === 0 || processed === rawSkills.length) {
      console.log(`  Processed ${processed}/${rawSkills.length} skills...`);
    }
  }

  console.log(`BNCC skills seeded successfully.`);
}
