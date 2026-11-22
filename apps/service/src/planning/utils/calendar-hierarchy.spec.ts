import { describe, it, expect } from 'vitest';
import {
  getMondayOfWeek,
  getFridayOfWeek,
  computeWeeksForPeriod,
} from './calendar-hierarchy.js';

describe('calendar-hierarchy utils', () => {
  describe('getMondayOfWeek', () => {
    it('retorna a própria segunda-feira quando a data já é uma segunda', () => {
      const monday = new Date('2026-08-03T10:00:00Z');
      const result = getMondayOfWeek(monday);
      expect(result.toISOString().slice(0, 10)).toBe('2026-08-03');
    });

    it('retrocede para a segunda-feira da mesma semana a partir de uma quarta-feira', () => {
      const wednesday = new Date('2026-08-05T14:30:00Z');
      const result = getMondayOfWeek(wednesday);
      expect(result.toISOString().slice(0, 10)).toBe('2026-08-03');
    });

    it('retrocede para a segunda-feira a partir de uma sexta-feira', () => {
      const friday = new Date('2026-08-07T18:00:00Z');
      const result = getMondayOfWeek(friday);
      expect(result.toISOString().slice(0, 10)).toBe('2026-08-03');
    });

    it('retrocede para a segunda-feira anterior a partir de um domingo', () => {
      const sunday = new Date('2026-08-09T12:00:00Z');
      const result = getMondayOfWeek(sunday);
      expect(result.toISOString().slice(0, 10)).toBe('2026-08-03');
    });

    it('retrocede para a segunda-feira anterior a partir de um sábado', () => {
      const saturday = new Date('2026-08-08T12:00:00Z');
      const result = getMondayOfWeek(saturday);
      expect(result.toISOString().slice(0, 10)).toBe('2026-08-03');
    });
  });

  describe('getFridayOfWeek', () => {
    it('retorna a sexta-feira correspondente à segunda-feira informada', () => {
      const monday = new Date('2026-08-03T12:00:00Z');
      const friday = getFridayOfWeek(monday);
      expect(friday.toISOString().slice(0, 10)).toBe('2026-08-07');
    });
  });

  describe('computeWeeksForPeriod', () => {
    it('calcula as semanas úteis de um mês letivo (ex: Agosto 2026)', () => {
      const weeks = computeWeeksForPeriod('2026-08-01T00:00:00Z', '2026-08-31T23:59:59Z');

      expect(weeks.length).toBe(5);
      expect(weeks[0].order).toBe(1);
      expect(weeks[0].startAt.toISOString().slice(0, 10)).toBe('2026-08-03');
      expect(weeks[0].endAt.toISOString().slice(0, 10)).toBe('2026-08-07');

      expect(weeks[1].order).toBe(2);
      expect(weeks[1].startAt.toISOString().slice(0, 10)).toBe('2026-08-10');
      expect(weeks[1].endAt.toISOString().slice(0, 10)).toBe('2026-08-14');

      expect(weeks[4].order).toBe(5);
      expect(weeks[4].startAt.toISOString().slice(0, 10)).toBe('2026-08-31');
    });

    it('calcula exatamente 4 semanas para um ciclo delimitado de 4 semanas', () => {
      const weeks = computeWeeksForPeriod('2026-08-03T12:00:00Z', '2026-08-28T12:00:00Z');
      expect(weeks.length).toBe(4);
      expect(weeks.map((w) => w.order)).toEqual([1, 2, 3, 4]);
    });
  });
});
