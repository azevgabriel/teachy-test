export interface BnccSkill {
	id: string;
	code: string;
	description: string;
}

export interface LearningObjectiveWithSkill {
	id: string;
	planningId?: string | null;
	planningBlockId?: string | null;
	bnccSkillId?: string | null;
	customDescription?: string | null;
	bnccSkill?: BnccSkill | null;
}

export interface Specification {
	id: string;
	sessionId: string;
	tableRef: "PLANNING" | "PLANNING_BLOCK";
	colName: string;
	customLabel?: string | null;
	fieldType?: string | null;
	description?: string | null;
	avgCharLimit?: number | null;
	fontSize?: string | null;
	fontFamily?: string | null;
	isRequired: boolean;
	order?: number;
	isVisible?: boolean;
	showLabel?: boolean;
	createdAt?: string;
	updatedAt?: string;
}

export interface MetadataValueWithSpec {
	id: string;
	specificationId: string;
	planningId?: string | null;
	planningBlockId?: string | null;
	textValue?: string | null;
	jsonbValue?: unknown;
	specification?: Specification | null;
}

export interface Evaluation {
	id: string;
	planningId?: string | null;
	planningBlockId?: string | null;
	name?: string | null;
	instrumentType?: string | null;
	grade?: number | string | null;
	criteria?: string | null;
	description?: string | null;
	startAt?: string | null;
	endAt?: string | null;
}

export interface PlanningBlockWithRelations {
	id: string;
	planningId: string;
	parentId?: string | null;
	granularity?: string | null;
	startAt?: string | null;
	endAt?: string | null;
	order: number;
	metodologia?: string | null;
	children?: PlanningBlockWithRelations[];
	learningObjectives: LearningObjectiveWithSkill[];
	evaluations: Evaluation[];
	metadataValues: MetadataValueWithSpec[];
}

export interface PlanningAggregate {
	id: string;
	sessionId: string;
	schoolId?: string | null;
	school?: { id: string; name: string } | null;
	applicationYearId?: string | null;
	applicationYear?: { id: string; name: string; stage?: string } | null;
	curricularComponents: { id: string; name: string }[];
	startAt?: string | null;
	endAt?: string | null;
	granularity?: string | null;
	learningObjectives: LearningObjectiveWithSkill[];
	evaluations: Evaluation[];
	metadataValues: MetadataValueWithSpec[];
	blocks: PlanningBlockWithRelations[];
}

export interface PlanningResponseDto {
	planning: PlanningAggregate | null;
	specifications: Specification[];
}
