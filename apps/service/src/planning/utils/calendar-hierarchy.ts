/**
 * Utilitários para navegação e cálculo de hierarquia de semanas e meses no calendário escolar.
 * Garante operações determinísticas baseadas em UTC para evitar discrepâncias de fuso horário.
 */

/**
 * Retorna a segunda-feira da semana de uma data de referência (ao meio-dia UTC).
 */
export function getMondayOfWeek(d: Date | string): Date {
  const date = new Date(d);
  const day = date.getUTCDay(); // 0 é Domingo, 1 é Segunda, ..., 6 é Sábado
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diffToMonday, 12, 0, 0));
}

/**
 * Retorna a sexta-feira correspondente à segunda-feira informada (ao meio-dia UTC).
 */
export function getFridayOfWeek(monday: Date): Date {
  return new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 4, 12, 0, 0));
}

export interface ComputedWeek {
  startAt: Date;
  endAt: Date;
  order: number;
}

/**
 * Calcula as semanas úteis (segunda a sexta) contidas dentro do período [startAt, endAt].
 * Se o início ou término do período cortar a semana, os limites da semana são ajustados.
 */
export function computeWeeksForPeriod(startAt: Date | string, endAt: Date | string): ComputedWeek[] {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const weeks: ComputedWeek[] = [];

  let curMonday = getMondayOfWeek(start);
  let order = 1;

  while (curMonday.getTime() <= end.getTime()) {
    const friday = getFridayOfWeek(curMonday);

    // Ajusta o início da semana se o período começar após a segunda-feira
    const weekStart = curMonday.getTime() < start.getTime() ? start : curMonday;
    // Ajusta o fim da semana se o período terminar antes da sexta-feira
    const weekEnd = friday.getTime() > end.getTime() ? end : friday;

    if (weekStart.getTime() <= weekEnd.getTime()) {
      weeks.push({
        startAt: weekStart,
        endAt: weekEnd,
        order,
      });
      order++;
    }

    // Avança 7 dias para a próxima segunda-feira
    curMonday = new Date(Date.UTC(curMonday.getUTCFullYear(), curMonday.getUTCMonth(), curMonday.getUTCDate() + 7, 12, 0, 0));
  }

  return weeks;
}
