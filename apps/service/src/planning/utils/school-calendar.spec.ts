import { describe, it, expect } from 'vitest';
import {
  isWeekend,
  isNationalHoliday,
  isLocalRecess,
  isSchoolDay,
  getNextSchoolDay,
  getSchoolDaysBetween,
  toISODateString,
} from './school-calendar.js';

describe('SchoolCalendar Utilities', () => {
  describe('isWeekend', () => {
    it('detecta sábados e domingos corretamente', () => {
      // 2026-08-08 é Sábado, 2026-08-09 é Domingo
      expect(isWeekend('2026-08-08')).toBe(true);
      expect(isWeekend('2026-08-09')).toBe(true);
      // 2026-08-07 é Sexta-feira, 2026-08-10 é Segunda-feira
      expect(isWeekend('2026-08-07')).toBe(false);
      expect(isWeekend('2026-08-10')).toBe(false);
    });
  });

  describe('isNationalHoliday (date-holidays BR)', () => {
    it('reconhece feriados nacionais oficiais brasileiros', () => {
      // 7 de Setembro - Independência do Brasil
      expect(isNationalHoliday('2026-09-07')).toBe(true);
      // 12 de Outubro - Nossa Senhora Aparecida
      expect(isNationalHoliday('2026-10-12')).toBe(true);
      // 21 de Abril - Tiradentes
      expect(isNationalHoliday('2026-04-21')).toBe(true);
      // 1 de Maio - Dia do Trabalho
      expect(isNationalHoliday('2026-05-01')).toBe(true);
    });

    it('não classifica dias comuns como feriados', () => {
      expect(isNationalHoliday('2026-08-03')).toBe(false);
      expect(isNationalHoliday('2026-08-05')).toBe(false);
    });
  });

  describe('isLocalRecess', () => {
    it('detecta datas informadas na lista de recessos locais', () => {
      const recesses = ['2026-08-04', '2026-08-06'];
      expect(isLocalRecess('2026-08-04', recesses)).toBe(true);
      expect(isLocalRecess('2026-08-06', recesses)).toBe(true);
      expect(isLocalRecess('2026-08-05', recesses)).toBe(false);
    });
  });

  describe('isSchoolDay', () => {
    it('considera dia não letivo se for fim de semana, feriado nacional ou recesso da sessão', () => {
      const recesses = ['2026-08-04', '2026-08-06'];

      // Segunda-feira normal
      expect(isSchoolDay('2026-08-03', recesses)).toBe(true);
      // Terça-feira com recesso local
      expect(isSchoolDay('2026-08-04', recesses)).toBe(false);
      // Quarta-feira normal
      expect(isSchoolDay('2026-08-05', recesses)).toBe(true);
      // Quinta-feira com recesso local
      expect(isSchoolDay('2026-08-06', recesses)).toBe(false);
      // Sexta-feira normal
      expect(isSchoolDay('2026-08-07', recesses)).toBe(true);
      // Sábado (fim de semana)
      expect(isSchoolDay('2026-08-08', recesses)).toBe(false);
      // Domingo (fim de semana)
      expect(isSchoolDay('2026-08-09', recesses)).toBe(false);
      // Feriado nacional (7 de setembro de 2026 é segunda-feira)
      expect(isSchoolDay('2026-09-07', recesses)).toBe(false);
    });
  });

  describe('getNextSchoolDay', () => {
    it('avança para o próximo dia letivo pulando recessos locais e fins de semana', () => {
      const recesses = ['2026-08-04', '2026-08-06'];

      // A partir de 03/08 (seg), o próximo seria 04/08 (recesso), logo deve ir para 05/08
      const nextFrom03 = getNextSchoolDay('2026-08-03', recesses);
      expect(toISODateString(nextFrom03)).toBe('2026-08-05');

      // A partir de 05/08 (qua), o próximo seria 06/08 (recesso), logo deve ir para 07/08
      const nextFrom05 = getNextSchoolDay('2026-08-05', recesses);
      expect(toISODateString(nextFrom05)).toBe('2026-08-07');

      // A partir de 07/08 (sex), pula sábado e domingo e vai para 10/08 (seg)
      const nextFrom07 = getNextSchoolDay('2026-08-07', recesses);
      expect(toISODateString(nextFrom07)).toBe('2026-08-10');
    });
  });

  describe('getSchoolDaysBetween', () => {
    it('calcula a lista exata de dias letivos excluindo recessos e feriados', () => {
      const recesses = ['2026-08-04', '2026-08-06'];
      const schoolDays = getSchoolDaysBetween('2026-08-03', '2026-08-11', recesses);

      // Esperado: 03/08 (seg), 05/08 (qua), 07/08 (sex), 10/08 (seg), 11/08 (ter)
      expect(schoolDays).toEqual([
        '2026-08-03',
        '2026-08-05',
        '2026-08-07',
        '2026-08-10',
        '2026-08-11',
      ]);
    });
  });
});
