import { Calendar, CheckCircle2, HelpCircle, Sparkles } from "lucide-react";
import type { PlanningBlockWithRelations, Specification } from "./types";

function formatDate(dateStr?: string | null): string {
	if (!dateStr) return "";
	try {
		const d = new Date(dateStr);
		return d.toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "2-digit",
		});
	} catch {
		return dateStr;
	}
}

function formatBlockDateRange(
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

interface PlanningTableChunkProps {
	blocks: PlanningBlockWithRelations[];
	specifications: Specification[];
	allBlocks?: PlanningBlockWithRelations[];
}

export function PlanningTableChunk({
	blocks,
	specifications,
	allBlocks,
}: PlanningTableChunkProps) {
	const dataset = allBlocks && allBlocks.length > 0 ? allBlocks : blocks;

	// 1. Identificação / Ordem / Data
	const orderSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING_BLOCK" &&
			["order", "aula", "aulas", "data", "datas"].includes(
				s.colName.toLowerCase(),
			),
	);
	const orderLabel =
		orderSpec?.customLabel || orderSpec?.colName || "Aula / Data";

	// 2. Metodologia: renderiza se houver dados em algum bloco ou se houver especificação cadastrada
	const methodologySpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING_BLOCK" &&
			s.colName.toLowerCase() === "metodologia",
	);
	const hasMethodology = dataset.some((b) => Boolean(b.metodologia?.trim()));
	const showMethodology = hasMethodology || Boolean(methodologySpec);
	const methodologyLabel =
		methodologySpec?.customLabel ||
		methodologySpec?.colName ||
		"Sequência Didática";

	// 3. Habilidades BNCC: renderiza se houver habilidades vinculadas ou se houver especificação
	const bnccSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING_BLOCK" &&
			[
				"learningobjectives",
				"habilidades_bncc",
				"bncc",
				"habilidades",
			].includes(s.colName.toLowerCase()),
	);
	const hasLearningObjectives = dataset.some(
		(b) => b.learningObjectives && b.learningObjectives.length > 0,
	);
	const showBncc = hasLearningObjectives || Boolean(bnccSpec);
	const bnccLabel =
		bnccSpec?.customLabel || bnccSpec?.colName || "Habilidades BNCC";

	// 4. Avaliações: renderiza APENAS se houver avaliações cadastradas ou especificação explícita
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
	const showEvaluations = hasEvaluations || Boolean(evalSpec);
	const evalLabel = evalSpec?.customLabel || evalSpec?.colName || "Avaliação";

	// 5. Colunas Dinâmicas EAV (excluindo overrides de colunas físicas/nativas)
	const dynamicBlockSpecs = specifications.filter(
		(s) =>
			s.tableRef === "PLANNING_BLOCK" &&
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
			].includes(s.colName.toLowerCase()),
	);

	return (
		<div className="w-full overflow-x-auto border border-slate-300 rounded-xs mb-3">
			<table className="w-full border-collapse text-left text-[11px] text-slate-900">
				<thead>
					<tr className="bg-slate-100 border-b border-slate-300 text-slate-950 font-bold">
						{/* 1. Aula / Data */}
						<th className="p-2 w-20 border-r border-slate-300">{orderLabel}</th>

						{/* 2. Metodologia (Dinâmica) */}
						{showMethodology && (
							<th className="p-2 min-w-[140px] border-r border-slate-300">
								{methodologyLabel}
							</th>
						)}

						{/* 3. BNCC (Dinâmica) */}
						{showBncc && (
							<th className="p-2 w-28 border-r border-slate-300">
								{bnccLabel}
							</th>
						)}

						{/* 4. Avaliação (Omitida caso não haja avaliações) */}
						{showEvaluations && (
							<th className="p-2 w-28 border-r border-slate-300">
								{evalLabel}
							</th>
						)}

						{/* 5. Colunas Dinâmicas EAV definidas pelo usuário */}
						{dynamicBlockSpecs.map((spec) => (
							<th
								key={spec.id}
								className="p-2 min-w-[110px] border-r border-slate-300 last:border-r-0"
							>
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
							</th>
						))}
					</tr>
				</thead>

				<tbody className="divide-y divide-slate-200 bg-white">
					{blocks.map((block, idx) => {
						const dateStr = formatBlockDateRange(block.startAt, block.endAt);
						const label = `Aula ${block.order !== undefined ? block.order + 1 : idx + 1}`;

						return (
							<tr
								key={block.id}
								className="transition-colors hover:bg-slate-50/80"
							>
								{/* 1. Aula / Data */}
								<td className="p-2 align-top border-r border-slate-200 font-semibold">
									<div className="text-slate-950 font-bold">{label}</div>
									{dateStr ? (
										<div className="text-[10px] text-slate-600 font-medium flex items-center gap-0.5 mt-0.5">
											<Calendar className="h-2.5 w-2.5 text-slate-400" />
											{dateStr}
										</div>
									) : (
										<div className="text-[10px] text-slate-400 italic">
											Sem data
										</div>
									)}
								</td>

								{/* 2. Metodologia / Sequência Didática */}
								{showMethodology && (
									<td className="p-2 align-top border-r border-slate-200 text-slate-900 leading-snug whitespace-pre-wrap">
										{block.metodologia || (
											<span className="text-slate-400 italic">
												Metodologia em elaboração...
											</span>
										)}
									</td>
								)}

								{/* 3. Habilidades BNCC do Bloco */}
								{showBncc && (
									<td className="p-2 align-top border-r border-slate-200">
										<div className="flex flex-wrap gap-1">
											{block.learningObjectives &&
											block.learningObjectives.length > 0 ? (
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
												<span className="text-[10px] text-slate-400 italic">
													—
												</span>
											)}
										</div>
									</td>
								)}

								{/* 4. Avaliações do Bloco (apenas se existir coluna) */}
								{showEvaluations && (
									<td className="p-2 align-top border-r border-slate-200">
										<div className="flex flex-col gap-1">
											{block.evaluations && block.evaluations.length > 0 ? (
												block.evaluations.map((ev) => (
													<div
														key={ev.id}
														className="p-1 rounded bg-slate-50 border border-slate-300 text-[10px] text-slate-900"
													>
														<div className="font-bold text-slate-950 flex items-center gap-1">
															<CheckCircle2 className="h-2.5 w-2.5 text-emerald-700" />
															<span>
																{ev.name || ev.instrumentType || "Avaliação"}
															</span>
														</div>
														{ev.criteria && (
															<div className="text-[9px] text-slate-600 line-clamp-2 mt-0.5">
																{ev.criteria}
															</div>
														)}
													</div>
												))
											) : (
												<span className="text-[10px] text-slate-400 italic">
													—
												</span>
											)}
										</div>
									</td>
								)}

								{/* 5. Colunas Dinâmicas EAV */}
								{dynamicBlockSpecs.map((spec) => {
									const meta = block.metadataValues?.find(
										(m) =>
											m.specificationId === spec.id ||
											m.specification?.colName === spec.colName,
									);
									const val = meta?.textValue;

									return (
										<td
											key={spec.id}
											className="p-2 align-top border-r border-slate-200 last:border-r-0 text-slate-900 leading-snug"
										>
											{val || <span className="text-slate-400 italic">—</span>}
										</td>
									);
								})}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

interface SectionDividerProps {
	title: string;
	dateRange?: string;
	isContinuation?: boolean;
}

export function SectionDivider({
	title,
	dateRange,
	isContinuation,
}: SectionDividerProps) {
	return (
		<div className="flex items-center justify-between pb-1 mb-2 border-b-2 border-slate-800 text-slate-900">
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
	);
}
