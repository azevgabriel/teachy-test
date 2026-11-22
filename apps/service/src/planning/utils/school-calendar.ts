import Holidays from 'date-holidays';

const hd = new Holidays('BR');

/**
 * Converte Date ou string para formato canônico YYYY-MM-DD.
 */
export function toISODateString(date: Date | string): string {
  if (typeof date === 'string') {
    return date.slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Faz o parse seguro de uma data para um Date no meio do dia em UTC (12:00:00Z),
 * prevenindo deslocamentos indevidos de fuso horário.
 */
export function parseCalendarDate(date: Date | string): Date {
  if (date instanceof Date) {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();
    return new Date(Date.UTC(y, m, d, 12, 0, 0, 0));
  }

  const dateStr = toISODateString(date);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

/**
 * Verifica se a data cai em fim de semana (Sábado ou Domingo).
 */
export function isWeekend(date: Date | string): boolean {
  const dt = parseCalendarDate(date);
  const day = dt.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Verifica se a data é feriado nacional brasileiro (público ou bancário).
 */
export function isNationalHoliday(date: Date | string): boolean {
  const dt = parseCalendarDate(date);
  const holiday = hd.isHoliday(dt);
  if (!holiday) return false;

  if (Array.isArray(holiday)) {
    return holiday.some((h) => h.type === 'public' || h.type === 'bank' || h.type === 'school');
  }

  const hType = (holiday as { type?: string }).type;
  return hType === 'public' || hType === 'bank' || hType === 'school';
}

/**
 * Retorna o nome do feriado nacional se aplicável.
 */
export function getHolidayName(date: Date | string): string | null {
  const dt = parseCalendarDate(date);
  const holiday = hd.isHoliday(dt);
  if (!holiday) return null;

  if (Array.isArray(holiday)) {
    const active = holiday.find((h) => h.type === 'public' || h.type === 'bank' || h.type === 'school');
    return active ? active.name : null;
  }

  return (holiday as { name?: string }).name || null;
}

/**
 * Verifica se a data é dia de recesso local informado pelo professor.
 */
export function isLocalRecess(date: Date | string, recessDates: string[] = []): boolean {
  const dateStr = toISODateString(date);
  return recessDates.some((r) => toISODateString(r) === dateStr);
}

/**
 * Determina se um dia é letivo:
 * Dia não letivo = Sábado/Domingo OU Feriado Nacional (date-holidays) OU Recesso Local da Sessão.
 */
export function isSchoolDay(date: Date | string, recessDates: string[] = []): boolean {
  if (isWeekend(date)) return false;
  if (isNationalHoliday(date)) return false;
  if (isLocalRecess(date, recessDates)) return false;
  return true;
}

/**
 * Encontra o próximo dia letivo a partir de uma data de referência (inclusive ou a partir do dia seguinte).
 */
export function getNextSchoolDay(date: Date | string, recessDates: string[] = [], includeCurrent = false): Date {
  let dt = parseCalendarDate(date);

  if (!includeCurrent) {
    dt = new Date(dt.getTime() + 24 * 60 * 60 * 1000);
  }

  while (!isSchoolDay(dt, recessDates)) {
    dt = new Date(dt.getTime() + 24 * 60 * 60 * 1000);
  }

  return dt;
}

/**
 * Retorna a lista de dias letivos (YYYY-MM-DD) entre startAt e endAt (inclusive).
 */
export function getSchoolDaysBetween(
  startAt: Date | string,
  endAt: Date | string,
  recessDates: string[] = [],
): string[] {
  const start = parseCalendarDate(startAt);
  const end = parseCalendarDate(endAt);

  if (end.getTime() < start.getTime()) return [];

  const schoolDays: string[] = [];
  let current = new Date(start.getTime());

  while (current.getTime() <= end.getTime()) {
    if (isSchoolDay(current, recessDates)) {
      schoolDays.push(toISODateString(current));
    }
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }

  return schoolDays;
}
