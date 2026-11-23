export interface Message {
	id: string;
	sessionId: string;
	text: string;
	type: "USER" | "IA";
	interrupted: boolean;
	createdAt: string;
}

export interface SessionPlanningMetadata {
	id: string;
	granularity?:
		| "ANNUAL"
		| "SEMESTER"
		| "TRIMESTER"
		| "BIMONTHLY"
		| "MONTHLY"
		| "WEEKLY"
		| "DAILY"
		| "CUSTOM"
		| string
		| null;
	startAt?: string | null;
	endAt?: string | null;
	applicationYear?: {
		id: string;
		name: string;
		stage?: string | null;
	} | null;
	curricularComponents?: Array<{
		id: string;
		name: string;
	}>;
}

export interface SessionSummary {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
	_count?: { conversations: number };
	planning?: SessionPlanningMetadata | null;
}

export interface SessionDetail extends SessionSummary {
	conversations: Message[];
}
