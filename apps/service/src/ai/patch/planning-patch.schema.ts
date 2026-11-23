import { z } from 'zod';

export const planningGranularityEnum = z.enum([
  'ANNUAL',
  'SEMESTER',
  'TRIMESTER',
  'BIMONTHLY',
  'MONTHLY',
  'WEEKLY',
  'DAILY',
  'CUSTOM',
]);

export const specificationTableRefEnum = z.enum(['PLANNING', 'PLANNING_BLOCK']);

export const patchMetadataValueSchema = z.object({
  colName: z.string(),
  textValue: z.string().optional(),
  jsonbValue: z.unknown().optional(),
});

export const patchEvaluationItemSchema = z.object({
  name: z.string().optional(),
  instrumentType: z.string().optional(),
  grade: z.union([z.number(), z.string()]).optional(),
  criteria: z.string().optional(),
  description: z.string().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});

export const addSpecificationPatchDataSchema = z.object({
  colName: z.string(),
  customLabel: z.string().optional(),
  tableRef: specificationTableRefEnum,
  description: z.string().optional(),
  isRequired: z.boolean().default(false),
  order: z.number().int().default(0),
  isVisible: z.boolean().default(true),
  showLabel: z.boolean().default(true),
  initialValue: z.string().optional(),
});

export const patchBlockItemSchema = z
  .object({
    id: z.string().optional(),
    parentId: z.string().optional().nullable(),
    granularity: planningGranularityEnum.optional(),
    startAt: z.string().optional().nullable(),
    endAt: z.string().optional().nullable(),
    order: z.number().int().optional(),
    metodologia: z.string().optional(),
    bnccCodes: z.array(z.string()).optional(),
    metadataValues: z.array(patchMetadataValueSchema).optional(),
    evaluations: z.array(patchEvaluationItemSchema).optional(),
  })
  .refine(
    (b) => {
      if (b.startAt && b.endAt) {
        return new Date(b.endAt).getTime() >= new Date(b.startAt).getTime();
      }
      return true;
    },
    {
      message: 'endAt do bloco não pode ser anterior a startAt',
      path: ['endAt'],
    },
  );

// 0. Setup Inicial ou Atualização de Dados Definitivos
export const upsertPlanningPatchSchema = z
  .object({
    operation: z.literal('UPSERT_PLANNING'),
    data: z.object({
      granularity: planningGranularityEnum.optional(),
      schoolId: z.string().optional(),
      schoolName: z.string().optional(),
      applicationYearId: z.string().optional(),
      applicationYearName: z.string().optional(),
      curricularComponentNames: z.array(z.string()).optional(),
      startAt: z.string().optional().nullable(),
      endAt: z.string().optional().nullable(),
      recessDates: z.array(z.string()).optional(),
      bnccCodes: z.array(z.string()).optional(),
      specifications: z.array(addSpecificationPatchDataSchema).optional(),
      metadataValues: z.array(patchMetadataValueSchema).optional(),
      blocks: z.array(patchBlockItemSchema).optional(),
      evaluations: z.array(patchEvaluationItemSchema).optional(),
    }),
  })
  .superRefine((val, ctx) => {
    const { data } = val;
    if (data.startAt && data.endAt) {
      if (new Date(data.endAt).getTime() < new Date(data.startAt).getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endAt não pode ser anterior a startAt no planejamento',
          path: ['data', 'endAt'],
        });
      }
    }

    if (data.blocks) {
      for (let i = 0; i < data.blocks.length; i++) {
        const b = data.blocks[i];
        if (data.granularity === 'WEEKLY' && !b.parentId && b.granularity === 'WEEKLY') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Blocos sob planejamento semanal não podem ter granularidade WEEKLY (devem ser DAILY)',
            path: ['data', 'blocks', i, 'granularity'],
          });
        }
      }
    }
  });

// 1. Troca Pontual de Bloco por Data
export const updateBlockByDatePatchSchema = z.object({
  operation: z.literal('UPDATE_BLOCK_BY_DATE'),
  data: z.object({
    date: z.string(), // YYYY-MM-DD ou ISO
    metodologia: z.string().optional(),
    bnccCodes: z.array(z.string()).optional(),
    evaluations: z.array(patchEvaluationItemSchema).optional(),
  }),
});

