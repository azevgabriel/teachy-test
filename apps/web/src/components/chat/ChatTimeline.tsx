import { Bot, Copy, Download, User } from "lucide-react";
import * as React from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { cn } from "#/lib/utils";
import { getAttachmentTypeIcon } from "./ChatInput";
import { ExportActionCard } from "./ExportActionCard";
import { MarkdownRenderer } from "./MarkdownRenderer";
import {
	formatFileSize,
	getExportPlanningCommands,
	getMessageAttachment,
	type Message,
} from "./types";

interface ChatTimelineProps {
	messages: Message[];
	partialText?: string;
	isStreaming?: boolean;
	onCopyMessage?: (text: string) => void;
	sessionId?: string;
	hasBlocks?: boolean;
}

function formatTime(dateString: string): string {
	try {
		const date = new Date(dateString);
		return date.toLocaleTimeString("pt-BR", {
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "";
	}
}

function formatDateHeader(dateString: string): string {
	try {
		const date = new Date(dateString);
		const today = new Date();
		const yesterday = new Date();
		yesterday.setDate(today.getDate() - 1);

		if (date.toDateString() === today.toDateString()) {
			return "Hoje";
		}
		if (date.toDateString() === yesterday.toDateString()) {
			return "Ontem";
		}

		return date.toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "long",
			year: "numeric",
		});
	} catch {
		return "Conversa";
	}
}

interface GroupedMessages {
	dateKey: string;
	formattedDate: string;
	items: Message[];
}

function groupMessagesByDate(messages: Message[]): GroupedMessages[] {
	const groups: Record<string, GroupedMessages> = {};

	// Ordena cronologicamente por createdAt ascendente
	const sorted = [...messages].sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
	);

	for (const msg of sorted) {
		const date = new Date(msg.createdAt);
		const dateKey = date.toISOString().split("T")[0];

		if (!groups[dateKey]) {
			groups[dateKey] = {
				dateKey,
				formattedDate: formatDateHeader(msg.createdAt),
				items: [],
			};
		}

		groups[dateKey].items.push(msg);
	}

	return Object.values(groups);
}

export const COMPREHENSION_LOADING_STEPS = [
	"Pensando na proposta pedagógica...",
	"Carregando informações já estabelecidas...",
	"Validando regras e habilidades da BNCC...",
	"Consultando materiais de apoio e referências...",
	"Alinhando componentes curriculares e objetivos...",
	"Organizando a abordagem didática da aula...",
];

export const APPLICATION_LOADING_STEPS = [
	"Aplicando mudanças estruturais ao planejamento...",
	"Atualizando seções, blocos e atividades didáticas...",
	"Sincronizando modificações com o banco de dados...",
	"Ajustando cronograma e distribuição pedagógica...",
	"Consolidando e salvando alterações no planejamento...",
];

