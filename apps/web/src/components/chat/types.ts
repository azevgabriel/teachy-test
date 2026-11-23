export interface ExportPlanningCommandData {
	format: "pdf" | "docx";
	orientation: "portrait" | "landscape";
}

export interface ExportPlanningCommand {
	operation: "EXPORT_PLANNING";
	data: ExportPlanningCommandData;
}

export type PlanningCommand =
	| ExportPlanningCommand
	| { operation: string; data?: unknown };

export interface PlanningCommandsPayload {
	operation?: string;
	data?: unknown;
	operations?: PlanningCommand[];
}

export interface Message {
	id: string;
	sessionId: string;
	text: string;
	type: "USER" | "IA";
	interrupted: boolean;
	createdAt: string;
	commands?: PlanningCommandsPayload | PlanningCommand | null;
}

export function getExportPlanningCommands(
	commands: unknown,
): ExportPlanningCommandData[] {
	if (!commands || typeof commands !== "object") {
		return [];
	}

	const cmds = commands as {
		operation?: string;
		data?: { format?: string; orientation?: string };
		operations?: Array<{
			operation?: string;
			data?: { format?: string; orientation?: string };
		}>;
	};

	const results: ExportPlanningCommandData[] = [];

	if (cmds.operation === "EXPORT_PLANNING") {
		results.push({
			format: cmds.data?.format === "docx" ? "docx" : "pdf",
			orientation:
				cmds.data?.orientation === "landscape" ? "landscape" : "portrait",
		});
	}

	if (Array.isArray(cmds.operations)) {
		for (const op of cmds.operations) {
			if (op.operation === "EXPORT_PLANNING") {
				results.push({
					format: op.data?.format === "docx" ? "docx" : "pdf",
					orientation:
						op.data?.orientation === "landscape" ? "landscape" : "portrait",
				});
			}
		}
	}

	return results;
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
