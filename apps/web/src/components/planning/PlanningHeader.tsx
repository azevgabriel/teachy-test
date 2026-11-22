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
		const d = new Date(dateStr);
		return d.toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});
	} catch {
		return dateStr;
	}
}

export function PlanningHeader({
	planning,
	specifications,
}: PlanningHeaderProps) {
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

	const documentSubtitle = planning.applicationYear?.name || null;

	const periodText =
		planning.startAt && planning.endAt
			? `${formatDate(planning.startAt)} a ${formatDate(planning.endAt)}`
			: planning.startAt
				? `A partir de ${formatDate(planning.startAt)}`
				: null;

	// Separa especificações dinâmicas entre curtas (cabem no grid superior) e longas (caixas de texto descritivo)
	const dynamicHeaderItems: Array<{
		id: string;
		label: string;
		value: string;
		isLong: boolean;
	}> = [];

	for (const spec of headerSpecs) {
		const isNativeOverride = [
			"curricularcomponents",
			"componente",
			"applicationyear",
			"ano",
			"school",
			"escola",
			"startat",
			"endat",
			"periodo",
			"period",
			"learningobjectives",
			"bncc",
			"evaluations",
			"avaliacao",
			"avaliacoes",
		].includes(spec.colName.toLowerCase());

		if (isNativeOverride) continue;

		const meta = headerMetadata.find(
			(m) =>
				m.specificationId === spec.id ||
				m.specification?.colName === spec.colName,
		);
		const value = meta?.textValue?.trim();
		if (value) {
			dynamicHeaderItems.push({
				id: spec.id,
				label: spec.customLabel || spec.colName,
				value,
				isLong: value.length > 50 || value.includes("\n"),
			});
		}
	}

	const shortDynamicItems = dynamicHeaderItems.filter((i) => !i.isLong);
	const longDynamicItems = dynamicHeaderItems.filter((i) => i.isLong);

	const hasComponents = (planning.curricularComponents?.length || 0) > 0;
	const hasYear = Boolean(planning.applicationYear?.name);
	const hasSchool = Boolean(planning.school?.name);
	const hasPeriod = Boolean(periodText);

	const gridItemsCount =
		(hasComponents ? 1 : 0) +
		(hasYear ? 1 : 0) +
		(hasSchool ? 1 : 0) +
		(hasPeriod ? 1 : 0) +
		shortDynamicItems.length;

	const bnccHeaderLabel =
		bnccHeaderSpec?.customLabel ||
		bnccHeaderSpec?.colName ||
		"Habilidades BNCC";

	const evalHeaderLabel =
		evalHeaderSpec?.customLabel ||
		evalHeaderSpec?.colName ||
		"Avaliação da Aprendizagem";

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

			{/* Grid Dinâmico de Metadados: apenas campos informados ou com especificações */}
			{gridItemsCount > 0 && (
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/90 p-2.5 rounded-xs border border-slate-200 text-[11px]">
					{hasComponents && (
						<div>
							<span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
								<BookOpen className="h-2.5 w-2.5 text-emerald-700" />
								{componentSpec?.customLabel ||
									componentSpec?.colName ||
									"Componente"}
							</span>
							<span className="font-semibold text-slate-900 leading-tight block">
								{planning.curricularComponents?.map((c) => c.name).join(", ")}
							</span>
						</div>
					)}

					{hasYear && (
						<div>
							<span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
								<GraduationCap className="h-2.5 w-2.5 text-emerald-700" />
								{yearSpec?.customLabel || yearSpec?.colName || "Ano / Etapa"}
							</span>
							<span className="font-semibold text-slate-900 leading-tight block">
								{planning.applicationYear?.name}
							</span>
						</div>
					)}

					{hasSchool && (
						<div>
							<span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
								<SchoolIcon className="h-2.5 w-2.5 text-slate-600" />
								{schoolSpec?.customLabel || schoolSpec?.colName || "Escola"}
							</span>
							<span className="font-semibold text-slate-900 truncate block leading-tight">
								{planning.school?.name}
							</span>
						</div>
					)}

					{hasPeriod && (
						<div>
							<span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
								<Calendar className="h-2.5 w-2.5 text-slate-600" />
								{periodSpec?.customLabel || periodSpec?.colName || "Período"}
							</span>
							<span className="font-semibold text-slate-900 leading-tight block">
								{periodText}
							</span>
						</div>
					)}

					{shortDynamicItems.map((item) => (
						<div key={item.id}>
							<span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
								{item.label}
							</span>
							<span className="font-semibold text-slate-900 leading-tight block">
								{item.value}
							</span>
						</div>
					))}
				</div>
			)}

			{/* Habilidades BNCC do Ciclo Macro (nome extraído da especificação ou da coluna de planning) */}
			{planning.learningObjectives &&
				planning.learningObjectives.length > 0 && (
					<div className="mt-3 pt-2.5 border-t border-slate-200">
						<div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
							<Sparkles className="h-2.5 w-2.5 text-amber-600" />
							{bnccHeaderLabel}
						</div>
						<div className="flex flex-wrap gap-1">
							{planning.learningObjectives.map((obj) => {
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
				)}

			{/* Avaliações Associadas ao Macro Planejamento (Planning) */}
			{planning.evaluations && planning.evaluations.length > 0 && (
				<div className="mt-2.5 pt-2 border-t border-slate-200">
					<div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
						<CheckCircle2 className="h-2.5 w-2.5 text-emerald-700" />
						{evalHeaderLabel}
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
						{planning.evaluations.map((ev) => (
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
			)}

			{/* Metadados Customizados do Cabeçalho com Texto Longo/Formatado */}
			{longDynamicItems.length > 0 && (
				<div className="mt-2.5 pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
					{longDynamicItems.map((item) => (
						<div
							key={item.id}
							className="p-2 rounded bg-slate-50 border border-slate-200 text-[10px]"
						>
							<span className="font-bold text-slate-800 block mb-1">
								{item.label}:
							</span>
							<span className="text-slate-700 leading-snug block whitespace-pre-wrap">
								{item.value}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
