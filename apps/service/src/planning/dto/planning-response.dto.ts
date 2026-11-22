import type {
  Planning,
  PlanningBlock,
  Specification,
  PlanningMetadataValue,
  LearningObjective,
  Evaluation,
  School,
  ApplicationYear,
  CurricularComponent,
  BnccSkill,
} from '@prisma/client';

export type LearningObjectiveWithSkill = LearningObjective & {
  bnccSkill?: BnccSkill | null;
};

export type MetadataValueWithSpec = PlanningMetadataValue & {
  specification?: Specification | null;
};

export type PlanningBlockWithRelations = PlanningBlock & {
  children?: PlanningBlockWithRelations[];
  learningObjectives: LearningObjectiveWithSkill[];
  evaluations: Evaluation[];
  metadataValues: MetadataValueWithSpec[];
};

export type PlanningAggregate = Planning & {
  school?: School | null;
  applicationYear?: ApplicationYear | null;
  curricularComponents: CurricularComponent[];
  learningObjectives: LearningObjectiveWithSkill[];
  evaluations: Evaluation[];
  metadataValues: MetadataValueWithSpec[];
  blocks: PlanningBlockWithRelations[];
};

export interface PlanningResponseDto {
  planning: PlanningAggregate | null;
  specifications: Specification[];
}
