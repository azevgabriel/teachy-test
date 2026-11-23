import type { PlanningGranularity } from '@prisma/client';

export interface ColumnDefinition {
  name: string;
  customLabel: string;
  isCore: boolean;
  targetTable: 'PLANNING' | 'PLANNING_BLOCK';
  order: number;
  sampleToneText?: string;
  detectedAvgCharLimit?: number;
}

export interface RawLessonBlock {
  date?: string;
  order?: number;
  metodologia?: string;
  contentByColumn: Record<string, string>;
}

export interface ExtractedEvaluation {
  name?: string;
  instrumentType?: string;
  grade?: number | string;
  criteria?: string;
  description?: string;
  startAt?: string;
  endAt?: string;
}

export interface LayoutExtraction {
  suggestedGranularity?: PlanningGranularity;
  hierarchyLevels: PlanningGranularity[];
  columns: ColumnDefinition[];
}

export interface DataExtraction {
  curricularComponent?: string;
  applicationYear?: string;
  dates?: {
    startAt?: string;
    endAt?: string;
  };
  rawLessonBlocks: RawLessonBlock[];
  bnccCodesFound: string[];
  evaluationsFound: ExtractedEvaluation[];
}

export interface ExtractedSchoolReference {
  layout: LayoutExtraction;
  data: DataExtraction;
  rawText: string;
}

export interface ExtractorInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}
