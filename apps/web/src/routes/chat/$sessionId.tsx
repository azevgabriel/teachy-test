import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { z } from "zod";
import { ChatContainer } from "#/components/chat/ChatContainer";
import type { SessionDetail } from "#/components/chat/types";
import { Button } from "#/components/ui/button";

const chatSearchSchema = z.object({
	message: z.string().optional(),
});

export const Route = createFileRoute("/chat/$sessionId")({
	validateSearch: (search) => chatSearchSchema.parse(search),
	loader: async ({ params: { sessionId } }): Promise<SessionDetail> => {
		const res = await fetch(`/api/sessions/${sessionId}`);
		if (!res.ok) {
			throw new Error("Não foi possível carregar a sessão solicitada.");
		}
		return res.json();
	},
	pendingComponent: ChatLoadingSkeleton,
	errorComponent: ChatErrorView,
	component: ChatSessionPage,
});

function ChatSessionPage() {
	const session = Route.useLoaderData();
	const { message } = Route.useSearch();

	return (
		<ChatContainer
			sessionId={session.id}
			sessionTitle={session.name}
			initialMessages={session.conversations}
			pendingFirstMessage={message}
		/>
	);
}

function ChatLoadingSkeleton() {
	return (
		<div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
			<div className="flex flex-col items-center gap-3">
				<div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
				<p className="text-sm text-slate-500">Carregando conversa...</p>
			</div>
		</div>
	);
}

function ChatErrorView({ error }: { error: Error }) {
	return (
		<div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
			<div className="max-w-md w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-2xl p-6 shadow-sm text-center flex flex-col items-center">
				<div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-3">
					<AlertCircle className="h-6 w-6" />
				</div>
				<h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
					Ops, algo deu errado
				</h2>
				<p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
					{error.message || "Não foi possível carregar a sessão informada."}
				</p>
				<Button
					onClick={() => {
						window.location.href = "/";
					}}
					variant="default"
				>
					Voltar para Nova Conversa
				</Button>
			</div>
		</div>
	);
}
