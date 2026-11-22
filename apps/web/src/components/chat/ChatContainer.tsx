import { useNavigate } from "@tanstack/react-router";
import { PanelRight, Sparkles } from "lucide-react";
import * as React from "react";
import { PlanningViewer } from "#/components/planning/PlanningViewer";
import { usePlanningSync } from "#/components/planning/usePlanningSync";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import { ChatInput } from "./ChatInput";
import { ChatTimeline } from "./ChatTimeline";
import { Sidebar } from "./Sidebar";
import type { Message, SessionSummary } from "./types";
import { useChatStream } from "./useChatStream";

interface ChatContainerProps {
	sessionId?: string;
	sessionTitle?: string;
	initialMessages?: Message[];
	pendingFirstMessage?: string;
}

export function ChatContainer({
	sessionId: propSessionId,
	sessionTitle: propSessionTitle,
	initialMessages = [],
	pendingFirstMessage,
}: ChatContainerProps) {
	const navigate = useNavigate();
	const [activeSessionId, setActiveSessionId] = React.useState<
		string | undefined
	>(propSessionId);
	const [activeSessionTitle, setActiveSessionTitle] = React.useState<
		string | undefined
	>(propSessionTitle);
	const [sidebarOpen, setSidebarOpen] = React.useState(false); // Histórico fechado por padrão para dar espaço ao split-view
	const [planningOpen, setPlanningOpen] = React.useState(false); // Pré-visualização fechada por padrão
	const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
	const [inputValue, setInputValue] = React.useState("");
	const firstMessageSentRef = React.useRef<string | null>(null);

	// Atualiza os estados locais se a prop mudar (ao trocar de sessão)
	React.useEffect(() => {
		setActiveSessionId(propSessionId);
		setActiveSessionTitle(propSessionTitle);
	}, [propSessionId, propSessionTitle]);

	// Hook de sincronização em tempo real do planejamento via REST
	const {
		data: planningData,
		isLoading: isPlanningLoading,
		error: planningError,
		refetch: refetchPlanning,
	} = usePlanningSync({ sessionId: activeSessionId });

	// Busca a lista de sessões para a barra lateral de histórico
	const fetchSessions = React.useCallback(async () => {
		try {
			const res = await fetch("/api/sessions");
			if (res.ok) {
				const data = await res.json();
				setSessions(data);
			}
		} catch (err) {
			console.error("Erro ao carregar sessões:", err);
		}
	}, []);

	React.useEffect(() => {
		fetchSessions();
	}, [fetchSessions]);

	const handleSessionCreated = React.useCallback(
		(newSessionId: string) => {
			setActiveSessionId(newSessionId);
			fetchSessions();
			refetchPlanning(newSessionId);
		},
		[fetchSessions, refetchPlanning],
	);

	const handleMessageSaved = React.useCallback(() => {
		fetchSessions();
		if (activeSessionId) {
			refetchPlanning(activeSessionId);
		}
	}, [fetchSessions, activeSessionId, refetchPlanning]);

	const { messages, partialText, isStreaming, error, sendMessage, stopStream } =
		useChatStream({
			initialMessages,
			onSessionCreated: handleSessionCreated,
			onMessageSaved: handleMessageSaved,
		});

	// Se a rota foi acessada com mensagem inicial no query params, inicia o streaming agora que já estamos no contexto da rota /chat/:sessionId
	React.useEffect(() => {
		if (
			pendingFirstMessage &&
			activeSessionId &&
			firstMessageSentRef.current !== pendingFirstMessage
		) {
			firstMessageSentRef.current = pendingFirstMessage;
			sendMessage(activeSessionId ?? null, pendingFirstMessage);
			// Remove o query param da URL sem recarregar a tela
			navigate({
				to: "/chat/$sessionId",
				params: { sessionId: activeSessionId },
				search: {},
				replace: true,
			});
		}
	}, [pendingFirstMessage, activeSessionId, sendMessage, navigate]);

	const handleSend = async (text: string) => {
		// Se estiver na tela inicial (sem sessão criada ainda), cria a sessão primeiro e navega com a mensagem no query param
		if (!activeSessionId) {
			try {
				const createRes = await fetch("/api/sessions", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: text.slice(0, 30) }),
				});

				if (!createRes.ok) {
					throw new Error("Não foi possível criar uma nova sessão.");
				}

				const newSession = await createRes.json();
				// Navega para o contexto da sessão levando a mensagem nos query params
				navigate({
					to: "/chat/$sessionId",
					params: { sessionId: newSession.id },
					search: { message: text },
				});
				return;
			} catch (err) {
				console.error("Erro ao criar sessão inicial:", err);
			}
		}

		if (!activeSessionTitle) {
			setActiveSessionTitle(text.slice(0, 30));
		}
		sendMessage(activeSessionId ?? null, text);
	};

	const handleCopyMessage = React.useCallback((text: string) => {
		setInputValue(text);
	}, []);

	const handleSelectSession = (id: string) => {
		navigate({ to: "/chat/$sessionId", params: { sessionId: id } });
	};

	const handleNewChat = () => {
		navigate({ to: "/" });
	};

	const handleRenameSession = React.useCallback(
		async (id: string, newName: string) => {
			try {
				const res = await fetch(`/api/sessions/${id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: newName }),
				});
				if (res.ok) {
					if (id === activeSessionId) {
						setActiveSessionTitle(newName);
					}
					await fetchSessions();
				}
			} catch (err) {
				console.error("Erro ao renomear sessão:", err);
			}
		},
		[activeSessionId, fetchSessions],
	);

	const handleDeleteSession = React.useCallback(
		async (id: string) => {
			try {
				const res = await fetch(`/api/sessions/${id}`, {
					method: "DELETE",
				});
				if (res.ok) {
					await fetchSessions();
					if (id === activeSessionId) {
						navigate({ to: "/" });
					}
				}
			} catch (err) {
				console.error("Erro ao excluir sessão:", err);
			}
		},
		[activeSessionId, fetchSessions, navigate],
	);

	return (
		<div className="flex h-screen w-full overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
			{/* Área Esquerda: Pré-visualização do Planejamento no Formato A4 */}
			<PlanningViewer
				sessionId={activeSessionId}
				data={planningData}
				isLoading={isPlanningLoading}
				error={planningError}
				isOpen={planningOpen}
				onToggle={() => setPlanningOpen((prev) => !prev)}
				onRefresh={() => refetchPlanning()}
			/>

			{/* Área Central / Direita: Chat com Assistente */}
			<main
				className={cn(
					"flex flex-col h-full min-w-0 transition-all duration-300",
					planningOpen
						? "w-full md:w-1/2 lg:w-[48%] xl:w-[44%] shrink-0"
						: "w-full flex-1",
				)}
			>
				{/* Top Bar do Chat */}
				<header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xs shrink-0">
					<div className="flex items-center gap-2 truncate">
						<div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
							T
						</div>
						<div className="truncate">
							<h1 className="text-sm font-semibold truncate">
								{activeSessionTitle || "Nova Conversa com IA"}
							</h1>
							<p className="text-[11px] text-slate-400">
								{activeSessionId
									? "Janela de contexto ativa"
									: "Inicie uma nova sessão"}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-1.5">
						{!sidebarOpen && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setSidebarOpen(true)}
								className="gap-1.5 text-xs h-8 text-slate-600 dark:text-slate-300"
							>
								<PanelRight className="h-4 w-4" />
								<span>Histórico</span>
							</Button>
						)}
					</div>
				</header>

				{/* Erro Banner se houver */}
				{error && (
					<div className="bg-red-50 dark:bg-red-950/50 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs px-4 py-2 flex items-center justify-between">
						<span>{error}</span>
					</div>
				)}

				{/* Timeline ou Estado Inicial Vazio */}
				{messages.length === 0 && !isStreaming ? (
					<div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50/50 dark:bg-slate-950/20">
						<div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm border border-emerald-200 dark:border-emerald-800">
							<Sparkles className="h-7 w-7" />
						</div>
						<h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
							Vamos estruturar seu Planejamento Escolar?
						</h2>
						<p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
							Indique a granularidade (semanal, mensal, trimestral ou
							semestral), o componente curricular, o ano escolar e as
							habilidades que deseja trabalhar.
						</p>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg w-full text-left">
							{[
								"Criar planejamento semanal de Língua Portuguesa para o 3º ano",
								"Construir um planejamento trimestral de Matemática dividido mensalmente",
								"Quero trabalhar habilidades específicas no meu planejamento dessa semana de Ciências",
								"Criar planejamento semestral de História organizado por semanas para a 2ª série",
							].map((prompt) => (
								<button
									key={prompt}
									type="button"
									onClick={() => handleSend(prompt)}
									className="p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-700 hover:shadow-xs transition-all text-slate-700 dark:text-slate-300 cursor-pointer"
								>
									{prompt}
								</button>
							))}
						</div>
					</div>
				) : (
					<ChatTimeline
						messages={messages}
						partialText={partialText}
						isStreaming={isStreaming}
						onCopyMessage={handleCopyMessage}
					/>
				)}

				{/* Input Bar com alternância Send/Stop */}
				<ChatInput
					isStreaming={isStreaming}
					value={inputValue}
					onValueChange={setInputValue}
					onSend={handleSend}
					onStop={stopStream}
				/>
			</main>

			{/* Barra Lateral de Histórico de Conversas Retrátil */}
			<Sidebar
				isOpen={sidebarOpen}
				onToggle={() => setSidebarOpen((prev) => !prev)}
				sessions={sessions}
				activeSessionId={activeSessionId}
				onSelectSession={handleSelectSession}
				onNewChat={handleNewChat}
				onRenameSession={handleRenameSession}
				onDeleteSession={handleDeleteSession}
			/>
		</div>
	);
}
