import { useNavigate } from "@tanstack/react-router";
import {
	Calendar,
	FolderOpen,
	PanelRight,
	Paperclip,
	Sparkles,
	UploadCloud,
	X,
} from "lucide-react";
import * as React from "react";
import { formatGranularity } from "#/components/planning/PlanningHeader";
import { PlanningViewer } from "#/components/planning/PlanningViewer";
import { usePlanningSync } from "#/components/planning/usePlanningSync";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import { ChatInput } from "./ChatInput";
import { ChatTimeline } from "./ChatTimeline";
import { ReferenceDocumentsDrawer } from "./ReferenceDocumentsDrawer";
import { Sidebar } from "./Sidebar";
import {
	type Message,
	type PendingAttachment,
	type ReferenceDocumentItem,
	type SessionSummary,
	validateUploadFile,
} from "./types";
import { useChatStream } from "./useChatStream";

function formatPlanningDateRange(
	startAt?: string | null,
	endAt?: string | null,
): string {
	if (!startAt && !endAt) return "";
	try {
		const formatSingle = (str: string) => {
			const safeStr = str.includes("T") ? str : `${str}T12:00:00Z`;
			const d = new Date(safeStr);
			return d.toLocaleDateString("pt-BR", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
				timeZone: "UTC",
			});
		};

		if (startAt && endAt) {
			return `${formatSingle(startAt)} a ${formatSingle(endAt)}`;
		}
		if (startAt) {
			return `A partir de ${formatSingle(startAt)}`;
		}
		if (endAt) {
			return `Até ${formatSingle(endAt)}`;
		}
	} catch {
		return "";
	}
	return "";
}

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
	const [isDraggingOver, setIsDraggingOver] = React.useState(false);
	const [pendingAttachment, setPendingAttachment] =
		React.useState<PendingAttachment | null>(null);
	const [savedDocumentsOpen, setSavedDocumentsOpen] = React.useState(false);
	const [uploadError, setUploadError] = React.useState<string | null>(null);
	const [activeLinkedDocuments, setActiveLinkedDocuments] = React.useState<
		ReferenceDocumentItem[]
	>([]);
	const dragCounterRef = React.useRef(0);
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

	const fetchSessionDocuments = React.useCallback(async (sId: string) => {
		try {
			const res = await fetch(
				`/api/sessions/${encodeURIComponent(sId)}/documents`,
			);
			if (res.ok) {
				const data: ReferenceDocumentItem[] = await res.json();
				setActiveLinkedDocuments(data);
			}
		} catch (err) {
			console.error("Erro ao carregar documentos vinculados:", err);
		}
	}, []);

	React.useEffect(() => {
		if (activeSessionId) {
			fetchSessionDocuments(activeSessionId);
		} else {
			setActiveLinkedDocuments([]);
		}
	}, [activeSessionId, fetchSessionDocuments]);

	const handleDocumentLinked = React.useCallback(
		(doc: ReferenceDocumentItem) => {
			setActiveLinkedDocuments((prev) => {
				if (prev.some((d) => d.id === doc.id)) return prev;
				return [...prev, doc];
			});
			if (activeSessionId) {
				fetchSessionDocuments(activeSessionId);
			}
		},
		[activeSessionId, fetchSessionDocuments],
	);

	const handleDocumentUnlinked = React.useCallback(
		(docId: string) => {
			setActiveLinkedDocuments((prev) => prev.filter((d) => d.id !== docId));
			if (activeSessionId) {
				fetchSessionDocuments(activeSessionId);
			}
		},
		[activeSessionId, fetchSessionDocuments],
	);

	const handleDocumentDeleted = React.useCallback(
		(docId: string) => {
			setActiveLinkedDocuments((prev) => prev.filter((d) => d.id !== docId));
			if (activeSessionId) {
				fetchSessionDocuments(activeSessionId);
			}
		},
		[activeSessionId, fetchSessionDocuments],
	);

	// Busca a lista de sessões para a barra lateral de histórico
	const fetchSessions = React.useCallback(async () => {
		try {
			const res = await fetch("/api/sessions");
			if (res.ok) {
				const data: SessionSummary[] = await res.json();
				setSessions(data);
				if (activeSessionId) {
					const current = data.find((s) => s.id === activeSessionId);
					if (current?.name) {
						setActiveSessionTitle(current.name);
					}
				}
			}
		} catch (err) {
			console.error("Erro ao carregar sessões:", err);
		}
	}, [activeSessionId]);

	React.useEffect(() => {
		fetchSessions();
	}, [fetchSessions]);

	const handleSessionCreated = React.useCallback(
		(newSessionId: string) => {
			setActiveSessionId(newSessionId);
			fetchSessions();
			refetchPlanning(newSessionId);
			fetchSessionDocuments(newSessionId);
		},
		[fetchSessions, refetchPlanning, fetchSessionDocuments],
	);

	const handleMessageSaved = React.useCallback(() => {
		fetchSessions();
		if (activeSessionId) {
			refetchPlanning(activeSessionId);
			fetchSessionDocuments(activeSessionId);
		}
	}, [fetchSessions, activeSessionId, refetchPlanning, fetchSessionDocuments]);

	const { messages, partialText, isStreaming, error, sendMessage, stopStream } =
		useChatStream({
			initialMessages,
			onSessionCreated: handleSessionCreated,
			onMessageSaved: handleMessageSaved,
			onAttachmentLinked: (sId) => fetchSessionDocuments(sId),
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

	const handleSend = async (text: string, attachment?: PendingAttachment) => {
		// Se estiver na tela inicial (sem sessão criada ainda), cria a sessão primeiro
		if (!activeSessionId) {
			try {
				const sessionName =
					text.trim().slice(0, 30) ||
					(attachment ? attachment.name.slice(0, 30) : "Nova Conversa");
				const createRes = await fetch("/api/sessions", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: sessionName }),
				});

				if (!createRes.ok) {
					throw new Error("Não foi possível criar uma nova sessão.");
				}

				const newSession = await createRes.json();
				setActiveSessionId(newSession.id);
				setActiveSessionTitle(newSession.name);

				// Se há anexo ou mensagem, envia na nova sessão criada
				await sendMessage(newSession.id, text, attachment);
				navigate({
					to: "/chat/$sessionId",
					params: { sessionId: newSession.id },
					search: {},
					replace: true,
				});
				return;
			} catch (err) {
				console.error("Erro ao criar sessão inicial:", err);
			}
		}

		if (!activeSessionTitle) {
			setActiveSessionTitle("Nova Conversa");
		}
		sendMessage(activeSessionId ?? null, text, attachment);
		if (attachment && activeSessionId) {
			fetchSessionDocuments(activeSessionId);
		}
	};

	const handleDragEnter = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current += 1;
		if (
			e.dataTransfer.types &&
			Array.from(e.dataTransfer.types).includes("Files")
		) {
			setIsDraggingOver(true);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		e.dataTransfer.dropEffect = "copy";
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current -= 1;
		if (dragCounterRef.current <= 0) {
			dragCounterRef.current = 0;
			setIsDraggingOver(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current = 0;
		setIsDraggingOver(false);

		const files = Array.from(e.dataTransfer.files);
		if (files.length === 0) return;

		const file = files[0];
		const validation = validateUploadFile(file);
		if (!validation.valid) {
			setUploadError(validation.error || "Arquivo inválido");
			return;
		}

		setUploadError(null);
		setPendingAttachment({
			file,
			name: file.name,
			size: file.size,
			mimeType: file.type || "application/octet-stream",
			previewUrl: file.type.startsWith("image/")
				? URL.createObjectURL(file)
				: undefined,
		});
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

	const activePlanning = planningData?.planning;
	const hasActivePlanning = Boolean(
		activePlanning &&
			((activePlanning.curricularComponents &&
				activePlanning.curricularComponents.length > 0) ||
				activePlanning.applicationYear ||
				activePlanning.granularity),
	);

	const activeDateRange = formatPlanningDateRange(
		activePlanning?.startAt,
		activePlanning?.endAt,
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
				onDragEnter={handleDragEnter}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				className={cn(
					"relative flex flex-col h-full min-w-0 transition-all duration-300",
					planningOpen
						? "w-full md:w-1/2 lg:w-[48%] xl:w-[44%] shrink-0"
						: "w-full flex-1",
				)}
			>
				{/* Dropzone Visual Overlay quando arrasta arquivo sobre o chat */}
				{isDraggingOver && (
					<div
						data-testid="dropzone-overlay"
						className="absolute inset-4 z-50 flex flex-col items-center justify-center bg-emerald-50/95 dark:bg-slate-900/95 border-3 border-dashed border-emerald-500 dark:border-emerald-400 rounded-2xl shadow-2xl pointer-events-none transition-all animate-in fade-in zoom-in-95"
					>
						<div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-inner">
							<UploadCloud className="h-8 w-8 animate-bounce" />
						</div>
						<h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
							Solte o arquivo para anexar à conversa
						</h3>
						<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
							Formatos suportados: PDF, DOCX, PNG, JPEG, WebP (até 20MB)
						</p>
					</div>
				)}

				{/* Top Bar do Chat */}
				<header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xs shrink-0">
					<div className="flex items-center gap-2.5 truncate">
						<div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
							T
						</div>
						<div className="flex flex-col min-w-0">
							<h1 className="text-sm font-semibold truncate">
								{activeSessionTitle || "Nova Conversa com IA"}
							</h1>
							{hasActivePlanning ? (
								<div className="flex flex-wrap items-center gap-1.5 mt-0.5">
									{activePlanning?.curricularComponents?.map((comp) => (
										<Badge
											key={comp.id}
											variant="default"
											title={comp.name}
											className="text-[10px] h-4.5 px-1.5 py-0 font-medium max-w-[130px] min-w-0"
										>
											<span className="truncate">{comp.name}</span>
										</Badge>
									))}
									{activePlanning?.applicationYear && (
										<Badge
											variant="outline"
											title={activePlanning.applicationYear.name}
											className="text-[10px] h-4.5 px-1.5 py-0 font-medium text-slate-700 dark:text-slate-300 max-w-[130px] min-w-0"
										>
											<span className="truncate">
												{activePlanning.applicationYear.name}
											</span>
										</Badge>
									)}
									{activePlanning?.granularity && (
										<Badge
											variant="secondary"
											title={formatGranularity(activePlanning.granularity)}
											className="text-[10px] h-4.5 px-1.5 py-0 font-medium max-w-[130px] min-w-0"
										>
											<span className="truncate">
												{formatGranularity(activePlanning.granularity)}
											</span>
										</Badge>
									)}
									{activeDateRange && (
										<div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
											<Calendar className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
											<span>{activeDateRange}</span>
										</div>
									)}
									{activeLinkedDocuments.length > 0 && (
										<button
											type="button"
											onClick={() => setSavedDocumentsOpen(true)}
											data-testid="header-active-documents-badge"
											className="flex items-center gap-1 text-[10px] h-4.5 px-2 py-0 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
											title="Documentos de referência vinculados a esta sessão. Clique para gerenciar."
										>
											<Paperclip className="h-2.5 w-2.5 shrink-0" />
											<span className="font-medium">
												{activeLinkedDocuments.length}{" "}
												{activeLinkedDocuments.length === 1
													? "documento de apoio"
													: "documentos de apoio"}
											</span>
										</button>
									)}
								</div>
							) : (
								<div className="flex items-center gap-2 mt-0.5">
									<p className="text-[11px] text-slate-400">
										{activeSessionId
											? "Janela de contexto ativa • Em definição"
											: "Inicie uma nova sessão"}
									</p>
									{activeLinkedDocuments.length > 0 && (
										<button
											type="button"
											onClick={() => setSavedDocumentsOpen(true)}
											data-testid="header-active-documents-badge"
											className="flex items-center gap-1 text-[10px] h-4.5 px-2 py-0 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
											title="Documentos de referência vinculados a esta sessão. Clique para gerenciar."
										>
											<Paperclip className="h-2.5 w-2.5 shrink-0" />
											<span className="font-medium">
												{activeLinkedDocuments.length}{" "}
												{activeLinkedDocuments.length === 1
													? "documento de apoio"
													: "documentos de apoio"}
											</span>
										</button>
									)}
								</div>
							)}
						</div>
					</div>

					<div className="flex items-center gap-1.5">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setSavedDocumentsOpen(true)}
							data-testid="header-materials-button"
							title="Documentos de referência e materiais de apoio"
							className="gap-1.5 text-xs h-8 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400"
						>
							<FolderOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
							<span className="hidden sm:inline">Materiais</span>
							<Badge
								variant="secondary"
								data-testid="header-materials-count-badge"
								className={cn(
									"ml-0.5 px-1.5 py-0 text-[10px] h-4",
									activeLinkedDocuments.length > 0
										? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold"
										: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-normal",
								)}
							>
								{activeLinkedDocuments.length}
							</Badge>
						</Button>
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

				{/* Notificação de Erro de Upload */}
				{uploadError && (
					<div className="bg-red-50 dark:bg-red-950/50 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs px-4 py-2 flex items-center justify-between animate-in fade-in">
						<span>{uploadError}</span>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => setUploadError(null)}
							className="h-5 w-5 text-red-500 hover:text-red-700 hover:bg-transparent"
						>
							<X className="h-3 w-3" />
						</Button>
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
						sessionId={activeSessionId}
						hasBlocks={
							isPlanningLoading
								? true
								: (activePlanning?.blocks?.length ?? 0) > 0
						}
					/>
				)}

				{/* Input Bar com alternância Send/Stop */}
				<ChatInput
					isStreaming={isStreaming}
					value={inputValue}
					onValueChange={setInputValue}
					onSend={handleSend}
					onStop={stopStream}
					pendingAttachment={pendingAttachment}
					onPendingAttachmentChange={setPendingAttachment}
					onOpenSavedDocuments={() => setSavedDocumentsOpen(true)}
					onError={(msg) => setUploadError(msg)}
				/>
			</main>

			{/* Modal / Drawer de Documentos Salvos */}
			<ReferenceDocumentsDrawer
				isOpen={savedDocumentsOpen}
				onClose={() => {
					setSavedDocumentsOpen(false);
					if (activeSessionId) {
						fetchSessionDocuments(activeSessionId);
					}
				}}
				sessionId={activeSessionId}
				onSelectDocument={(doc) => {
					setPendingAttachment({
						documentId: doc.id,
						name: doc.originalName,
						size: doc.fileSize,
						mimeType: doc.mimeType,
					});
				}}
				onDocumentLinked={handleDocumentLinked}
				onDocumentUnlinked={handleDocumentUnlinked}
				onDocumentDeleted={handleDocumentDeleted}
			/>

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
				onOpenDocumentsDrawer={() => setSavedDocumentsOpen(true)}
			/>
		</div>
	);
}
