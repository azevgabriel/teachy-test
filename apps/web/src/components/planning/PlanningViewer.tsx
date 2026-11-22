import {
	AlertCircle,
	Download,
	FileSpreadsheet,
	PanelLeftClose,
	PanelLeftOpen,
	RectangleHorizontal,
	RectangleVertical,
	RefreshCw,
	Sparkles,
} from "lucide-react";
import * as React from "react";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { cn } from "#/lib/utils";
import { PlanningHeader } from "./PlanningHeader";
import { PlanningTableChunk, SectionDivider } from "./PlanningTable";
import { type PageOrientation, paginatePlanning } from "./paginatePlanning";
import type { PlanningResponseDto } from "./types";

interface PlanningViewerProps {
	sessionId?: string;
	data: PlanningResponseDto | null;
	isLoading: boolean;
	error: string | null;
	isOpen: boolean;
	onToggle: () => void;
	onRefresh?: () => void;
}

export function PlanningViewer({
	sessionId,
	data,
	isLoading,
	error,
	isOpen,
	onToggle,
	onRefresh,
}: PlanningViewerProps) {
	const [isExporting, setIsExporting] = React.useState(false);
	const [orientation, setOrientation] =
		React.useState<PageOrientation>("portrait");
	const planning = data?.planning ?? null;
	const specifications = data?.specifications || [];
	const hasBlocks = (planning?.blocks?.length ?? 0) > 0;

	// Diagrama o planejamento em folhas A4 discretas com base na orientação (Retrato ou Paisagem)
	const pages = React.useMemo(() => {
		return paginatePlanning(planning, specifications, orientation);
	}, [planning, specifications, orientation]);

	const handleExportPdf = async () => {
		if (!sessionId) return;
		setIsExporting(true);

		try {
			// Aciona o endpoint do backend com a orientação escolhida
			const url = `/api/sessions/${sessionId}/planning/pdf?orientation=${orientation}`;
			const res = await fetch(url);

			if (!res.ok) {
				// Fallback: abre amigavelmente
				window.open(url, "_blank");
				return;
			}

			// Se recebeu o stream binário de volta, inicia o download
			const blob = await res.blob();
			const blobUrl = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = blobUrl;
			link.download = `planejamento-${planning?.curricularComponents?.[0]?.name || "aula"}-${orientation}.pdf`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(blobUrl);
		} catch (err) {
			console.error("Erro ao exportar PDF:", err);
			window.open(
				`/api/sessions/${sessionId}/planning/pdf?orientation=${orientation}`,
				"_blank",
			);
		} finally {
			setIsExporting(false);
		}
	};

	// Painel Minimizado à Esquerda (Barra de Acesso Rápido)
	if (!isOpen) {
		return (
			<aside className="w-12 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center py-3 shrink-0 transition-all z-10">
				<Button
					variant="ghost"
					size="icon"
					onClick={onToggle}
					title="Expandir pré-visualização A4"
					className="h-9 w-9 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
				>
					<PanelLeftOpen className="h-4 w-4" />
				</Button>

				<div className="my-3 w-4 border-t border-slate-200 dark:border-slate-800" />

				<button
					type="button"
					onClick={onToggle}
					className="[writing-mode:vertical-rl] rotate-180 text-xs font-semibold tracking-wider uppercase text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-2 py-4 transition-colors cursor-pointer"
				>
					<FileSpreadsheet className="h-3.5 w-3.5 rotate-90" />
					<span>Pré-visualização A4</span>
					{hasBlocks && (
						<span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
					)}
				</button>
			</aside>
		);
	}

	return (
		<aside className="flex flex-col flex-1 min-w-0 h-full border-r border-slate-200 dark:border-slate-800 bg-slate-200/50 dark:bg-slate-950/80 overflow-hidden">
			{/* Estilos dinâmicos de impressão para garantir A4 portrait ou landscape */}
			<style>{`
				@media print {
					@page {
						size: A4 ${orientation};
						margin: 10mm;
					}
				}
			`}</style>

			{/* Top Bar da Pré-visualização A4 */}
			<header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 shadow-xs">
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						onClick={onToggle}
						title="Recolher painel à esquerda"
						className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
					>
						<PanelLeftClose className="h-4 w-4" />
					</Button>
					<div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
					<div className="flex items-center gap-2">
						<div className="h-7 w-7 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700">
							<FileSpreadsheet className="h-4 w-4" />
						</div>
						<div>
							<h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
								Pré-visualização A4
							</h3>
							<p className="text-[10px] text-slate-400 font-medium">
								{isLoading
									? "Sincronizando..."
									: `${pages.length} folha${pages.length > 1 ? "s" : ""} (${orientation === "landscape" ? "Paisagem" : "Retrato"})`}
							</p>
						</div>
					</div>
				</div>

				{/* Controles de Orientação e Ações */}
				<div className="flex items-center gap-2">
					{/* Toggle Retrato / Paisagem */}
					<div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded border border-slate-200 dark:border-slate-700">
						<button
							type="button"
							onClick={() => setOrientation("portrait")}
							title="Orientação Retrato (A4: 210mm × 297mm)"
							className={cn(
								"flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded transition-colors cursor-pointer",
								orientation === "portrait"
									? "bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 shadow-xs"
									: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300",
							)}
						>
							<RectangleVertical className="h-3.5 w-3.5" />
							<span className="hidden sm:inline">Retrato</span>
						</button>
						<button
							type="button"
							onClick={() => setOrientation("landscape")}
							title="Orientação Paisagem (A4: 297mm × 210mm)"
							className={cn(
								"flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded transition-colors cursor-pointer",
								orientation === "landscape"
									? "bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 shadow-xs"
									: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300",
							)}
						>
							<RectangleHorizontal className="h-3.5 w-3.5" />
							<span className="hidden sm:inline">Paisagem</span>
						</button>
					</div>

					{onRefresh && (
						<Button
							variant="ghost"
							size="icon"
							onClick={onRefresh}
							disabled={isLoading}
							title="Atualizar dados do planejamento"
							className="h-8 w-8 text-slate-400 hover:text-slate-600"
						>
							<RefreshCw
								className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
							/>
						</Button>
					)}

					<Button
						variant="outline"
						size="sm"
						onClick={handleExportPdf}
						disabled={!hasBlocks || isExporting}
						className="h-8 text-xs gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-xs"
					>
						<Download className="h-3.5 w-3.5" />
						<span>{isExporting ? "Gerando..." : "Exportar PDF"}</span>
					</Button>
				</div>
			</header>

			{/* Banner de Erro caso ocorra falha */}
			{error && (
				<div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
					<AlertCircle className="h-3.5 w-3.5 shrink-0" />
					<span className="truncate">{error}</span>
				</div>
			)}

			{/* Canvas com as Folhas A4 discretas (Scroll horizontal e vertical fluido) */}
			<div className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center gap-8">
				{isLoading && !planning ? (
					// Skeleton no formato de Folha A4
					<div
						className={cn(
							"bg-white shadow-md border border-slate-300 rounded-xs flex flex-col gap-6 shrink-0",
							orientation === "portrait"
								? "w-[210mm] max-w-full min-h-[297mm] p-8 sm:p-10"
								: "w-[297mm] min-h-[210mm] p-6 sm:p-8",
						)}
					>
						<div className="border-b-2 border-slate-200 pb-4 flex justify-between items-center">
							<Skeleton className="h-6 w-48" />
							<Skeleton className="h-6 w-20" />
						</div>
						<div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xs border border-slate-200">
							<Skeleton className="h-8 w-full" />
							<Skeleton className="h-8 w-full" />
							<Skeleton className="h-8 w-full" />
							<Skeleton className="h-8 w-full" />
						</div>
						<div className="flex flex-col gap-2 mt-4">
							<Skeleton className="h-8 w-full" />
							<Skeleton className="h-12 w-full" />
							<Skeleton className="h-12 w-full" />
							<Skeleton className="h-12 w-full" />
						</div>
					</div>
				) : !planning ? (
					// Estado Vazio (Folha A4 em Branco pronta para receber o plano)
					<div
						className={cn(
							"bg-white text-slate-900 shadow-md border border-slate-300 rounded-xs flex flex-col items-center justify-center text-center shrink-0",
							orientation === "portrait"
								? "w-[210mm] max-w-full min-h-[297mm] p-8 sm:p-10"
								: "w-[297mm] min-h-[210mm] p-6 sm:p-8",
						)}
					>
						<div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mb-3 border border-slate-200 shadow-xs">
							<Sparkles className="h-6 w-6 text-emerald-600" />
						</div>
						<h4 className="text-base font-extrabold text-slate-950 font-serif mb-1">
							Folha de Planejamento A4 (
							{orientation === "landscape" ? "Paisagem" : "Retrato"})
						</h4>
						<p className="text-xs text-slate-600 max-w-sm mb-6 leading-relaxed">
							Inicie a conversa no chat ao lado informando os detalhes da aula
							ou ciclo. A sua folha A4 será preenchida e diagramada aqui em
							tempo real.
						</p>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full text-left">
							<div className="p-3 rounded bg-slate-50 border border-slate-200 text-xs text-slate-800">
								<span className="font-bold text-slate-950 block mb-0.5">
									📐 Layout Pronto para Impressão
								</span>
								Diagramação adaptada para exportação em PDF via Playwright.
							</div>
							<div className="p-3 rounded bg-slate-50 border border-slate-200 text-xs text-slate-800">
								<span className="font-bold text-slate-950 block mb-0.5">
									📄 Quebra de Página A4
								</span>
								Se o conteúdo ultrapassar o tamanho da folha, ele passa para a
								próxima folha A4.
							</div>
						</div>
					</div>
				) : (
					// Mapeia cada folha A4 com quebra de página controlada
					pages.map((page) => (
						<div
							key={`page-${page.pageNumber}`}
							data-page-number={page.pageNumber}
							data-orientation={orientation}
							className={cn(
								"a4-sheet bg-white text-slate-900 shadow-lg border border-slate-300 rounded-xs flex flex-col justify-between shrink-0 transition-all",
								orientation === "portrait"
									? "w-[210mm] max-w-full min-h-[297mm] p-6 sm:p-10"
									: "w-[297mm] min-h-[210mm] p-5 sm:p-7",
							)}
						>
							<div className="flex-1 flex flex-col">
								{/* Running Header para Folhas > 1 */}
								{page.pageNumber > 1 && (
									<div className="flex items-center justify-between pb-2 mb-4 border-b border-slate-200 text-xs text-slate-500 font-medium">
										<span className="font-semibold text-slate-800">
											Plano de Ensino &bull;{" "}
											{planning.curricularComponents?.[0]?.name || "Pedagógico"}
										</span>
										<span className="font-mono text-[11px] text-slate-400">
											Folha {page.pageNumber}
										</span>
									</div>
								)}

								{/* Itens alocados nesta folha */}
								{page.items.map((item) => {
									if (item.type === "header") {
										return (
											<PlanningHeader
												key={item.id}
												planning={planning}
												specifications={specifications}
											/>
										);
									}

									if (item.type === "section-title") {
										return (
											<SectionDivider
												key={item.id}
												title={item.title || "Bloco"}
												dateRange={item.dateRange}
												isContinuation={item.isContinuation}
											/>
										);
									}

									if (item.type === "table-chunk" && item.blocks) {
										return (
											<PlanningTableChunk
												key={item.id}
												blocks={item.blocks}
												specifications={specifications}
												allBlocks={planning.blocks || []}
											/>
										);
									}

									return null;
								})}
							</div>

							{/* Running Footer em cada Folha A4 */}
							<div className="a4-sheet-footer pt-3 mt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-medium">
								<span>Plano Curricular Estruturado &bull; Teachy</span>
								<span className="font-semibold text-slate-700">
									Folha {page.pageNumber} de {pages.length}
								</span>
							</div>
						</div>
					))
				)}
			</div>
		</aside>
	);
}
