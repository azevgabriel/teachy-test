import {
	Calendar,
	Check,
	Clock,
	MessageSquare,
	PanelRightClose,
	PanelRightOpen,
	Pencil,
	Plus,
	Trash2,
	X,
} from "lucide-react";
import * as React from "react";
import { formatGranularity } from "#/components/planning/PlanningHeader";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { cn } from "#/lib/utils";
import type { SessionSummary } from "./types";

interface SidebarProps {
	isOpen: boolean;
	onToggle: () => void;
	sessions: SessionSummary[];
	activeSessionId?: string;
	onSelectSession: (id: string) => void;
	onNewChat: () => void;
	onRenameSession?: (id: string, newName: string) => Promise<void>;
	onDeleteSession?: (id: string) => Promise<void>;
}

function formatDate(dateString: string): string {
	try {
		const date = new Date(dateString);
		return date.toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "";
	}
}

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

export function Sidebar({
	isOpen,
	onToggle,
	sessions,
	activeSessionId,
	onSelectSession,
	onNewChat,
	onRenameSession,
	onDeleteSession,
}: SidebarProps) {
	const [editingId, setEditingId] = React.useState<string | null>(null);
	const [editingName, setEditingName] = React.useState("");
	const [deletingId, setDeletingId] = React.useState<string | null>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);

	React.useEffect(() => {
		if (editingId) {
			inputRef.current?.focus();
		}
	}, [editingId]);

	const handleSaveRename = async (id: string) => {
		const trimmed = editingName.trim();
		if (!trimmed) {
			setEditingId(null);
			return;
		}
		if (onRenameSession) {
			await onRenameSession(id, trimmed);
		}
		setEditingId(null);
	};

	const handleConfirmDelete = async (id: string) => {
		if (onDeleteSession) {
			await onDeleteSession(id);
		}
		setDeletingId(null);
	};

	return (
		<aside
			className={cn(
				"relative flex flex-col border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transition-all duration-300 ease-in-out shrink-0",
				isOpen ? "w-80" : "w-14",
			)}
		>
			{/* Top Bar with Toggle and New Chat */}
			<div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 gap-2">
				{isOpen ? (
					<>
						<Button
							variant="default"
							size="sm"
							onClick={onNewChat}
							className="flex-1 justify-start gap-2 text-xs font-semibold"
						>
							<Plus className="h-4 w-4" />
							Nova Conversa
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={onToggle}
							title="Recolher barra lateral"
							className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
						>
							<PanelRightClose className="h-4 w-4" />
						</Button>
					</>
				) : (
					<div className="flex flex-col items-center w-full gap-2">
						<Button
							variant="ghost"
							size="icon"
							onClick={onToggle}
							title="Expandir barra lateral"
							className="h-9 w-9 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
						>
							<PanelRightOpen className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="icon"
							onClick={onNewChat}
							title="Nova Conversa"
							className="h-9 w-9"
						>
							<Plus className="h-4 w-4" />
						</Button>
					</div>
				)}
			</div>

			{/* Session List */}
			{isOpen && (
				<ScrollArea className="flex-1 p-2">
					<div className="text-xs font-medium text-slate-400 px-3 py-2 uppercase tracking-wider">
						Histórico de Sessões
					</div>
					{sessions.length === 0 ? (
						<div className="p-4 text-center text-xs text-slate-400">
							Nenhuma sessão iniciada.
						</div>
					) : (
						<div className="flex flex-col gap-1">
							{sessions.map((session) => {
								const isActive = session.id === activeSessionId;

								// Modo de Edição (Renomear)
								if (editingId === session.id) {
									return (
										<div
											key={session.id}
											className="flex items-center gap-1.5 p-2 rounded-lg bg-white dark:bg-slate-800 border border-emerald-500 shadow-xs"
										>
											<input
												ref={inputRef}
												type="text"
												value={editingName}
												onChange={(e) => setEditingName(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														handleSaveRename(session.id);
													} else if (e.key === "Escape") {
														setEditingId(null);
													}
												}}
												className="flex-1 bg-transparent text-sm font-medium focus:outline-none text-slate-900 dark:text-slate-100 px-1 py-0.5 min-w-0"
											/>
											<Button
												type="button"
												size="icon"
												variant="ghost"
												className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/50 shrink-0"
												onClick={(e) => {
													e.stopPropagation();
													handleSaveRename(session.id);
												}}
												title="Salvar novo nome"
											>
												<Check className="h-3.5 w-3.5" />
											</Button>
											<Button
												type="button"
												size="icon"
												variant="ghost"
												className="h-6 w-6 text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
												onClick={(e) => {
													e.stopPropagation();
													setEditingId(null);
												}}
												title="Cancelar"
											>
												<X className="h-3.5 w-3.5" />
											</Button>
										</div>
									);
								}

								// Modo de Confirmação de Exclusão
								if (deletingId === session.id) {
									return (
										<div
											key={session.id}
											className="flex items-center justify-between p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 shadow-xs"
										>
											<span className="truncate font-medium pr-1">
												Excluir conversa?
											</span>
											<div className="flex items-center gap-1 shrink-0">
												<Button
													type="button"
													size="sm"
													variant="destructive"
													className="h-6 px-2 text-[11px]"
													onClick={(e) => {
														e.stopPropagation();
														handleConfirmDelete(session.id);
													}}
												>
													Sim
												</Button>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													className="h-6 px-1.5 text-[11px]"
													onClick={(e) => {
														e.stopPropagation();
														setDeletingId(null);
													}}
												>
													Não
												</Button>
											</div>
										</div>
									);
								}

								// Modo Padrão
								const hasPlanning = Boolean(
									session.planning &&
										((session.planning.curricularComponents &&
											session.planning.curricularComponents.length > 0) ||
											session.planning.applicationYear ||
											session.planning.granularity),
								);

								const dateRange = formatPlanningDateRange(
									session.planning?.startAt,
									session.planning?.endAt,
								);

								return (
									<div
										key={session.id}
										className={cn(
											"group relative flex flex-col w-full p-2.5 rounded-lg text-left transition-colors gap-2",
											isActive
												? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
												: "hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-transparent",
										)}
									>
										<div className="flex items-center justify-between w-full gap-1">
											<button
												type="button"
												onClick={() => onSelectSession(session.id)}
												className="flex items-center gap-2 min-w-0 flex-1 text-left bg-transparent border-0 cursor-pointer p-0"
											>
												<MessageSquare
													className={cn(
														"h-3.5 w-3.5 shrink-0",
														isActive ? "text-emerald-600" : "text-slate-400",
													)}
												/>
												<span
													className="text-sm font-semibold truncate"
													title={session.name}
												>
													{session.name}
												</span>
											</button>

											{/* Botões de Ação Rápidos (Visíveis no Hover ou quando Ativo) */}
											<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
												<Button
													type="button"
													size="icon"
													variant="ghost"
													onClick={(e) => {
														e.stopPropagation();
														setEditingId(session.id);
														setEditingName(session.name);
														setDeletingId(null);
													}}
													title="Renomear conversa"
													className="h-6 w-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
												>
													<Pencil className="h-3 w-3" />
												</Button>
												<Button
													type="button"
													size="icon"
													variant="ghost"
													onClick={(e) => {
														e.stopPropagation();
														setDeletingId(session.id);
														setEditingId(null);
													}}
													title="Excluir conversa"
													className="h-6 w-6 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>
										</div>

										{/* Pedagogical Badges & Period */}
										<button
											type="button"
											onClick={() => onSelectSession(session.id)}
											className="flex flex-col items-start w-full text-left bg-transparent border-0 cursor-pointer p-0 gap-1.5 pl-5.5"
										>
											{hasPlanning ? (
												<div className="flex flex-wrap gap-1 items-center">
													{session.planning?.curricularComponents?.map(
														(comp) => (
															<Badge
																key={comp.id}
																variant="default"
																title={comp.name}
																className="text-[10px] h-4.5 px-1.5 py-0 font-medium max-w-[108px] min-w-0"
															>
																<span className="truncate">{comp.name}</span>
															</Badge>
														),
													)}
													{session.planning?.applicationYear && (
														<Badge
															variant="outline"
															title={session.planning.applicationYear.name}
															className="text-[10px] h-4.5 px-1.5 py-0 font-medium text-slate-700 dark:text-slate-300 max-w-[108px] min-w-0"
														>
															<span className="truncate">
																{session.planning.applicationYear.name}
															</span>
														</Badge>
													)}
													{session.planning?.granularity && (
														<Badge
															variant="secondary"
															title={formatGranularity(
																session.planning.granularity,
															)}
															className="text-[10px] h-4.5 px-1.5 py-0 font-medium max-w-[108px] min-w-0"
														>
															<span className="truncate">
																{formatGranularity(
																	session.planning.granularity,
																)}
															</span>
														</Badge>
													)}
												</div>
											) : (
												<Badge
													variant="outline"
													className="text-[10px] h-4.5 px-1.5 py-0 border-dashed text-slate-400"
												>
													Em definição
												</Badge>
											)}

											{dateRange && (
												<div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
													<Calendar className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
													<span className="truncate">{dateRange}</span>
												</div>
											)}

											<div className="flex items-center gap-1.5 text-[11px] text-slate-400">
												<Clock className="h-3 w-3 shrink-0" />
												<span>
													{formatDate(session.updatedAt || session.createdAt)}
												</span>
											</div>
										</button>
									</div>
								);
							})}
						</div>
					)}
				</ScrollArea>
			)}
		</aside>
	);
}
