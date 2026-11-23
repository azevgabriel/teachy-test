import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddSpecificationWithSlotsUseCase } from './add-specification.use-case.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

describe('AddSpecificationWithSlotsUseCase', () => {
  let useCase: AddSpecificationWithSlotsUseCase;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      specification: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      planning: {
        findFirst: vi.fn(),
      },
      planningMetadataValue: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    useCase = new AddSpecificationWithSlotsUseCase(prismaMock as unknown as PrismaService);
  });

  it('cria nova especificação persistindo order, isVisible e showLabel customizados', async () => {
    prismaMock.specification.findFirst.mockResolvedValue(null);
    prismaMock.specification.create.mockResolvedValue({ id: 'spec-1' });

    await useCase.execute('session-1', {
      colName: 'disciplina',
      customLabel: 'Disciplina',
      tableRef: 'PLANNING',
      order: 1,
      isVisible: true,
      showLabel: false,
      isRequired: false,
    });

    expect(prismaMock.specification.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        colName: 'disciplina',
        customLabel: 'Disciplina',
        tableRef: 'PLANNING',
        description: null,
        avgCharLimit: null,
        isRequired: false,
        order: 1,
        isVisible: true,
        showLabel: false,
      },
    });
  });

  it('cria especificação com defaults quando order, isVisible e showLabel não forem definidos', async () => {
    prismaMock.specification.findFirst.mockResolvedValue(null);
    prismaMock.specification.create.mockResolvedValue({ id: 'spec-1' });

    await useCase.execute('session-1', {
      colName: 'conteudo',
      tableRef: 'PLANNING_BLOCK',
      isRequired: false,
      order: 0,
      isVisible: true,
      showLabel: true,
    });

    expect(prismaMock.specification.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        colName: 'conteudo',
        customLabel: 'conteudo',
        tableRef: 'PLANNING_BLOCK',
        description: null,
        avgCharLimit: null,
        isRequired: false,
        order: 0,
        isVisible: true,
        showLabel: true,
      },
    });
  });

  it('atualiza especificação existente mantendo ou alterando order, isVisible e showLabel', async () => {
    const existing = {
      id: 'spec-1',
      sessionId: 'session-1',
      colName: 'disciplina',
      customLabel: 'Componente',
      tableRef: 'PLANNING',
      description: null,
      isRequired: false,
      order: 1,
      isVisible: true,
      showLabel: true,
    };
    prismaMock.specification.findFirst.mockResolvedValue(existing);
    prismaMock.specification.update.mockResolvedValue({ ...existing, isVisible: false, showLabel: false });

    await useCase.execute('session-1', {
      colName: 'disciplina',
      customLabel: 'Disciplina',
      tableRef: 'PLANNING',
      order: 3,
      isVisible: false,
      showLabel: false,
      isRequired: true,
    });

    expect(prismaMock.specification.update).toHaveBeenCalledWith({
      where: { id: 'spec-1' },
      data: {
        customLabel: 'Disciplina',
        tableRef: 'PLANNING',
        description: null,
        isRequired: true,
        order: 3,
        isVisible: false,
        showLabel: false,
      },
    });
  });

  it('grava initialValue em planningMetadataValue se fornecido para tableRef PLANNING', async () => {
    prismaMock.specification.findFirst.mockResolvedValue(null);
    prismaMock.specification.create.mockResolvedValue({ id: 'spec-1' });
    prismaMock.planning.findFirst.mockResolvedValue({ id: 'plan-1', sessionId: 'session-1' });
    prismaMock.planningMetadataValue.findFirst.mockResolvedValue(null);

    await useCase.execute('session-1', {
      colName: 'aplicacao_crista',
      customLabel: 'Aplicação Cristã',
      tableRef: 'PLANNING',
      initialValue: 'Cuidado e amor',
      isRequired: false,
      order: 0,
      isVisible: true,
      showLabel: true,
    });

    expect(prismaMock.planningMetadataValue.create).toHaveBeenCalledWith({
      data: {
        specificationId: 'spec-1',
        planningId: 'plan-1',
        planningBlockId: null,
        textValue: 'Cuidado e amor',
      },
    });
  });
});
