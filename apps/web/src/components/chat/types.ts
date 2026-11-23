export interface MessageAttachment {
	id?: string;
	name: string;
	size?: number;
	mimeType?: string;
	url?: string;
}

export interface PendingAttachment {
	file?: File;
	documentId?: string;
	name: string;
	size: number;
	mimeType: string;
	previewUrl?: string;
}

export interface ReferenceDocumentItem {
	id: string;
	originalName: string;
	storedFileName?: string;
	mimeType: string;
	fileSize: number;
	createdAt: string;
	updatedAt?: string;
	url?: string;
	isLinkedToSession?: boolean;
}

export const ALLOWED_FILE_TYPES = [
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"image/png",
	"image/jpeg",
	"image/webp",
];

export const ALLOWED_EXTENSIONS = [
	".pdf",
	".docx",
	".png",
	".jpg",
	".jpeg",
	".webp",
];

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export function validateUploadFile(file: File): {
	valid: boolean;
	error?: string;
} {
	const ext = `.${(file.name.split(".").pop() || "").toLowerCase()}`;
	const isMimeAllowed = ALLOWED_FILE_TYPES.includes(file.type);
	const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);

	if (!isMimeAllowed && !isExtAllowed) {
		return {
			valid: false,
			error:
				"Formato inválido. Por favor, envie arquivos PDF, DOCX, PNG, JPEG ou WebP.",
		};
	}

	if (file.size > MAX_FILE_SIZE) {
		return {
			valid: false,
			error: "O arquivo excede o limite máximo permitido de 20MB.",
		};
	}

	return { valid: true };
}

export function formatFileSize(bytes?: number): string {
	if (!bytes || bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const formatted = (bytes / 1024 ** i)
		.toFixed(i === 0 ? 0 : 1)
		.replace(/\.0$/, "");
	return `${formatted} ${units[i]}`;
}

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
	attachment?: MessageAttachment;
}

export interface Message {
	id: string;
	sessionId: string;
	text: string;
	type: "USER" | "IA";
	interrupted: boolean;
	createdAt: string;
	commands?: PlanningCommandsPayload | PlanningCommand | null;
	attachment?: MessageAttachment | null;
}

export function getMessageAttachment(
	message: Message,
): MessageAttachment | null {
	if (message.attachment) {
		return message.attachment;
	}
	if (message.commands && typeof message.commands === "object") {
		const cmds = message.commands as { attachment?: MessageAttachment };
		if (cmds.attachment) {
			return cmds.attachment;
		}
	}
	return null;
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
