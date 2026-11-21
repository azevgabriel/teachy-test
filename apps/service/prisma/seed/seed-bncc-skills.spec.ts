import { describe, expect, it } from 'vitest';
import { CURRICULAR_COMPONENTS } from './seed-curricular-components.js';
import { APPLICATION_YEARS } from './seed-application-years.js';
import {
  loadRawBnccSkills,
  resolveApplicationYears,
  resolveCurricularComponents,
} from './seed-bncc-skills.js';

describe('Seed BNCC Skills Logic', () => {
  describe('Curricular Component Resolution', () => {
    it('should map Educação Infantil fields correctly', () => {
      expect(resolveCurricularComponents('EI01EO01')).toEqual([
        'O eu, o outro e o nós',
      ]);
      expect(resolveCurricularComponents('EI02CG01')).toEqual([
        'Corpo, gestos e movimentos',
      ]);
      expect(resolveCurricularComponents('EI03TS01')).toEqual([
        'Traços, sons, cores e formas',
      ]);
      expect(resolveCurricularComponents('EI01EF01')).toEqual([
        'Escuta, fala, pensamento e imaginação',
      ]);
      expect(resolveCurricularComponents('EI02ET01')).toEqual([
        'Espaços, tempos, quantidades, relações e transformações',
      ]);
      expect(resolveCurricularComponents('EI03CO01')).toEqual(['Computação']);
    });

    it('should map Ensino Fundamental disciplines correctly', () => {
      expect(resolveCurricularComponents('EF01MA01')).toEqual(['Matemática']);
      expect(resolveCurricularComponents('EF15AR01')).toEqual(['Arte']);
      expect(resolveCurricularComponents('EF06CI01')).toEqual(['Ciências']);
      expect(resolveCurricularComponents('EF01EF01')).toEqual([
        'Educação Física',
      ]);
      expect(resolveCurricularComponents('EF02ER01')).toEqual([
        'Ensino Religioso',
      ]);
      expect(resolveCurricularComponents('EF03GE01')).toEqual(['Geografia']);
      expect(resolveCurricularComponents('EF04HI01')).toEqual(['História']);
      expect(resolveCurricularComponents('EF06LI01')).toEqual([
        'Língua Inglesa',
      ]);
      expect(resolveCurricularComponents('EF69LP01')).toEqual([
        'Língua Portuguesa',
      ]);
      expect(resolveCurricularComponents('EF01CO01')).toEqual(['Computação']);
    });

    it('should map Ensino Médio areas and components correctly', () => {
      expect(resolveCurricularComponents('EM13MAT101')).toEqual(['Matemática']);
      expect(resolveCurricularComponents('EM13LP01')).toEqual([
        'Língua Portuguesa',
      ]);
      expect(resolveCurricularComponents('EM13CO01')).toEqual(['Computação']);

      const lggComponents = resolveCurricularComponents('EM13LGG101');
      expect(lggComponents).toEqual([
        'Arte',
        'Educação Física',
        'Língua Inglesa',
        'Língua Portuguesa',
      ]);

      const cntComponents = resolveCurricularComponents('EM13CNT101');
      expect(cntComponents).toEqual(['Biologia', 'Física', 'Química']);

      const chsComponents = resolveCurricularComponents('EM13CHS101');
      expect(chsComponents).toEqual([
        'Filosofia',
        'Geografia',
        'História',
        'Sociologia',
      ]);
    });

    it('should map complementary computing axis codes to Computação', () => {
      expect(resolveCurricularComponents('PCEMJD01')).toEqual(['Computação']);
      expect(resolveCurricularComponents('TDEM01')).toEqual(['Computação']);
      expect(resolveCurricularComponents('CDEMDE01')).toEqual(['Computação']);
    });
  });

  describe('Application Year Resolution', () => {
    it('should map Educação Infantil groups correctly', () => {
      expect(resolveApplicationYears('EI01EO01')).toEqual([
        'Ensino Infantil (zero a 1 ano e 6 meses)',
      ]);
      expect(resolveApplicationYears('EI02CG01')).toEqual([
        'Ensino Infantil (1 ano e 7 meses a 3 anos e 11 meses)',
      ]);
      expect(resolveApplicationYears('EI03TS01')).toEqual([
        'Ensino Infantil (4 anos a 5 anos e 11 meses)',
      ]);
    });

    it('should map Ensino Fundamental single year codes and multi-year blocks correctly', () => {
      const singleYear = resolveApplicationYears('EF01MA01');
      expect(singleYear).toContain('1º ano do Ensino Fundamental I');
      expect(singleYear).toContain('EJA - Ensino Fundamental I');
      expect(singleYear).toContain('EJA - Ensino Fundamental II');

      const block15 = resolveApplicationYears('EF15AR01');
      expect(block15).toContain('1º ano do Ensino Fundamental I');
      expect(block15).toContain('2º ano do Ensino Fundamental I');
      expect(block15).toContain('3º ano do Ensino Fundamental I');
      expect(block15).toContain('4º ano do Ensino Fundamental I');
      expect(block15).toContain('5º ano do Ensino Fundamental I');

      const block69 = resolveApplicationYears('EF69LP01');
      expect(block69).toContain('6º ano do Ensino Fundamental II');
      expect(block69).toContain('7º ano do Ensino Fundamental II');
      expect(block69).toContain('8º ano do Ensino Fundamental II');
      expect(block69).toContain('9º ano do Ensino Fundamental II');
    });

    it('should map Ensino Médio codes to all EM years and EJA Médio', () => {
      const emYears = resolveApplicationYears('EM13MAT101');
      expect(emYears).toEqual([
        '1º ano do Ensino Médio',
        '2º ano do Ensino Médio',
        '3º ano do Ensino Médio',
        'EJA - Ensino Médio',
      ]);

      expect(resolveApplicationYears('PCEMJD01')).toEqual([
        '1º ano do Ensino Médio',
        '2º ano do Ensino Médio',
        '3º ano do Ensino Médio',
        'EJA - Ensino Médio',
      ]);
    });
  });

  describe('Full Data Integrity & Coverage', () => {
    it('should load all 1,705 skills with 100% relational coverage', () => {
      const skills = loadRawBnccSkills();
      expect(skills.length).toBe(1705);

      const componentNames = new Set(CURRICULAR_COMPONENTS);
      const coveredComponents = new Set<string>();

      for (const skill of skills) {
        expect(skill.code).toBeDefined();
        expect(skill.description).toBeDefined();
        expect(skill.description.length).toBeGreaterThan(0);

        const components = resolveCurricularComponents(skill.code);
        expect(components.length).toBeGreaterThan(0);
        for (const comp of components) {
          expect(componentNames.has(comp as any)).toBe(true);
          coveredComponents.add(comp);
        }

        const years = resolveApplicationYears(skill.code);
        expect(years.length).toBeGreaterThan(0);
      }

      expect(coveredComponents.size).toBe(20);
    });

    it('should define all 20 curricular components and 19 application years', () => {
      expect(CURRICULAR_COMPONENTS.length).toBe(20);
      expect(APPLICATION_YEARS.length).toBe(19);
    });
  });
});