export function ChatTimeline({
	messages,
	partialText = "",
	isStreaming = false,
	onCopyMessage,
	sessionId,
	hasBlocks = true,
}: ChatTimelineProps) {
	const scrollAnchorRef = React.useRef<HTMLDivElement>(null);
	const containerRef = React.useRef<HTMLDivElement>(null);
	const [comprehensionStepIndex, setComprehensionStepIndex] = React.useState(0);
	const [applicationStepIndex, setApplicationStepIndex] = React.useState(0);

	const isApplicationPhase = Boolean(partialText);

	// Ciclo interativo das etapas pedagógicas de carregamento (compreensão vs aplicação)
	React.useEffect(() => {
		if (!isStreaming) {
			setComprehensionStepIndex(0);
			setApplicationStepIndex(0);
			return;
		}

		if (!isApplicationPhase) {
			setApplicationStepIndex(0);
			const interval = setInterval(() => {
				setComprehensionStepIndex(
					(prev) => (prev + 1) % COMPREHENSION_LOADING_STEPS.length,
				);
			}, 2600);

			return () => clearInterval(interval);
		}

		// Fase de aplicação estrutural (quando partialText já possui conteúdo)
		const interval = setInterval(() => {
			setApplicationStepIndex(
				(prev) => (prev + 1) % APPLICATION_LOADING_STEPS.length,
			);
		}, 2600);

		return () => clearInterval(interval);
	}, [isStreaming, isApplicationPhase]);

	// Agrupa mensagens cronologicamente por dia para montar a linha do tempo
	const groupedMessages = React.useMemo(
		() => groupMessagesByDate(messages),
		[messages],
	);

	// Identifica mensagens de usuário cujo comando foi interrompido (flag própria ou resposta subsequente interrompida)
	const interruptedUserMessageIds = React.useMemo(() => {
		const sorted = [...messages].sort(
			(a, b) =>
				new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		);
		const ids = new Set<string>();
		for (let i = 0; i < sorted.length; i++) {
			const msg = sorted[i];
			if (msg.type === "USER") {
				if (msg.interrupted) {
					ids.add(msg.id);
				} else {
					const nextMsg = sorted[i + 1];
					if (nextMsg && nextMsg.type === "IA" && nextMsg.interrupted) {
						ids.add(msg.id);
					}
				}
			}
		}
		return ids;
	}, [messages]);

	// Rolagem automática para o final da conversa quando novas mensagens ou chunks chegam
	React.useEffect(() => {
		if (messages.length > 0 || partialText || isStreaming) {
			scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages.length, partialText, isStreaming]);

	return (
		<ScrollArea
			ref={containerRef}
			className="flex-1 p-4 md:p-6 bg-slate-100/70 dark:bg-slate-950/40"
		>
			<div className="max-w-3xl mx-auto flex flex-col gap-6">
				{groupedMessages.map((group) => (
					<div key={group.dateKey} className="flex flex-col gap-3">
						{/* Separador de Data da Linha do Tempo */}
						<div className="flex items-center justify-center my-2">
							<span className="bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-3 py-1 rounded-full font-medium shadow-xs border border-slate-300/40 dark:border-slate-700">
								{group.formattedDate}
							</span>
						</div>

						{/* Mensagens do Dia */}
						{group.items.map((message) => {
							const isUser = message.type === "USER";
							const isUserInterrupted =
								isUser &&
								(message.interrupted ||
									interruptedUserMessageIds.has(message.id));

							const isFallbackInterruptedText =
								!isUser &&
								message.text.trim() === "(Resposta interrompida pelo usuário)";

							// Risco no texto:
							// - Comando do usuário interrompido: riscado
							// - Resposta parcial da IA interrompida: riscado
							// - Fallback informativo "(Resposta interrompida pelo usuário)": NÃO riscado
							const shouldStrikeThrough = isUser
								? isUserInterrupted
								: message.interrupted && !isFallbackInterruptedText;

							const exportCommands =
								!isUser && message.commands
									? getExportPlanningCommands(message.commands)
									: [];

							const attachment = getMessageAttachment(message);

							return (
								<div
									key={message.id}
									className={cn(
										"flex items-end gap-2 w-full",
										isUser ? "justify-end" : "justify-start",
									)}
								>
									{!isUser && (
										<div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0 mb-1">
											<Bot className="h-4 w-4" />
										</div>
									)}

									<div
										className={cn(
											"relative max-w-[85%] md:max-w-[70%] px-4 py-2.5 shadow-xs transition-all",
											isUser
												? "bg-emerald-600 text-white rounded-2xl rounded-tr-xs"
												: "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl rounded-tl-xs border border-slate-200 dark:border-slate-800",
											message.interrupted &&
												!isUser &&
												"border-amber-300 dark:border-amber-700/60",
											isUserInterrupted &&
												"border border-amber-300/40 dark:border-amber-600/40",
										)}
									>
										{/* Card de anexo enviado pelo usuário */}
										{attachment && (
											<div
												data-testid="message-attachment-card"
												className="flex items-center justify-between gap-3 p-2.5 px-3 rounded-xl bg-emerald-700/80 border border-emerald-500/40 text-white mb-2 shadow-xs"
											>
												<div className="flex items-center gap-2.5 min-w-0">
													<div className="h-8 w-8 rounded-lg bg-emerald-800/80 flex items-center justify-center text-white shrink-0 shadow-xs">
														{getAttachmentTypeIcon(
															attachment.mimeType || "",
															attachment.name,
														)}
													</div>
													<div className="flex flex-col min-w-0">
														<span className="font-semibold text-xs truncate max-w-[170px] sm:max-w-xs md:max-w-sm text-white">
															{attachment.name}
														</span>
														{attachment.size ? (
															<span className="text-[10px] text-emerald-200">
																{formatFileSize(attachment.size)}
															</span>
														) : null}
													</div>
												</div>
												{attachment.url && (
													<a
														href={attachment.url}
														target="_blank"
														rel="noopener noreferrer"
														download={attachment.name}
														className="h-6 w-6 rounded-md bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shrink-0 transition-colors"
														title="Baixar ou visualizar anexo"
													>
														<Download className="h-3.5 w-3.5" />
													</a>
												)}
											</div>
										)}

										{/* Conteúdo da mensagem com suporte a markdown e risco no texto quando apropriado */}
										<div
											className={cn(
												shouldStrikeThrough && "line-through opacity-85",
												isFallbackInterruptedText &&
													"italic text-slate-500 dark:text-slate-400 text-xs",
											)}
										>
											<MarkdownRenderer
												content={message.text}
												isUser={isUser}
											/>
										</div>

										{/* Card interativo de exportação emitido pela IA */}
										{exportCommands.length > 0 && (
											<div className="flex flex-col gap-2 mt-2">
												{exportCommands.map((cmd) => (
													<ExportActionCard
														key={`${message.id}-export-${cmd.format}-${cmd.orientation}`}
														sessionId={message.sessionId || sessionId || ""}
														format={cmd.format}
														orientation={cmd.orientation}
														hasBlocks={hasBlocks}
													/>
												))}
											</div>
										)}

										{/* Ação rápida para o usuário copiar seu comando interrompido para o input */}
										{isUser && isUserInterrupted && (
											<div className="mt-2 pt-1.5 border-t border-emerald-500/40 flex items-center justify-between gap-2">
												<span className="text-[10px] text-emerald-200 font-medium">
													Comando interrompido
												</span>
												<Button
													type="button"
													variant="secondary"
													size="sm"
													onClick={() => onCopyMessage?.(message.text)}
													className="h-6 px-2 text-[11px] bg-white/20 hover:bg-white/30 text-white border-0 gap-1 rounded-md cursor-pointer transition-colors"
													title="Copiar mensagem para o campo de digitação"
												>
													<Copy className="h-3 w-3" />
													<span>Copiar para editar</span>
												</Button>
											</div>
										)}

										{/* Rodapé com Horário e Status */}
										<div
											className={cn(
												"flex items-center justify-end gap-1.5 mt-1 text-[11px]",
												isUser ? "text-emerald-100/90" : "text-slate-400",
											)}
										>
											{(message.interrupted || isUserInterrupted) && (
												<Badge
													variant="destructive"
													className="text-[10px] px-1.5 py-0 h-4 font-normal"
												>
													Interrompido
												</Badge>
											)}
											<span>{formatTime(message.createdAt)}</span>
										</div>
									</div>

									{isUser && (
										<div className="h-7 w-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mb-1 shadow-xs">
											<User className="h-4 w-4" />
										</div>
									)}
								</div>
							);
						})}
					</div>
				))}

				{/* Streaming em tempo real da LLM */}
				{isStreaming && (
					<div className="flex items-end gap-2 w-full justify-start animate-in fade-in duration-200">
						<div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0 mb-1">
							<Bot className="h-4 w-4" />
						</div>

						<div className="relative max-w-[85%] md:max-w-[70%] px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl rounded-tl-xs border border-slate-200 dark:border-slate-800 shadow-xs">
							{partialText ? (
								<div>
									<MarkdownRenderer content={partialText} isUser={false} />
									<div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
										<span className="inline-flex gap-1 items-center shrink-0">
											<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
											<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
											<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
										</span>
										<span className="font-medium animate-pulse">
											{
												APPLICATION_LOADING_STEPS[
													applicationStepIndex %
														APPLICATION_LOADING_STEPS.length
												]
											}
										</span>
									</div>
								</div>
							) : (
								<div className="flex items-center gap-2.5 py-1">
									<span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
										{
											COMPREHENSION_LOADING_STEPS[
												comprehensionStepIndex %
													COMPREHENSION_LOADING_STEPS.length
											]
										}
									</span>
									<span className="inline-flex gap-1 items-center shrink-0">
										<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
										<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
										<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
									</span>
								</div>
							)}
						</div>
					</div>
				)}

				<div ref={scrollAnchorRef} />
			</div>
		</ScrollArea>
	);
}
