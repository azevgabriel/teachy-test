import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  isSchoolDay,
  getNextSchoolDay,
  parseCalendarDate,
  toISODateString,
} from '../utils/school-calendar.js';

export interface ReallocateLessonsData {
  recessDates?: string[];
  startDate?: string;
}

@Injectable()
export class ReallocateLessonsUseCase {
  private readonly logger = new Logger(ReallocateLessonsUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(sessionId: string, data?: ReallocateLessonsData) {
    this.logger.log(`Executando ReallocateLessons para sessão ${sessionId}`);

    const planning = await this.prisma.planning.findFirst({
      where: { sessionId },
      include: {
        blocks: {
          orderBy: [{ startAt: 'asc' }, { order: 'asc' }],
        },
      },
    });

    if (!planning) {
      throw new NotFoundException(`Planejamento não encontrado para sessão ${sessionId}`);
    }

    // 1. Unificar e persistir recessDates informadas
    const existingRecesses = (planning.recessDates || []).map(toISODateString);
    const newRecesses = (data?.recessDates || []).map(toISODateString);
    const combinedRecesses = Array.from(new Set([...existingRecesses, ...newRecesses]));

    if (newRecesses.length > 0) {
      await this.prisma.planning.update({
        where: { id: planning.id },
        data: { recessDates: combinedRecesses },
      });
    }

    if (!planning.blocks || planning.blocks.length === 0) {
      return planning;
    }

    // 2. Ordena os blocos existentes cronologicamente e por ordem determinística
    const sortedBlocks = [...planning.blocks].sort((a, b) => {
      const timeA = a.startAt ? new Date(a.startAt).getTime() : 0;
      const timeB = b.startAt ? new Date(b.startAt).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return (a.order ?? 0) - (b.order ?? 0);
    });

    // 3. Realocação determinística das aulas em cascata pulando feriados, fins de semana e recessos
    let currentSchoolDay: Date | null = null;
    let lastOriginalDateStr: string | null = null;
    let latestAssignedDate: Date | null = null;

    for (const block of sortedBlocks) {
      const origDateStr = block.startAt ? toISODateString(block.startAt) : null;

      if (currentSchoolDay === null) {
        const baseDate = data?.startDate
          ? parseCalendarDate(data.startDate)
          : block.startAt
            ? parseCalendarDate(block.startAt)
            : parseCalendarDate(planning.startAt || new Date());

        currentSchoolDay = isSchoolDay(baseDate, combinedRecesses)
          ? baseDate
          : getNextSchoolDay(baseDate, combinedRecesses, true);
      } else if (origDateStr && lastOriginalDateStr && origDateStr === lastOriginalDateStr) {
        // Blocos que dividiam o mesmo dia original permanecem alocados no mesmo dia letivo
      } else {
        // Avança para o próximo dia letivo
        currentSchoolDay = getNextSchoolDay(currentSchoolDay, combinedRecesses, false);
      }

      lastOriginalDateStr = origDateStr;
      latestAssignedDate = currentSchoolDay;

      // Preserva integralmente metodologia, BNCCs, metadados EAV e avaliações; atualiza startAt e endAt
      await this.prisma.planningBlock.update({
        where: { id: block.id },
        data: {
          startAt: currentSchoolDay,
          ...(block.endAt ? { endAt: currentSchoolDay } : {}),
        },
      });
    }

    // 4. Atualiza endAt do cabeçalho Planning se as aulas ultrapassaram o período anterior
    if (latestAssignedDate) {
      const currentPlanningEnd = planning.endAt ? new Date(planning.endAt) : null;
      if (!currentPlanningEnd || latestAssignedDate.getTime() > currentPlanningEnd.getTime()) {
        await this.prisma.planning.update({
          where: { id: planning.id },
          data: { endAt: latestAssignedDate },
        });
      }
    }

    // 5. Atualiza blocos pais se houver hierarquia
    const parentIds = Array.from(new Set(sortedBlocks.map((b) => b.parentId).filter(Boolean))) as string[];
    for (const pId of parentIds) {
      const childBlocks = await this.prisma.planningBlock.findMany({
        where: { parentId: pId },
        orderBy: { startAt: 'desc' },
      });
      if (childBlocks.length > 0 && childBlocks[0].startAt) {
        await this.prisma.planningBlock.update({
          where: { id: pId },
          data: { endAt: childBlocks[0].startAt },
        });
      }
    }

    return this.prisma.planning.findFirst({
      where: { id: planning.id },
      include: { blocks: true },
    });
  }
}
