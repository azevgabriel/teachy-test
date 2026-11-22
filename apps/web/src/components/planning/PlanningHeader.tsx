import {
	BookOpen,
	Calendar,
	CheckCircle2,
	GraduationCap,
	Layers,
	School as SchoolIcon,
	Sparkles,
} from "lucide-react";
import type { PlanningAggregate, Specification } from "./types";

interface PlanningHeaderProps {
	planning: PlanningAggregate;
	specifications: Specification[];
}

export const GRANULARITY_LABELS: Record<string, string> = {
	ANNUAL: "Anual",
	SEMESTER: "Semestral",
	TRIMESTER: "Trimestral",
	BIMONTHLY: "Bimestral",
	MONTHLY: "Mensal",
	WEEKLY: "Semanal",
	DAILY: "Diário",
	CUSTOM: "Personalizado",
};

export function formatGranularity(granularity?: string | null): string {
	if (!granularity) return "";
	return GRANULARITY_LABELS[granularity.toUpperCase()] || granularity;
}

function formatDate(dateStr?: string | null): string {
	if (!dateStr) return "";
	try {
		const safeStr = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00Z`;
		const d = new Date(safeStr);
		return d.toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			timeZone: "UTC",
		});
	} catch {
		return dateStr;
	}
}

export function PlanningHeader({
	planning,
	specifications: rawSpecs,
}: PlanningHeaderProps) {
	const specifications = Array.isArray(rawSpecs) ? rawSpecs : [];
	const headerSpecs = specifications.filter((s) => s.tableRef === "PLANNING");
	const headerMetadata = planning.metadataValues || [];

	// Localiza possíveis especificações customizadas para colunas nativas do cabeçalho
	const titleSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING" &&
			["titulo", "title", "plano", "nome"].includes(s.colName.toLowerCase()),
	);
	const componentSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING" &&
			["curricularcomponents", "componente", "disciplina", "materia"].includes(
				s.colName.toLowerCase(),
			),
	);
	const yearSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING" &&
			["applicationyear", "ano", "etapa", "serie", "turma"].includes(
				s.colName.toLowerCase(),
			),
	);
	const schoolSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING" &&
			["school", "escola", "instituicao", "rede"].includes(
				s.colName.toLowerCase(),
			),
	);
	const periodSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING" &&
			["periodo", "period", "datas", "cronograma"].includes(
				s.colName.toLowerCase(),
			),
	);
	const bnccHeaderSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING" &&
			[
				"learningobjectives",
				"habilidades_bncc",
				"bncc",
				"habilidades",
				"objetivos_aprendizagem",
			].includes(s.colName.toLowerCase()),
	);
	const evalHeaderSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING" &&
			[
				"evaluations",
				"avaliacao",
				"avaliacoes",
				"instrumento_avaliacao",
				"como_avaliar",
			].includes(s.colName.toLowerCase()),
	);

	// Título dinâmico: especificação do usuário ou nome do componente curricular
	const titleMeta = titleSpec
		? headerMetadata.find(
				(m) =>
					m.specificationId === titleSpec.id ||
					m.specification?.colName === titleSpec.colName,
			)
		: null;
	const documentTitle =
		titleMeta?.textValue ||
		titleSpec?.customLabel ||
		(planning.curricularComponents?.length
			? `Plano de Ensino — ${planning.curricularComponents.map((c) => c.name).join(", ")}`
			: "Plano de Ensino");

	const showYear =
		Boolean(planning.applicationYear?.name) &&
		(yearSpec ? yearSpec.isVisible !== false : true);

	const documentSubtitle = showYear
		? planning.applicationYear?.name || null
		: null;

	const periodText =
		planning.startAt && planning.endAt
			? `${formatDate(planning.startAt)} a ${formatDate(planning.endAt)}`
			: planning.startAt
				? `A partir de ${formatDate(planning.startAt)}`
				: null;

	interface HeaderGridItem {
		id: string;
		key: string;
		label: string;
		value: React.ReactNode;
		icon?: React.ReactNode;
		order: number;
	}

	interface HeaderMacroSection {
		id: string;
		order: number;
		content: React.ReactNode;
	}

	const gridItems: HeaderGridItem[] = [];

	// 1. Componentes Curriculares
	const showComponent =
		(planning.curricularComponents?.length || 0) > 0 &&
		(componentSpec ? componentSpec.isVisible !== false : true);
	if (showComponent) {
		gridItems.push({
			id: "header-component",
			key: "curricularcomponents",
			label:
				componentSpec?.customLabel || componentSpec?.colName || "Componente",
			value: planning.curricularComponents?.map((c) => c.name).join(", "),
			icon: <BookOpen className="h-2.5 w-2.5 text-emerald-700" />,
			order: componentSpec?.order ?? 0,
		});
	}

	// 2. Ano / Etapa de Aplicação
	if (showYear) {
		gridItems.push({
			id: "header-year",
			key: "applicationyear",
			label: yearSpec?.customLabel || yearSpec?.colName || "Ano / Etapa",
			value: planning.applicationYear?.name,
			icon: <GraduationCap className="h-2.5 w-2.5 text-emerald-700" />,
			order: yearSpec?.order ?? 1,
		});
	}

	// 3. Escola / Instituição
	const showSchool =
		Boolean(planning.school?.name) &&
		(schoolSpec ? schoolSpec.isVisible !== false : true);
	if (showSchool) {
		gridItems.push({
			id: "header-school",
			key: "school",
			label: schoolSpec?.customLabel || schoolSpec?.colName || "Escola",
			value: planning.school?.name,
			icon: <SchoolIcon className="h-2.5 w-2.5 text-slate-600" />,
			order: schoolSpec?.order ?? 2,
		});
	}

	// 4. Período / Cronograma
	const showPeriod =
		Boolean(periodText) && (periodSpec ? periodSpec.isVisible !== false : true);
	if (showPeriod) {
		gridItems.push({
			id: "header-period",
			key: "periodo",
			label: periodSpec?.customLabel || periodSpec?.colName || "Período",
			value: periodText,
			icon: <Calendar className="h-2.5 w-2.5 text-slate-600" />,
			order: periodSpec?.order ?? 3,
		});
	}

	// 5. Itens Dinâmicos EAV de Cabeçalho (tableRef === PLANNING)
	const longDynamicItems: Array<{
		spec: Specification;
		value: string;
	}> = [];

	for (const spec of headerSpecs) {
		const isNativeOverride = [
			"titulo",
			"title",
			"plano",
			"nome",
			"curricularcomponents",
			"componente",
			"disciplina",
			"materia",
			"applicationyear",
			"ano",
			"etapa",
			"serie",
			"turma",
			"school",
			"escola",
			"instituicao",
			"rede",
			"startat",
			"endat",
			"periodo",
			"period",
			"datas",
			"cronograma",
			"learningobjectives",
			"habilidades_bncc",
			"bncc",
			"habilidades",
			"objetivos_aprendizagem",
			"evaluations",
			"avaliacao",
			"avaliacoes",
			"instrumento_avaliacao",
			"como_avaliar",
		].includes(spec.colName.toLowerCase());

		if (isNativeOverride) continue;
		if (spec.isVisible === false) continue;

		const meta = headerMetadata.find(
			(m) =>
				m.specificationId === spec.id ||
				m.specification?.colName.toLowerCase() === spec.colName.toLowerCase(),
		);
		const val = meta?.textValue?.trim();
		if (val) {
			const isLong = val.length > 50 || val.includes("\n");
			if (isLong) {
				longDynamicItems.push({ spec, value: val });
			} else {
				gridItems.push({
					id: `header-spec-${spec.id}`,
					key: spec.colName,
					label: spec.customLabel || spec.colName,
					value: val,
					order: spec.order ?? 4,
				});
			}
		}
	}

	// Ordenação dinâmica do grid superior com base estritamente em spec.order
	gridItems.sort((a, b) => a.order - b.order);

	// Montagem das Seções Macro inferiores (BNCC, Avaliações e Textos Longos) respeitando spec.order
	const macroSections: HeaderMacroSection[] = [];

	const showBncc =
		Boolean(
			planning.learningObjectives && planning.learningObjectives.length > 0,
		) && (bnccHeaderSpec ? bnccHeaderSpec.isVisible !== false : true);
	const bnccHeaderLabel =
		bnccHeaderSpec?.customLabel ||
		bnccHeaderSpec?.colName ||
		"Habilidades BNCC";

	if (showBncc) {
		macroSections.push({
			id: "macro-bncc",
			order: bnccHeaderSpec?.order ?? 10,
			content: (
				<div className="mt-3 pt-2.5 border-t border-slate-200">
					<div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
						<Sparkles className="h-2.5 w-2.5 text-amber-600" />
						{bnccHeaderLabel}
					</div>
					<div className="flex flex-wrap gap-1">
						{planning.learningObjectives?.map((obj) => {
							const code = obj.bnccSkill?.code || "BNCC";
							const desc =
								obj.customDescription ||
								obj.bnccSkill?.description ||
								"Habilidade associada ao planejamento";

							return (
								<span
									key={obj.id}
									title={desc}
									className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-950 text-[10px] font-mono font-bold cursor-help hover:bg-amber-100 transition-colors"
								>
									<span>{code}</span>
								</span>
							);
						})}
					</div>
				</div>
			),
		});
	}

	const showEval =
		Boolean(planning.evaluations && planning.evaluations.length > 0) &&
		(evalHeaderSpec ? evalHeaderSpec.isVisible !== false : true);
	const evalHeaderLabel =
		evalHeaderSpec?.customLabel ||
		evalHeaderSpec?.colName ||
		"Avaliação da Aprendizagem";

	if (showEval) {
		macroSections.push({
			id: "macro-evaluations",
			order: evalHeaderSpec?.order ?? 11,
			content: (
				<div className="mt-2.5 pt-2 border-t border-slate-200">
					<div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
						<CheckCircle2 className="h-2.5 w-2.5 text-emerald-700" />
						{evalHeaderLabel}
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
						{planning.evaluations?.map((ev) => (
							<div
								key={ev.id}
								className="p-2 rounded bg-slate-50 border border-slate-200 text-[10px]"
							>
								<div className="flex items-center justify-between font-bold text-slate-900 mb-0.5">
									<span className="text-slate-950 font-semibold">
										{ev.name || "Instrumento Avaliativo"}
									</span>
									{ev.instrumentType && (
										<span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 border border-slate-300">
											{ev.instrumentType}
										</span>
									)}
								</div>
								{ev.description && (
									<p className="text-slate-600 mb-1 leading-snug">
										{ev.description}
									</p>
								)}
								{ev.criteria && (
									<div className="text-slate-700 leading-snug whitespace-pre-wrap bg-white/70 p-1.5 rounded border border-slate-200 text-[9.5px]">
										{ev.criteria}
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			),
		});
	}

	// Seções de texto longo ordenadas dinamicamente
	for (const item of longDynamicItems) {
		macroSections.push({
			id: `macro-long-${item.spec.id}`,
			order: item.spec.order ?? 12,
			content: (
				<div className="mt-2.5 pt-2 border-t border-slate-200">
					<div className="p-2 rounded bg-slate-50 border border-slate-200 text-[10px]">
						<span className="font-bold text-slate-800 block mb-1">
							{item.spec.customLabel || item.spec.colName}:
						</span>
						<span className="text-slate-700 leading-snug block whitespace-pre-wrap">
							{item.value}
						</span>
					</div>
				</div>
			),
		});
	}

	// Ordena seções macro pelo spec.order
	macroSections.sort((a, b) => a.order - b.order);

	return (
		<div className="border-b-2 border-slate-800 pb-3 mb-4 text-slate-900">
			{/* Top Header Institucional estilo Documento A4 */}
			<div className="flex items-start justify-between border-b border-slate-300 pb-2 mb-3">
				<div>
					<h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-950 font-serif">
						{documentTitle}
					</h2>
					{documentSubtitle && (
						<p className="text-[11px] text-slate-600 mt-0.5">
							{documentSubtitle}
						</p>
					)}
				</div>
				{planning.granularity && (
					<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-800">
						<Layers className="h-2.5 w-2.5 text-slate-700" />
						{formatGranularity(planning.granularity)}
					</span>
				)}
			</div>

			{/* Grid Dinâmico de Metadados: reordenável de acordo com spec.order */}
			{gridItems.length > 0 && (
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/90 p-2.5 rounded-xs border border-slate-200 text-[11px]">
					{gridItems.map((item) => (
						<div key={item.id}>
							<span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
								{item.icon}
								<span>{item.label}</span>
							</span>
							<span className="font-semibold text-slate-900 leading-tight block truncate">
								{item.value}
							</span>
						</div>
					))}
				</div>
			)}

			{/* Seções Macro Inferiores Ordenadas Dinamicamente (BNCC, Avaliações, Textos Longos) */}
			{macroSections.map((section) => (
				<div key={section.id}>{section.content}</div>
			))}
		</div>
	);
}
