import { Calendar, CheckCircle2, HelpCircle, Sparkles } from "lucide-react";
import type React from "react";
import { cn } from "#/lib/utils";
import type { PlanningBlockWithRelations, Specification } from "./types";

function formatDate(dateStr?: string | null): string {
	if (!dateStr) return "";
	try {
		const safeStr = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00Z`;
		const d = new Date(safeStr);
		return d.toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "2-digit",
			timeZone: "UTC",
		});
	} catch {
		return dateStr;
	}
}

export function formatBlockDateRange(
	startAt?: string | null,
	endAt?: string | null,
): string {
	if (startAt && endAt) {
		const s = formatDate(startAt);
		const e = formatDate(endAt);
		return s === e ? s : `${s} a ${e}`;
	}
	if (startAt) return formatDate(startAt);
	return "";
}

/**
 * Resolve dinamicamente a nomenclatura do bloco de acordo com sua granularidade,
 * especificações do usuário e ordenação, sem textos hardcoded.
 * Suporta a descida recursiva: Anual -> Semestre -> Bimestre -> Mensal -> Semanal -> Diário.
 */
export function formatBlockUnit(
	block: PlanningBlockWithRelations,
	index: number = 0,
	customUnitName?: string | null,
): string {
	// Utiliza o índice do array de renderização (1-based: index + 1)
	const num = index + 1;

	// Se o usuário personalizou explicitamente a coluna de ordem (ex: "Vivência", "Encontro", "Semana")
	if (customUnitName?.trim()) {
		const cleanUnit = customUnitName.split("/")[0].trim();
		return `${cleanUnit} ${num}`;
	}

	const gran = block.granularity?.toUpperCase();

	switch (gran) {
		case "ANNUAL":
			return `${num}º Ano`;
		case "SEMESTER":
			return `${num}º Semestre`;
		case "TRIMESTER":
			return `${num}º Trimestre`;
		case "BIMONTHLY":
			return `${num}º Bimestre`;
		case "MONTHLY": {
			if (block.startAt) {
				try {
					const safeStr = block.startAt.includes("T")
						? block.startAt
						: `${block.startAt}T12:00:00Z`;
					const date = new Date(safeStr);
					const monthName = date.toLocaleDateString("pt-BR", {
						month: "long",
						timeZone: "UTC",
					});
					if (monthName && monthName !== "Invalid Date") {
						const capMonth =
							monthName.charAt(0).toUpperCase() + monthName.slice(1);
						return `Mês ${num} (${capMonth})`;
					}
				} catch {
					// fallback
				}
			}
			return `Mês ${num}`;
		}
		case "WEEKLY":
			return `Semana ${num}`;
		case "DAILY":
			return `Aula ${num}`;
		case "CUSTOM":
			return `Unidade ${num}`;
		default: {
			// Inferência com base no intervalo de datas quando a granularidade não estiver explícita
			if (block.startAt && block.endAt && block.startAt !== block.endAt) {
				const start = new Date(block.startAt).getTime();
				const end = new Date(block.endAt).getTime();
				const diffDays = Math.round(
					Math.abs(end - start) / (1000 * 60 * 60 * 24),
				);

				if (diffDays >= 60) return `${num}º Trimestre`;
				if (diffDays >= 45) return `${num}º Bimestre`;
				if (diffDays >= 25) return `Mês ${num}`;
				if (diffDays >= 4) return `Semana ${num}`;
			}
			return `Aula ${num}`;
		}
	}
}

/**
 * Resolve dinamicamente o cabeçalho <th> da coluna de identificação/ordem
 * baseado na granularidade dos blocos renderizados e nas especificações do usuário.
 */
export function resolveOrderColumnHeader(
	blocks: PlanningBlockWithRelations[],
	orderSpec?: Specification | null,
): string {
	if (orderSpec?.customLabel) {
		return orderSpec.customLabel;
	}
	if (
		orderSpec?.colName &&
		!["order", "aula", "aulas"].includes(orderSpec.colName.toLowerCase())
	) {
		return orderSpec.colName;
	}

	const granCounts: Record<string, number> = {};
	for (const b of blocks) {
		const g = b.granularity?.toUpperCase() || "UNKNOWN";
		granCounts[g] = (granCounts[g] || 0) + 1;
	}

	let maxGran = "";
	let maxCount = 0;
	for (const [g, count] of Object.entries(granCounts)) {
		if (count > maxCount) {
			maxCount = count;
			maxGran = g;
		}
	}

	switch (maxGran) {
		case "ANNUAL":
			return "Ano / Período";
		case "SEMESTER":
			return "Semestre / Período";
		case "TRIMESTER":
			return "Trimestre / Período";
		case "BIMONTHLY":
			return "Bimestre / Período";
		case "MONTHLY":
			return "Mês / Período";
		case "WEEKLY":
			return "Semana / Período";
		case "DAILY":
			return "Aula / Data";
		case "CUSTOM":
			return "Unidade / Período";
		default: {
			const hasRanges = blocks.some(
				(b) => b.startAt && b.endAt && b.startAt !== b.endAt,
			);
			return hasRanges ? "Período / Data" : "Identificação / Data";
		}
	}
}

interface PlanningTableChunkProps {
	blocks: PlanningBlockWithRelations[];
	specifications: Specification[];
	allBlocks?: PlanningBlockWithRelations[];
}

interface TableColumn {
	id: string;
	header: React.ReactNode;
	order: number;
	headerClassName: string;
	cellClassName: string;
	renderCell: (
		block: PlanningBlockWithRelations,
		idx: number,
	) => React.ReactNode;
}

export function PlanningTableChunk({
	blocks,
	specifications: rawSpecs,
	allBlocks,
}: PlanningTableChunkProps) {
	const specifications = Array.isArray(rawSpecs) ? rawSpecs : [];
	const dataset = allBlocks && allBlocks.length > 0 ? allBlocks : blocks;

	// 1. Identificação / Ordem / Período
	const orderSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING_BLOCK" &&
			[
				"order",
				"aula",
				"aulas",
				"data",
				"datas",
				"periodo",
				"semana",
				"bimestre",
				"identificacao",
			].includes(s.colName.toLowerCase()),
	);
	const showOrder = orderSpec ? (orderSpec.isVisible ?? true) : true;
	const orderLabel = resolveOrderColumnHeader(dataset, orderSpec);

	// 2. Metodologia / Sequência Didática
	const methodologySpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING_BLOCK" &&
			s.colName.toLowerCase() === "metodologia",
	);
	const hasMethodology = dataset.some((b) => Boolean(b.metodologia?.trim()));
	const showMethodology = methodologySpec
		? (methodologySpec.isVisible ?? true)
		: hasMethodology;
	const methodologyLabel =
		methodologySpec?.customLabel ||
		methodologySpec?.colName ||
		"Sequência Didática";

	// 3. Habilidades BNCC
	const bnccSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING_BLOCK" &&
			[
				"learningobjectives",
				"habilidades_bncc",
				"bncc",
				"habilidades",
				"objetivos_aprendizagem",
			].includes(s.colName.toLowerCase()),
	);
	const hasLearningObjectives = dataset.some(
		(b) => b.learningObjectives && b.learningObjectives.length > 0,
	);
	const showBncc = bnccSpec
		? (bnccSpec.isVisible ?? true)
		: hasLearningObjectives;
	const bnccLabel =
		bnccSpec?.customLabel || bnccSpec?.colName || "Habilidades BNCC";

	// 4. Avaliações
	const evalSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING_BLOCK" &&
			[
				"evaluations",
				"avaliacao",
				"avaliacoes",
				"instrumento_avaliacao",
			].includes(s.colName.toLowerCase()),
	);
	const hasEvaluations = dataset.some(
		(b) => b.evaluations && b.evaluations.length > 0,
	);
	const showEvaluations = evalSpec
		? (evalSpec.isVisible ?? true)
		: hasEvaluations;
	const evalLabel = evalSpec?.customLabel || evalSpec?.colName || "Avaliação";

	// 5. Colunas Dinâmicas EAV definidas pelo usuário
	const dynamicBlockSpecs = specifications.filter(
		(s) =>
			s.tableRef === "PLANNING_BLOCK" &&
			(s.isVisible ?? true) &&
			![
				"metodologia",
				"order",
				"startat",
				"endat",
				"evaluations",
				"avaliacao",
				"avaliacoes",
				"learningobjectives",
				"habilidades_bncc",
				"bncc",
				"habilidades",
				"objetivos_aprendizagem",
				"identificacao",
				"aula",
				"aulas",
				"data",
				"datas",
				"periodo",
				"semana",
				"bimestre",
			].includes(s.colName.toLowerCase()),
	);

	// Montagem unificada das colunas respeitando spec.order dinamicamente
	const columns: TableColumn[] = [];

	if (showOrder) {
		columns.push({
			id: "col-order",
			header: orderLabel,
			order: orderSpec?.order ?? 0,
			headerClassName: "p-2 w-24 border-r border-slate-300 font-bold",
			cellClassName: "p-2 align-top border-r border-slate-200 font-semibold",
			renderCell: (block, idx) => {
				const dateStr = formatBlockDateRange(block.startAt, block.endAt);
				const label = formatBlockUnit(block, idx, orderSpec?.customLabel);
				const hasParent = Boolean(block.parentId);

				return (
					<div>
						<div className="text-slate-950 font-bold flex items-center gap-1">
							{hasParent && (
								<span className="text-slate-400 font-normal text-[10px]">
									↳
								</span>
							)}
							<span>{label}</span>
						</div>
						{dateStr ? (
							<div className="text-[10px] text-slate-600 font-medium flex items-center gap-0.5 mt-0.5">
								<Calendar className="h-2.5 w-2.5 text-slate-400" />
								{dateStr}
							</div>
						) : (
							<div className="text-[10px] text-slate-400 italic">Sem data</div>
						)}
					</div>
				);
			},
		});
	}

	if (showMethodology) {
		columns.push({
			id: "col-metodologia",
			header: methodologyLabel,
			order: methodologySpec?.order ?? 1,
			headerClassName: "p-2 min-w-[140px] border-r border-slate-300 font-bold",
			cellClassName:
				"p-2 align-top border-r border-slate-200 text-slate-900 leading-snug whitespace-pre-wrap",
			renderCell: (block) =>
				block.metodologia ? (
					<div>{block.metodologia}</div>
				) : (
					<span className="text-slate-400 italic">
						Metodologia em elaboração...
					</span>
				),
		});
	}

	if (showBncc) {
		columns.push({
			id: "col-bncc",
			header: bnccLabel,
			order: bnccSpec?.order ?? 2,
			headerClassName: "p-2 w-28 border-r border-slate-300 font-bold",
			cellClassName: "p-2 align-top border-r border-slate-200",
			renderCell: (block) => (
				<div className="flex flex-wrap gap-1">
					{block.learningObjectives && block.learningObjectives.length > 0 ? (
						block.learningObjectives.map((obj) => {
							const code = obj.bnccSkill?.code || "BNCC";
							const desc =
								obj.customDescription ||
								obj.bnccSkill?.description ||
								"Habilidade da BNCC associada à aula";

							return (
								<span
									key={obj.id}
									title={desc}
									className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-950 text-[10px] font-mono font-bold cursor-help hover:bg-amber-100 transition-colors"
								>
									<Sparkles className="h-2 w-2 text-amber-600" />
									<span>{code}</span>
								</span>
							);
						})
					) : (
						<span className="text-[10px] text-slate-400 italic">—</span>
					)}
				</div>
			),
		});
	}

	if (showEvaluations) {
		columns.push({
			id: "col-evaluations",
			header: evalLabel,
			order: evalSpec?.order ?? 3,
			headerClassName: "p-2 w-28 border-r border-slate-300 font-bold",
			cellClassName: "p-2 align-top border-r border-slate-200",
			renderCell: (block) => (
				<div className="flex flex-col gap-1">
					{block.evaluations && block.evaluations.length > 0 ? (
						block.evaluations.map((ev) => (
							<div
								key={ev.id}
								className="p-1 rounded bg-slate-50 border border-slate-300 text-[10px] text-slate-900"
							>
								<div className="font-bold text-slate-950 flex items-center gap-1">
									<CheckCircle2 className="h-2.5 w-2.5 text-emerald-700" />
									<span>{ev.name || ev.instrumentType || "Avaliação"}</span>
								</div>
								{ev.criteria && (
									<div className="text-[9px] text-slate-600 line-clamp-2 mt-0.5">
										{ev.criteria}
									</div>
								)}
							</div>
						))
					) : (
						<span className="text-[10px] text-slate-400 italic">—</span>
					)}
				</div>
			),
		});
	}

	for (const spec of dynamicBlockSpecs) {
		columns.push({
			id: `col-spec-${spec.id}`,
			header: (
				<div className="flex items-center gap-1">
					<span>{spec.customLabel || spec.colName}</span>
					{spec.description && (
						<span
							title={spec.description}
							className="cursor-help text-slate-500 hover:text-slate-800"
						>
							<HelpCircle className="h-2.5 w-2.5" />
						</span>
					)}
					{spec.avgCharLimit && (
						<span className="text-[9px] px-1 py-0 rounded bg-slate-200 border border-slate-300 font-mono text-slate-700">
							~{spec.avgCharLimit}c
						</span>
					)}
				</div>
			),
			order: spec.order ?? 4,
			headerClassName: "p-2 min-w-[110px] border-r border-slate-300 font-bold",
			cellClassName:
				"p-2 align-top border-r border-slate-200 text-slate-900 leading-snug",
			renderCell: (block) => {
				const meta = block.metadataValues?.find(
					(m) =>
						m.specificationId === spec.id ||
						m.specification?.colName.toLowerCase() ===
							spec.colName.toLowerCase(),
				);
				const val = meta?.textValue;
				return val ? (
					<div>{val}</div>
				) : (
					<span className="text-slate-400 italic">—</span>
				);
			},
		});
	}

	// Ordenação dinâmica: as colunas seguem estritamente a ordem definida pelo usuário/IA
	columns.sort((a, b) => a.order - b.order);

	return (
		<div className="w-full overflow-x-auto border border-slate-300 rounded-xs mb-3">
			<table className="w-full border-collapse text-left text-[11px] text-slate-900">
				<thead>
					<tr className="bg-slate-100 border-b border-slate-300 text-slate-950 font-bold">
						{columns.map((col, cIdx) => (
							<th
								key={col.id}
								className={cn(
									col.headerClassName,
									cIdx === columns.length - 1 && "last:border-r-0",
								)}
							>
								{col.header}
							</th>
						))}
					</tr>
				</thead>

				<tbody className="divide-y divide-slate-200 bg-white">
					{blocks.map((block, idx) => (
						<tr
							key={block.id}
							data-block-id={block.id}
							className="transition-colors hover:bg-slate-50/80"
						>
							{columns.map((col, cIdx) => (
								<td
									key={col.id}
									className={cn(
										col.cellClassName,
										cIdx === columns.length - 1 && "last:border-r-0",
									)}
								>
									{col.renderCell(block, idx)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

interface SectionDividerProps {
	title: string;
	breadcrumbs?: string[];
	dateRange?: string;
	isContinuation?: boolean;
	parentBlock?: PlanningBlockWithRelations;
}

export function SectionDivider({
	title,
	breadcrumbs,
	dateRange,
	isContinuation,
	parentBlock,
}: SectionDividerProps) {
	return (
		<div className="pb-1 mb-2 border-b-2 border-slate-800 text-slate-900">
			{/* Breadcrumbs de Níveis Hierárquicos Superiores (ex: Anual > Semestre > Bimestre > Mês) */}
			{breadcrumbs && breadcrumbs.length > 0 && (
				<div className="flex items-center gap-1 text-[9px] text-slate-600 font-semibold uppercase tracking-wider mb-0.5 flex-wrap">
					{breadcrumbs.map((crumb) => (
						<span key={crumb} className="flex items-center gap-1">
							<span>{crumb}</span>
							<span className="text-slate-400 font-normal">›</span>
						</span>
					))}
				</div>
			)}

			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<span className="h-4 px-1 rounded bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center">
						{isContinuation ? "..." : "§"}
					</span>
					<h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-950 font-serif">
						{title}
					</h4>
				</div>
				{dateRange && (
					<div className="flex items-center gap-1 text-[11px] text-slate-600 font-semibold">
						<Calendar className="h-2.5 w-2.5 text-slate-500" />
						<span>{dateRange}</span>
					</div>
				)}
			</div>

			{/* Metodologia Pedagógica do Bloco Pai (se houver e não for continuação) */}
			{!isContinuation && parentBlock?.metodologia && (
				<p className="text-[10px] text-slate-600 italic mt-1 leading-snug">
					{parentBlock.metodologia}
				</p>
			)}
		</div>
	);
}