// 2. Atualização ou Compressão em Massa por Granularidade
export const batchUpdateColumnPatchSchema = z.object({
  operation: z.literal('BATCH_UPDATE_COLUMN'),
  data: z.object({
    granularity: planningGranularityEnum,
    colName: z.string(), // 'metodologia' ou nome da coluna customizada
    content: z.string(),
    filterParentId: z.string().optional(),
  }),
});

// 3. Adição de Especificação (Coluna Dinâmica)
export const addSpecificationPatchSchema = z.object({
  operation: z.literal('ADD_SPECIFICATION'),
  data: addSpecificationPatchDataSchema,
});

// 4. Preenchimento de Metadados EAV ou Colunas Nativas (ex: metodologia)
export const fillMetadataPatchSchema = z
  .object({
    operation: z.literal('FILL_METADATA'),
    data: z.object({
      colName: z.string().optional(),
      granularity: planningGranularityEnum.optional(),
      parentId: z.string().optional(),
      values: z.array(
        z.object({
          blockId: z.string().optional(),
          date: z.string().optional(),
          order: z.number().int().optional(),
          granularity: planningGranularityEnum.optional(),
          parentId: z.string().optional(),
          colName: z.string().optional(),
          textValue: z.string().optional(),
          jsonbValue: z.unknown().optional(),
        }),
      ),
    }),
  })
  .superRefine((val, ctx) => {
    const { colName, values } = val.data;
    if (!colName) {
      for (let i = 0; i < values.length; i++) {
        if (!values[i].colName) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'colName deve ser especificado no nível raiz ou em cada item de values',
            path: ['data', 'values', i, 'colName'],
          });
        }
      }
    }
  });

// 5. Exclusão de Bloco com Detecção de Gap
export const deleteBlockWithGapPatchSchema = z.object({
  operation: z.literal('DELETE_BLOCK_WITH_GAP'),
  data: z.object({
    blockId: z.string().optional(),
    date: z.string().optional(),
    granularity: planningGranularityEnum.optional(),
    order: z.number().int().optional(),
  }),
});

// 6. Reorganização de Árvore Hierárquica
export const reorganizeTreePatchSchema = z.object({
  operation: z.literal('REORGANIZE_TREE'),
  data: z.object({
    parentGranularity: planningGranularityEnum,
    childGranularity: planningGranularityEnum,
    mode: z.enum(['GROUP', 'SUBDIVIDE']).optional(),
  }),
});

// 7. Reset Completo da Sessão
export const resetPlanningPatchSchema = z.object({
  operation: z.literal('RESET_PLANNING'),
  data: z.record(z.string(), z.unknown()).optional(),
});

// 8. Consulta Somente Leitura
export const readOnlyPatchSchema = z.object({
  operation: z.literal('READ_ONLY'),
  data: z
    .object({
      queryType: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

// 9. Realocação Automática de Aulas por Recessos e Feriados
export const reallocateLessonsPatchSchema = z.object({
  operation: z.literal('REALLOCATE_LESSONS'),
  data: z
    .object({
      recessDates: z.array(z.string()).optional(),
      startDate: z.string().optional(),
    })
    .optional(),
});

// Operação Única Discriminada
export const singlePatchOperationSchema = z.discriminatedUnion('operation', [
  upsertPlanningPatchSchema,
  updateBlockByDatePatchSchema,
  batchUpdateColumnPatchSchema,
  addSpecificationPatchSchema,
  fillMetadataPatchSchema,
  deleteBlockWithGapPatchSchema,
  reorganizeTreePatchSchema,
  resetPlanningPatchSchema,
  readOnlyPatchSchema,
  reallocateLessonsPatchSchema,
]);

// Payload do Patch: Pode ser uma única operação ou uma lista de operações sequenciais
export const planningPatchPayloadSchema = z.union([
  singlePatchOperationSchema,
  z.object({
    operations: z.array(singlePatchOperationSchema).min(1),
  }),
]);

export type PlanningGranularityType = z.infer<typeof planningGranularityEnum>;
export type SpecificationTableRefType = z.infer<typeof specificationTableRefEnum>;
export type PatchMetadataValue = z.infer<typeof patchMetadataValueSchema>;
export type AddSpecificationPatchData = z.infer<typeof addSpecificationPatchDataSchema>;
export type PatchEvaluationItem = z.infer<typeof patchEvaluationItemSchema>;
export type PatchBlockItem = z.infer<typeof patchBlockItemSchema>;
export type SinglePatchOperation = z.infer<typeof singlePatchOperationSchema>;
export type PlanningPatchPayload = z.infer<typeof planningPatchPayloadSchema>;
