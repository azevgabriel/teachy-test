import { describe, it, expect } from 'vitest';
import {
  matchApplicationYear,
  matchCurricularComponent,
  type ApplicationYearCandidate,
  type CurricularComponentCandidate,
} from './academic-catalog-matcher.js';

describe('academic-catalog-matcher', () => {
  const applicationYears: ApplicationYearCandidate[] = [
    { id: '1', name: 'Ensino Infantil (zero a 1 ano e 6 meses)', stage: 'INFANTIL', targetAge: 'zero a 1 ano e 6 meses' },
    { id: '2', name: 'Ensino Infantil (1 ano e 7 meses a 3 anos e 11 meses)', stage: 'INFANTIL', targetAge: '1 ano e 7 meses a 3 anos e 11 meses' },
    { id: '3', name: 'Ensino Infantil (4 anos a 5 anos e 11 meses)', stage: 'INFANTIL', targetAge: '4 anos a 5 anos e 11 meses' },
    { id: '4', name: '1º ano do Ensino Fundamental I', stage: 'FUNDAMENTAL_I', targetAge: '6 anos' },
    { id: '5', name: '2º ano do Ensino Fundamental I', stage: 'FUNDAMENTAL_I', targetAge: '7 anos' },
    { id: '6', name: '3º ano do Ensino Fundamental I', stage: 'FUNDAMENTAL_I', targetAge: '8 anos' },
    { id: '7', name: '4º ano do Ensino Fundamental I', stage: 'FUNDAMENTAL_I', targetAge: '9 anos' },
    { id: '8', name: '5º ano do Ensino Fundamental I', stage: 'FUNDAMENTAL_I', targetAge: '10 anos' },
    { id: '9', name: '6º ano do Ensino Fundamental II', stage: 'FUNDAMENTAL_II', targetAge: '11 anos' },
    { id: '10', name: '7º ano do Ensino Fundamental II', stage: 'FUNDAMENTAL_II', targetAge: '12 anos' },
    { id: '11', name: '8º ano do Ensino Fundamental II', stage: 'FUNDAMENTAL_II', targetAge: '13 anos' },
    { id: '12', name: '9º ano do Ensino Fundamental II', stage: 'FUNDAMENTAL_II', targetAge: '14 anos' },
    { id: '13', name: '1º ano do Ensino Médio', stage: 'MEDIO', targetAge: '15 anos' },
    { id: '14', name: '2º ano do Ensino Médio', stage: 'MEDIO', targetAge: '16 anos' },
    { id: '15', name: '3º ano do Ensino Médio', stage: 'MEDIO', targetAge: '17 anos' },
    { id: '16', name: 'EJA - Ensino Fundamental I', stage: 'FUNDAMENTAL_I', targetAge: 'mais de 15 anos' },
    { id: '17', name: 'EJA - Ensino Fundamental II', stage: 'FUNDAMENTAL_II', targetAge: 'mais de 15 anos' },
    { id: '18', name: 'EJA - Ensino Médio', stage: 'MEDIO', targetAge: 'mais de 18 anos' },
  ];

  const curricularComponents: CurricularComponentCandidate[] = [
    { id: 'c1', name: 'Física' },
    { id: 'c2', name: 'Matemática' },
    { id: 'c3', name: 'Química' },
    { id: 'c4', name: 'Biologia' },
    { id: 'c5', name: 'Língua Portuguesa' },
    { id: 'c6', name: 'Geografia' },
    { id: 'c7', name: 'História' },
    { id: 'c8', name: 'Ciências' },
    { id: 'c9', name: 'Educação Física' },
    { id: 'c10', name: 'Ensino Religioso' },
    { id: 'c11', name: 'Língua Inglesa' },
    { id: 'c12', name: 'Arte' },
    { id: 'c13', name: 'O eu, o outro e o nós' },
    { id: 'c14', name: 'Corpo, gestos e movimentos' },
    { id: 'c15', name: 'Traços, sons, cores e formas' },
    { id: 'c16', name: 'Escuta, fala, pensamento e imaginação' },
    { id: 'c17', name: 'Espaços, tempos, quantidades, relações e transformações' },
    { id: 'c18', name: 'Filosofia' },
    { id: 'c19', name: 'Sociologia' },
    { id: 'c20', name: 'Computação' },
  ];

  describe('matchApplicationYear', () => {
    it('corretamente associa "3º Ano do EM" ao 3º ano do Ensino Médio (evita Fundamental I)', () => {
      const match = matchApplicationYear('3º Ano do EM', applicationYears);
      expect(match).not.toBeNull();
      expect(match?.name).toBe('3º ano do Ensino Médio');
      expect(match?.stage).toBe('MEDIO');
    });

    it('corretamente associa "3º ano do Ensino Médio" exato', () => {
      const match = matchApplicationYear('3º ano do Ensino Médio', applicationYears);
      expect(match?.name).toBe('3º ano do Ensino Médio');
    });

    it('corretamente associa "1º ano do EM" e "2º ano do EM"', () => {
      const match1 = matchApplicationYear('1º ano do EM', applicationYears);
      expect(match1?.name).toBe('1º ano do Ensino Médio');

      const match2 = matchApplicationYear('2º ano do Ensino Médio', applicationYears);
      expect(match2?.name).toBe('2º ano do Ensino Médio');
    });

    it('corretamente associa "3º ano" sem menção ao EM ao 3º ano do Ensino Fundamental I', () => {
      const match = matchApplicationYear('3º ano do Ensino Fundamental', applicationYears);
      expect(match?.name).toBe('3º ano do Ensino Fundamental I');
    });

    it('corretamente associa "9º ano" ao Ensino Fundamental II', () => {
      const match = matchApplicationYear('9º ano', applicationYears);
      expect(match?.name).toBe('9º ano do Ensino Fundamental II');
    });

    it('corretamente associa expressões de Educação Infantil', () => {
      const bebe = matchApplicationYear('bebês no berçário (0 a 1 ano)', applicationYears);
      expect(bebe?.name).toBe('Ensino Infantil (zero a 1 ano e 6 meses)');

      const pequenas = matchApplicationYear('crianças bem pequenas (1 ano e 7 meses a 3 anos)', applicationYears);
      expect(pequenas?.name).toBe('Ensino Infantil (1 ano e 7 meses a 3 anos e 11 meses)');

      const pre = matchApplicationYear('turma da pré-escola (4 e 5 anos)', applicationYears);
      expect(pre?.name).toBe('Ensino Infantil (4 anos a 5 anos e 11 meses)');
    });

    it('retorna null para query vazia ou sem candidatos', () => {
      expect(matchApplicationYear('', applicationYears)).toBeNull();
      expect(matchApplicationYear('qualquer coisa', [])).toBeNull();
    });
  });

  describe('matchCurricularComponent', () => {
    it('corretamente associa "Vou trabalhar com Lingua portuguesa durante um prazo de 3 meses" a Língua Portuguesa', () => {
      const match = matchCurricularComponent(
        'Vou trabalhar com Lingua portuguesa durante um prazo de 3 meses',
        curricularComponents,
      );
      expect(match).not.toBeNull();
      expect(match?.name).toBe('Língua Portuguesa');
    });

    it('JAMAIS associa "Língua Portuguesa" a "Escuta, fala, pensamento e imaginação"', () => {
      const match1 = matchCurricularComponent('Língua Portuguesa', curricularComponents);
      expect(match1?.name).toBe('Língua Portuguesa');

      const match2 = matchCurricularComponent('aula de português e redação', curricularComponents);
      expect(match2?.name).toBe('Língua Portuguesa');
    });

    it('corretamente associa campo de experiência da Educação Infantil quando solicitado', () => {
      const match = matchCurricularComponent(
        'campo de experiência escuta, fala, pensamento e imaginação',
        curricularComponents,
      );
      expect(match?.name).toBe('Escuta, fala, pensamento e imaginação');
    });

    it('JAMAIS confunde Matemática com Espaços, tempos, quantidades...', () => {
      const matchMath = matchCurricularComponent('Matemática', curricularComponents);
      expect(matchMath?.name).toBe('Matemática');

      const matchEspacos = matchCurricularComponent(
        'vivências com espaços, tempos, quantidades e transformações',
        curricularComponents,
      );
      expect(matchEspacos?.name).toBe('Espaços, tempos, quantidades, relações e transformações');
    });

    it('corretamente associa disciplinas diversas', () => {
      expect(matchCurricularComponent('História', curricularComponents)?.name).toBe('História');
      expect(matchCurricularComponent('Química orgânica', curricularComponents)?.name).toBe('Química');
      expect(matchCurricularComponent('Educação Física', curricularComponents)?.name).toBe('Educação Física');
      expect(matchCurricularComponent('Inglês', curricularComponents)?.name).toBe('Língua Inglesa');
      expect(matchCurricularComponent('Computação e robótica', curricularComponents)?.name).toBe('Computação');
    });

    it('retorna null para query vazia ou sem candidatos', () => {
      expect(matchCurricularComponent('', curricularComponents)).toBeNull();
      expect(matchCurricularComponent('qualquer coisa desconhecida', [])).toBeNull();
    });
  });
});
