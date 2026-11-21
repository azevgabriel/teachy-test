export interface Message {
	id: string;
	sessionId: string;
	text: string;
	type: "USER" | "IA";
	interrupted: boolean;
	createdAt: string;
}

export interface SessionSummary {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
	_count?: { conversations: number };
}

export interface SessionDetail extends SessionSummary {
	conversations: Message[];
}
