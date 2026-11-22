import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SinglePatchOperation } from '../../ai/patch/planning-patch.schema.js';
import type { PlanningGranularity } from '@prisma/client';
import { matchApplicationYear, matchCurricularComponent } from '../utils/index.js';

type UpsertPlanningData = Extract<SinglePatchOperation, { operation: 'UPSERT_PLANNING' }>['data'];

@Injectable()
export class UpsertPlanningUseCase {
  private readonly logger = new Logger(UpsertPlanningUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(sessionId: string, data: UpsertPlanningData) {
    this.logger.log(`Executando UpsertPlanning para sessão ${sessionId}`);

    // 1. Resolver ApplicationYear se fornecido por nome ou ID com alta precisão
    let applicationYearId = data.applicationYearId;
    if (!applicationYearId && data.applicationYearName) {
      const allYears = await this.prisma.applicationYear.findMany();
      const matched = matchApplicationYear(data.applicationYearName, allYears);
      if (matched) {
        applicationYearId = matched.id;
      }
    }

    // 2. Resolver CurricularComponents por nome com separação rigorosa de campos da Ed. Infantil
    const componentIds: string[] = [];
    if (data.curricularComponentNames && data.curricularComponentNames.length > 0) {
      const allComponents = await this.prisma.curricularComponent.findMany();
      for (const reqName of data.curricularComponentNames) {
        const found = matchCurricularComponent(reqName, allComponents);
        if (found && !componentIds.includes(found.id)) {
          componentIds.push(found.id);
        }
      }
    }

    // 3. Resolver Escola (se fornecida por nome)
    let schoolId = data.schoolId;
    if (!schoolId && data.schoolName) {
      let school = await this.prisma.school.findFirst({
        where: { name: { equals: data.schoolName.trim(), mode: 'insensitive' } },
      });
      if (!school) {
        school = await this.prisma.school.create({
          data: { name: data.schoolName.trim() },
        });
      }
      schoolId = school.id;
    }

    const startAt = data.startAt ? new Date(data.startAt) : null;
    const endAt = data.endAt ? new Date(data.endAt) : null;
    const granularity = (data.granularity as PlanningGranularity) || undefined;

    // 4. Upsert do Cabeçalho Macro Planning
    let planning = await this.prisma.planning.findFirst({
      where: { sessionId },
    });

    if (!planning) {
      planning = await this.prisma.planning.create({
        data: {
          sessionId,
          granularity,
          startAt,
          endAt,
          schoolId: schoolId || null,
          applicationYearId: applicationYearId || null,
          curricularComponents: {
            connect: componentIds.map((id) => ({ id })),
          },
        },
      });
    } else {
      const yearChanged = applicationYearId && applicationYearId !== planning.applicationYearId;

      planning = await this.prisma.planning.update({
        where: { id: planning.id },
        data: {
          ...(granularity ? { granularity } : {}),
          ...(startAt !== undefined ? { startAt } : {}),
          ...(endAt !== undefined ? { endAt } : {}),
          ...(schoolId ? { schoolId } : {}),
          ...(applicationYearId ? { applicationYearId } : {}),
          ...(componentIds.length > 0
            ? {
                curricularComponents: {
                  set: componentIds.map((id) => ({ id })),
                },
              }
            : {}),
        },
      });

      // Se a etapa/ano mudou e nenhum novo bnccCode foi fornecido, limpa objetivos macro da etapa anterior
      if (yearChanged && (!data.bnccCodes || data.bnccCodes.length === 0)) {
        await this.prisma.learningObjective.deleteMany({
          where: { planningId: planning.id },
        });
      }
    }

    // 5. Vincular Habilidades BNCC Macro (LearningObjective XOR: planning_id preenchido)
    if (data.bnccCodes && data.bnccCodes.length > 0) {
      const skills = await this.prisma.bnccSkill.findMany({
        where: { code: { in: data.bnccCodes } },
      });

      // Sincroniza habilidades macro: remove as que não estão mais presentes na lista informada
      const activeSkillIds = skills.map((s) => s.id);
      await this.prisma.learningObjective.deleteMany({
        where: {
          planningId: planning.id,
          bnccSkillId: { notIn: activeSkillIds },
        },
      });

      for (const skill of skills) {
        const existing = await this.prisma.learningObjective.findFirst({
          where: {
            planningId: planning.id,
            bnccSkillId: skill.id,
          },
        });
        if (!existing) {
          await this.prisma.learningObjective.create({
            data: {
              planningId: planning.id,
              bnccSkillId: skill.id,
              planningBlockId: null, // Garante constraint XOR
            },
          });
        }
      }
    }

    // 5.1. Upsert de Especificações (Colunas Dinâmicas EAV)
    if (data.specifications && data.specifications.length > 0) {
      for (const specData of data.specifications) {
        const colName = specData.colName.toLowerCase().trim();
        const existingSpec = await this.prisma.specification.findFirst({
          where: { sessionId, colName: { equals: colName, mode: 'insensitive' } },
        });

        if (existingSpec) {
          await this.prisma.specification.update({
            where: { id: existingSpec.id },
            data: {
              customLabel: specData.customLabel || existingSpec.customLabel,
              tableRef: specData.tableRef,
              description: specData.description || existingSpec.description,
              isRequired: specData.isRequired ?? existingSpec.isRequired,
            },
          });
        } else {
          await this.prisma.specification.create({
            data: {
              sessionId,
              colName,
              customLabel: specData.customLabel || specData.colName,
              tableRef: specData.tableRef,
              description: specData.description || null,
              isRequired: specData.isRequired ?? false,
            },
          });
        }
      }
    }

    // 5.2. Persistência de Metadados Macro (PlanningMetadataValue XOR: planning_id preenchido)
    if (data.metadataValues && data.metadataValues.length > 0) {
      for (const meta of data.metadataValues) {
        const colName = meta.colName.toLowerCase().trim();
        let spec = await this.prisma.specification.findFirst({
          where: { sessionId, colName: { equals: colName, mode: 'insensitive' } },
        });

        if (!spec) {
          spec = await this.prisma.specification.create({
            data: {
              sessionId,
              colName,
              customLabel: meta.colName,
              tableRef: 'PLANNING',
              isRequired: false,
            },
          });
        }

        const existingMeta = await this.prisma.planningMetadataValue.findFirst({
          where: {
            specificationId: spec.id,
            planningId: planning.id,
          },
        });

        if (existingMeta) {
          await this.prisma.planningMetadataValue.update({
            where: { id: existingMeta.id },
            data: {
              textValue: meta.textValue ?? existingMeta.textValue,
              jsonbValue: (meta.jsonbValue as any) ?? existingMeta.jsonbValue,
            },
          });
        } else {
          await this.prisma.planningMetadataValue.create({
            data: {
              specificationId: spec.id,
              planningId: planning.id,
              planningBlockId: null, // Garante constraint XOR
              textValue: meta.textValue ?? null,
              jsonbValue: (meta.jsonbValue as any) ?? null,
            },
          });
        }
      }
    }

    // 5.3. Vincular Avaliações Macro (Evaluation XOR: planning_id preenchido)
    if (data.evaluations && data.evaluations.length > 0) {
      for (const ev of data.evaluations) {
        const existingEv = await this.prisma.evaluation.findFirst({
          where: {
            planningId: planning.id,
            name: ev.name || 'Avaliação Formativa',
          },
        });

        if (existingEv) {
          await this.prisma.evaluation.update({
            where: { id: existingEv.id },
            data: {
              instrumentType: ev.instrumentType || existingEv.instrumentType,
              criteria: ev.criteria ?? existingEv.criteria,
              description: ev.description ?? existingEv.description,
              grade: ev.grade !== undefined && ev.grade !== null ? String(ev.grade) : existingEv.grade,
              startAt: ev.startAt ? new Date(ev.startAt) : existingEv.startAt,
              endAt: ev.endAt ? new Date(ev.endAt) : existingEv.endAt,
            },
          });
        } else {
          await this.prisma.evaluation.create({
            data: {
              planningId: planning.id,
              planningBlockId: null, // Garante constraint XOR
              name: ev.name || 'Avaliação Formativa',
              instrumentType: ev.instrumentType || 'Observação',
              criteria: ev.criteria || null,
              description: ev.description || null,
              grade: ev.grade !== undefined && ev.grade !== null ? String(ev.grade) : null,
              startAt: ev.startAt ? new Date(ev.startAt) : startAt,
              endAt: ev.endAt ? new Date(ev.endAt) : endAt,
            },
          });
        }
      }

      // Se a avaliação foi definida no escopo macro e nenhum bloco define avaliações diárias,
      // limpa avaliações residuais de blocos criadas previamente por engano
      const hasBlockEvaluations = Boolean(data.blocks?.some((b) => b.evaluations && b.evaluations.length > 0));
      if (!hasBlockEvaluations) {
        await this.prisma.evaluation.deleteMany({
          where: {
            planningBlock: { planningId: planning.id },
          },
        });
      }
    }

    // 6. Criar ou Atualizar Blocos de Planejamento (PlanningBlock)
    if (data.blocks && data.blocks.length > 0) {
      for (let i = 0; i < data.blocks.length; i++) {
        const b = data.blocks[i];
        const blockStart = b.startAt ? new Date(b.startAt) : null;
        const blockEnd = b.endAt ? new Date(b.endAt) : null;
        const blockOrder = b.order ?? i + 1;
        const blockGranularity = (b.granularity as PlanningGranularity) || granularity;

        // Tenta encontrar bloco existente na data ou pela ordem
        let existingBlock = null;
        if (blockStart) {
          const nextDay = new Date(blockStart);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          existingBlock = await this.prisma.planningBlock.findFirst({
            where: {
              planningId: planning.id,
              startAt: { gte: blockStart, lt: nextDay },
            },
          });
        }

        if (!existingBlock) {
          existingBlock = await this.prisma.planningBlock.findFirst({
            where: {
              planningId: planning.id,
              order: blockOrder,
            },
          });
        }

        let savedBlock;
        if (existingBlock) {
          savedBlock = await this.prisma.planningBlock.update({
            where: { id: existingBlock.id },
            data: {
              ...(b.metodologia ? { metodologia: b.metodologia } : {}),
              ...(blockStart ? { startAt: blockStart } : {}),
              ...(blockEnd !== undefined ? { endAt: blockEnd } : {}),
              ...(blockGranularity ? { granularity: blockGranularity } : {}),
            },
          });
        } else {
          savedBlock = await this.prisma.planningBlock.create({
            data: {
              planningId: planning.id,
              order: blockOrder,
              granularity: blockGranularity,
              startAt: blockStart,
              endAt: blockEnd,
              metodologia: b.metodologia || null,
            },
          });
        }

        // Vincular BNCC ao Bloco (LearningObjective XOR: planning_block_id preenchido)
        if (b.bnccCodes && b.bnccCodes.length > 0) {
          const blockSkills = await this.prisma.bnccSkill.findMany({
            where: { code: { in: b.bnccCodes } },
          });

          for (const s of blockSkills) {
            const hasObj = await this.prisma.learningObjective.findFirst({
              where: {
                planningBlockId: savedBlock.id,
                bnccSkillId: s.id,
              },
            });
            if (!hasObj) {
              await this.prisma.learningObjective.create({
                data: {
                  planningBlockId: savedBlock.id,
                  bnccSkillId: s.id,
                  planningId: null, // Garante constraint XOR
                },
              });
            }
          }
        }

        // Vincular Avaliações ao Bloco (Evaluation XOR: planning_block_id preenchido)
        if (b.evaluations && b.evaluations.length > 0) {
          for (const ev of b.evaluations) {
            await this.prisma.evaluation.create({
              data: {
                planningBlockId: savedBlock.id,
                planningId: null, // Garante constraint XOR
                name: ev.name || 'Avaliação Formativa',
                instrumentType: ev.instrumentType || 'Observação',
                criteria: ev.criteria || null,
                description: ev.description || null,
                grade: ev.grade !== undefined && ev.grade !== null ? String(ev.grade) : null,
                startAt: ev.startAt ? new Date(ev.startAt) : blockStart,
                endAt: ev.endAt ? new Date(ev.endAt) : blockEnd,
              },
            });
          }
        }

        // Vincular Metadados ao Bloco (PlanningMetadataValue XOR: planning_block_id preenchido)
        if (b.metadataValues && b.metadataValues.length > 0) {
          for (const meta of b.metadataValues) {
            const colName = meta.colName.toLowerCase().trim();
            let spec = await this.prisma.specification.findFirst({
              where: { sessionId, colName: { equals: colName, mode: 'insensitive' } },
            });

            if (!spec) {
              spec = await this.prisma.specification.create({
                data: {
                  sessionId,
                  colName,
                  customLabel: meta.colName,
                  tableRef: 'PLANNING_BLOCK',
                  isRequired: false,
                },
              });
            }

            const existingMeta = await this.prisma.planningMetadataValue.findFirst({
              where: {
                specificationId: spec.id,
                planningBlockId: savedBlock.id,
              },
            });

            if (existingMeta) {
              await this.prisma.planningMetadataValue.update({
                where: { id: existingMeta.id },
                data: {
                  textValue: meta.textValue ?? existingMeta.textValue,
                  jsonbValue: (meta.jsonbValue as any) ?? existingMeta.jsonbValue,
                },
              });
            } else {
              await this.prisma.planningMetadataValue.create({
                data: {
                  specificationId: spec.id,
                  planningBlockId: savedBlock.id,
                  planningId: null, // Garante constraint XOR
                  textValue: meta.textValue ?? null,
                  jsonbValue: (meta.jsonbValue as any) ?? null,
                },
              });
            }
          }
        }
      }
    }

    return planning;
  }
}
