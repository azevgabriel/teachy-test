import { formatBlockDateRange, formatBlockUnit } from "./PlanningTable";
import type {
	PlanningAggregate,
	PlanningBlockWithRelations,
	Specification,
} from "./types";

export type PageOrientation = "portrait" | "landscape";

export interface PageItem {
	id: string;
	type: "header" | "section-title" | "table-chunk";
	parentBlock?: PlanningBlockWithRelations;
	blocks?: PlanningBlockWithRelations[];
	isContinuation?: boolean;
	title?: string;
	breadcrumbs?: string[];
	dateRange?: string;
}

export interface PageData {
	pageNumber: number;
	items: PageItem[];
}

/**
 * Dimensões físicas e alturas exatas medidas no DOM para diagramação A4.
 */
export interface MeasuredHeights {
	headerHeight: number;
	runningHeaderHeight: number;
	sectionTitleHeight: number;
	tableHeaderHeight: number;
	tableContainerMargin: number;
	footerHeight: number;
	paddingY: number;
	sheetHeight: number;
	rowHeights: Record<string, number>;
}

/**
 * Estima a altura real do cabeçalho institucional macro.
 * Considera a orientação e as especificações visíveis (isVisible !== false).
 */
function estimateHeaderCost(
	planning: PlanningAggregate,
	specificationsOrOrientation?: Specification[] | PageOrientation,
	maybeOrientation: PageOrientation = "portrait",
): number {
	const isOrientationArg = typeof specificationsOrOrientation === "string";
	const orientation: PageOrientation = isOrientationArg
		? (specificationsOrOrientation as PageOrientation)
		: maybeOrientation;
	const specifications: Specification[] = Array.isArray(
		specificationsOrOrientation,
	)
		? specificationsOrOrientation
		: [];

	const isLandscape = orientation === "landscape";

	// 1. Top Header institucional (Título + subtítulo opcional de ano/etapa)
	const yearSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING" &&
			["applicationyear", "ano", "etapa", "serie", "turma"].includes(
				s.colName.toLowerCase(),
			),
	);
	const showYear =
		Boolean(planning.applicationYear?.name) &&
		(yearSpec ? yearSpec.isVisible !== false : true);

	let cost = 42;
	if (showYear) {
		cost += 16;
	}

	// 2. Grid de Metadados Institucionais (Componente, Ano, Escola, Período + dinâmicos curtos)
	const componentSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING" &&
			["curricularcomponents", "componente", "disciplina", "materia"].includes(
				s.colName.toLowerCase(),
			),
	);
	const showComponent =
		(planning.curricularComponents?.length || 0) > 0 &&
		(componentSpec ? componentSpec.isVisible !== false : true);

	const schoolSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING" &&
			["school", "escola", "instituicao", "rede"].includes(
				s.colName.toLowerCase(),
			),
	);
	const showSchool =
		Boolean(planning.school?.name) &&
		(schoolSpec ? schoolSpec.isVisible !== false : true);

	const periodSpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING" &&
			["periodo", "period", "datas", "cronograma"].includes(
				s.colName.toLowerCase(),
			),
	);
	const hasPeriod = Boolean(planning.startAt || planning.endAt);
	const showPeriod =
		hasPeriod && (periodSpec ? periodSpec.isVisible !== false : true);

	const headerMetadata = planning.metadataValues || [];
	const nativeColNames = [
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
	];

	let shortDynamicCount = 0;
	let longDynamicCount = 0;

	for (const spec of specifications) {
		if (spec.tableRef !== "PLANNING") continue;
		if (spec.isVisible === false) continue;
		if (nativeColNames.includes(spec.colName.toLowerCase())) continue;

		const meta = headerMetadata.find(
			(m) =>
				m.specificationId === spec.id ||
				m.specification?.colName.toLowerCase() === spec.colName.toLowerCase(),
		);
		const val = meta?.textValue?.trim();
		if (val) {
			if (val.length > 50 || val.includes("\n")) {
				longDynamicCount += 1;
			} else {
				shortDynamicCount += 1;
			}
		}
	}

	const gridItemCount =
		(showComponent ? 1 : 0) +
		(showYear ? 1 : 0) +
		(showSchool ? 1 : 0) +
		(showPeriod ? 1 : 0) +
		shortDynamicCount;

	if (gridItemCount > 0) {
		const colsPerRow = 4;
		const rows = Math.ceil(gridItemCount / colsPerRow);
		cost += 20 + rows * (isLandscape ? 36 : 42);
	}

	// 3. Habilidades BNCC Gerais (Macro) - respeita isVisible
	const bnccSpec = specifications.find(
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
	const showBncc = bnccSpec ? bnccSpec.isVisible !== false : true;
	const bnccCount = showBncc ? planning.learningObjectives?.length || 0 : 0;
	if (bnccCount > 0) {
		const badgesPerRow = isLandscape ? 7 : 4;
		const bnccRows = Math.ceil(bnccCount / badgesPerRow);
		cost += 24 + bnccRows * 22;
	}

	// 4. Avaliações Macro do Planejamento (planning.evaluations) - respeita isVisible
	const evalSpec = specifications.find(
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
	const showEval = evalSpec ? evalSpec.isVisible !== false : true;
	const evalCount = showEval ? planning.evaluations?.length || 0 : 0;
	if (evalCount > 0) {
		cost += 24 + Math.ceil(evalCount / 2) * (isLandscape ? 60 : 70);
	}

	// 5. Seções Dinâmicas de Texto Longo
	if (longDynamicCount > 0) {
		cost += longDynamicCount * 50;
	}

	// Margem de separação pb-3 mb-4
	cost += 16;

	return cost;
}

/**
 * Estima a altura real que uma linha da tabela consumirá (<tr>).
 * Considera as colunas ativas e visíveis (isVisible !== false).
 */
function estimateRowWeight(
	block: PlanningBlockWithRelations,
	specificationsOrOrientation?: Specification[] | PageOrientation,
	maybeOrientation: PageOrientation = "portrait",
): number {
	const isOrientationArg = typeof specificationsOrOrientation === "string";
	const orientation: PageOrientation = isOrientationArg
		? (specificationsOrOrientation as PageOrientation)
		: maybeOrientation;
	const specifications: Specification[] = Array.isArray(
		specificationsOrOrientation,
	)
		? specificationsOrOrientation
		: [];

	const isLandscape = orientation === "landscape";
	const basePadding = 16;

	// Coluna 1: Ordem / Identificação (respeita isVisible)
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
	const showOrder = orderSpec ? orderSpec.isVisible !== false : true;

	// Coluna 2: Metodologia / Sequência Didática (respeita isVisible)
	const methodologySpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING_BLOCK" &&
			s.colName.toLowerCase() === "metodologia",
	);
	const showMethodology = methodologySpec
		? methodologySpec.isVisible !== false
		: Boolean(block.metodologia?.trim());

	const metLen = showMethodology ? block.metodologia?.length || 0 : 0;
	const charsPerLineMet = isLandscape ? 40 : 25;
	const metLines = Math.ceil(metLen / charsPerLineMet);
	const metHeight = metLines * 16;

	// Colunas Dinâmicas EAV (apenas as visíveis)
	const charsPerLineMv = isLandscape ? 30 : 20;
	let maxMvHeight = 0;
	for (const mv of block.metadataValues || []) {
		const spec = specifications.find(
			(s) =>
				s.id === mv.specificationId ||
				s.colName.toLowerCase() === mv.specification?.colName.toLowerCase(),
		);
		if (spec && spec.isVisible === false) continue;

		const text = mv.textValue || "";
		if (text) {
			const lines = Math.ceil(text.length / charsPerLineMv);
			const h = lines * 16;
			if (h > maxMvHeight) maxMvHeight = h;
		}
	}

	// Coluna 3: Habilidades BNCC (respeita isVisible)
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
	const showBncc = bnccSpec
		? bnccSpec.isVisible !== false
		: Boolean(block.learningObjectives && block.learningObjectives.length > 0);
	const bnccCount = showBncc ? block.learningObjectives?.length || 0 : 0;
	const bnccHeight = isLandscape
		? Math.ceil(bnccCount / 2) * 20
		: bnccCount * 20;

	// Coluna 4: Avaliações (respeita isVisible)
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
	const showEval = evalSpec
		? evalSpec.isVisible !== false
		: Boolean(block.evaluations && block.evaluations.length > 0);
	const evalCount = showEval ? block.evaluations?.length || 0 : 0;
	const evalHeight = evalCount * 36;

	// Altura máxima entre as colunas
	const maxContentHeight = Math.max(
		showOrder ? 32 : 0,
		metHeight,
		maxMvHeight,
		bnccHeight,
		evalHeight,
		24,
	);

	return Math.round(basePadding + maxContentHeight + 8);
}

const SECTION_TITLE_COST = 36;
const TABLE_HEADER_COST = 38;
const TABLE_CONTAINER_MARGIN = 14;

interface BlockTreeNode {
	block: PlanningBlockWithRelations;
	children: BlockTreeNode[];
	depth: number;
	ancestorPath: PlanningBlockWithRelations[];
}

function buildBlockForest(
	blocks: PlanningBlockWithRelations[],
): BlockTreeNode[] {
	const nodeMap = new Map<string, BlockTreeNode>();
	for (const b of blocks) {
		nodeMap.set(b.id, {
			block: b,
			children: [],
			depth: 0,
			ancestorPath: [],
		});
	}

	const roots: BlockTreeNode[] = [];

	for (const b of blocks) {
		const node = nodeMap.get(b.id);
		if (!node) continue;
		if (b.parentId) {
			const parentNode = nodeMap.get(b.parentId);
			if (parentNode) {
				parentNode.children.push(node);
			} else {
				roots.push(node);
			}
		} else {
			roots.push(node);
		}
	}

	function setupNode(
		node: BlockTreeNode,
		depth: number,
		ancestors: PlanningBlockWithRelations[],
	) {
		node.depth = depth;
		node.ancestorPath = ancestors;
		node.children.sort((a, b) => {
			const orderA = a.block.order ?? 0;
			const orderB = b.block.order ?? 0;
			if (orderA !== orderB) return orderA - orderB;
			const startA = a.block.startAt ?? "";
			const startB = b.block.startAt ?? "";
			return startA.localeCompare(startB);
		});

		for (const child of node.children) {
			setupNode(child, depth + 1, [...ancestors, node.block]);
		}
	}

	roots.sort((a, b) => {
		const orderA = a.block.order ?? 0;
		const orderB = b.block.order ?? 0;
		if (orderA !== orderB) return orderA - orderB;
		const startA = a.block.startAt ?? "";
		const startB = b.block.startAt ?? "";
		return startA.localeCompare(startB);
	});

	for (const root of roots) {
		setupNode(root, 0, []);
	}

	return roots;
}

interface HierarchicalSection {
	id: string;
	parentBlock?: PlanningBlockWithRelations;
	title: string;
	breadcrumbs: string[];
	dateRange: string;
	blocks: PlanningBlockWithRelations[];
}

function collectHierarchicalSections(
	roots: BlockTreeNode[],
	orderSpec?: Specification | null,
): HierarchicalSection[] {
	const sections: HierarchicalSection[] = [];

	function processNode(node: BlockTreeNode, nodeIndex: number = 0) {
		const leafChildren: PlanningBlockWithRelations[] = [];
		const branchChildren: BlockTreeNode[] = [];

		for (const child of node.children) {
			if (child.children.length === 0) {
				leafChildren.push(child.block);
			} else {
				branchChildren.push(child);
			}
		}

		if (leafChildren.length === 0 && branchChildren.length === 0) {
			const title = formatBlockUnit(
				node.block,
				nodeIndex,
				orderSpec?.customLabel,
			);
			const breadcrumbs = node.ancestorPath.map((anc, ancIdx) =>
				formatBlockUnit(anc, ancIdx, orderSpec?.customLabel),
			);
			const dateRange = formatBlockDateRange(
				node.block.startAt,
				node.block.endAt,
			);

			sections.push({
				id: `sec-${node.block.id}`,
				parentBlock: node.block,
				title,
				breadcrumbs,
				dateRange,
				blocks: [node.block],
			});
			return;
		}

		if (leafChildren.length > 0) {
			const title = formatBlockUnit(
				node.block,
				nodeIndex,
				orderSpec?.customLabel,
			);
			const breadcrumbs = node.ancestorPath.map((anc, ancIdx) =>
				formatBlockUnit(anc, ancIdx, orderSpec?.customLabel),
			);
			const dateRange = formatBlockDateRange(
				node.block.startAt,
				node.block.endAt,
			);

			sections.push({
				id: `sec-${node.block.id}`,
				parentBlock: node.block,
				title,
				breadcrumbs,
				dateRange,
				blocks: leafChildren,
			});
		}

		for (let branchIdx = 0; branchIdx < branchChildren.length; branchIdx++) {
			processNode(branchChildren[branchIdx], branchIdx);
		}
	}

	for (let rootIdx = 0; rootIdx < roots.length; rootIdx++) {
		const root = roots[rootIdx];
		if (root.children.length === 0) {
			const title = formatBlockUnit(
				root.block,
				rootIdx,
				orderSpec?.customLabel,
			);
			const dateRange = formatBlockDateRange(
				root.block.startAt,
				root.block.endAt,
			);
			sections.push({
				id: `sec-${root.block.id}`,
				parentBlock: root.block,
				title,
				breadcrumbs: [],
				dateRange,
				blocks: [root.block],
			});
		} else {
			processNode(root, rootIdx);
		}
	}

	return sections;
}

export function paginatePlanning(
	planning: PlanningAggregate | null,
	specificationsOrOrientation?: Specification[] | PageOrientation,
	maybeOrientationOrMeasured?: PageOrientation | MeasuredHeights | null,
	maybeMeasuredHeights?: MeasuredHeights | null,
): PageData[] {
	if (!planning) {
		return [{ pageNumber: 1, items: [] }];
	}

	let orientation: PageOrientation = "portrait";
	let specifications: Specification[] = [];
	let measuredHeights: MeasuredHeights | null = null;

	if (typeof specificationsOrOrientation === "string") {
		orientation = specificationsOrOrientation as PageOrientation;
		if (
			maybeOrientationOrMeasured &&
			typeof maybeOrientationOrMeasured === "object"
		) {
			measuredHeights = maybeOrientationOrMeasured as MeasuredHeights;
		}
	} else {
		if (Array.isArray(specificationsOrOrientation)) {
			specifications = specificationsOrOrientation;
		}
		if (typeof maybeOrientationOrMeasured === "string") {
			orientation = maybeOrientationOrMeasured as PageOrientation;
		}
		if (maybeMeasuredHeights && typeof maybeMeasuredHeights === "object") {
			measuredHeights = maybeMeasuredHeights;
		}
	}

	const isLandscape = orientation === "landscape";
	const sheetHeight =
		measuredHeights?.sheetHeight ?? (isLandscape ? 794 : 1123);
	const paddingY = measuredHeights?.paddingY ?? (isLandscape ? 56 : 80);
	const footerHeight = measuredHeights?.footerHeight ?? 46;
	const runningHeaderHeight = measuredHeights?.runningHeaderHeight ?? 40;

	// Capacidade útil real (subtraindo padding da folha e rodapé fixo)
	const usablePageHeight = sheetHeight - paddingY - footerHeight;
	const subsequentPageUsable = usablePageHeight - runningHeaderHeight;

	const blocks = planning.blocks || [];
	const headerCost =
		measuredHeights?.headerHeight ??
		estimateHeaderCost(planning, specifications, orientation);
	const sectionTitleCost =
		measuredHeights?.sectionTitleHeight ?? SECTION_TITLE_COST;
	const tableHeaderCost =
		measuredHeights?.tableHeaderHeight ?? TABLE_HEADER_COST;
	const tableContainerMargin =
		measuredHeights?.tableContainerMargin ?? TABLE_CONTAINER_MARGIN;

	const pages: PageData[] = [];
	let currentPageNumber = 1;
	let currentBudget = usablePageHeight - headerCost;
	let currentItems: PageItem[] = [{ id: "macro-header-item", type: "header" }];

	function startNewPage() {
		pages.push({ pageNumber: currentPageNumber, items: currentItems });
		currentPageNumber += 1;
		currentBudget = subsequentPageUsable;
		currentItems = [];
	}

	function getRowWeight(block: PlanningBlockWithRelations): number {
		if (measuredHeights?.rowHeights?.[block.id]) {
			return Math.ceil(measuredHeights.rowHeights[block.id]);
		}
		return estimateRowWeight(block, specifications, orientation);
	}

	// Se o cabeçalho macro consumir quase a folha toda a ponto de não caber nem 1 linha
	if (blocks.length > 0) {
		const firstRowCost = getRowWeight(blocks[0]);
		const minTableCost = tableHeaderCost + tableContainerMargin + firstRowCost;
		if (currentBudget < minTableCost && currentItems.length > 0) {
			startNewPage();
		}
	}

	if (blocks.length === 0) {
		pages.push({ pageNumber: 1, items: currentItems });
		return pages;
	}

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

	const methodologySpec = specifications.find(
		(s) =>
			s.tableRef === "PLANNING_BLOCK" &&
			s.colName.toLowerCase() === "metodologia",
	);
	const showMethodology = methodologySpec
		? methodologySpec.isVisible !== false
		: true;

	const forest = buildBlockForest(blocks);
	const isEntirelyFlat = forest.every((node) => node.children.length === 0);

	if (!isEntirelyFlat) {
		// Estrutura hierárquica recursiva (suporta descida infinita: Anual -> Semestre -> Bimestre -> Mensal -> Semanal -> Diário)
		const sections = collectHierarchicalSections(forest, orderSpec);

		for (let sIdx = 0; sIdx < sections.length; sIdx += 1) {
			const section = sections[sIdx];
			const targetBlocks = section.blocks;

			const hasBreadcrumbs = section.breadcrumbs.length > 0;
			const hasParentMet =
				showMethodology && Boolean(section.parentBlock?.metodologia);
			const hasParentMetas = Boolean(
				section.parentBlock?.metadataValues?.some((m) => Boolean(m.textValue)),
			);
			const effectiveSectionTitleCost =
				sectionTitleCost +
				(hasBreadcrumbs ? 14 : 0) +
				(hasParentMet ? 24 : 0) +
				(hasParentMetas ? 22 : 0);

			let blockIndex = 0;
			let isContinuation = false;
			let partNum = 1;

			while (blockIndex < targetBlocks.length) {
				const firstWeight = getRowWeight(targetBlocks[blockIndex]);
				const neededForHeaderAndRow =
					effectiveSectionTitleCost +
					tableHeaderCost +
					tableContainerMargin +
					firstWeight;

				// Só avança para uma nova folha se esta folha já tem itens E não cabe o início da seção
				if (currentBudget < neededForHeaderAndRow && currentItems.length > 0) {
					startNewPage();
				}

				// Adiciona título da seção com breadcrumbs dinâmicos
				currentItems.push({
					id: `sec-${section.id}-p${partNum}`,
					type: "section-title",
					parentBlock: section.parentBlock,
					title: isContinuation
						? `${section.title} (Continuação)`
						: section.title,
					breadcrumbs: section.breadcrumbs,
					dateRange: section.dateRange,
					isContinuation,
				});
				currentBudget -=
					effectiveSectionTitleCost + tableHeaderCost + tableContainerMargin;

				// Agrupa todas as linhas que cabem estritamente nesta folha
				const chunkBlocks: PlanningBlockWithRelations[] = [];
				while (blockIndex < targetBlocks.length) {
					const block = targetBlocks[blockIndex];
					const weight = getRowWeight(block);

					// A folha só é interrompida quando a próxima linha ultrapassa os limites da margem
					if (currentBudget >= weight || chunkBlocks.length === 0) {
						chunkBlocks.push(block);
						currentBudget -= weight;
						blockIndex += 1;
					} else {
						break;
					}
				}

				currentItems.push({
					id: `chunk-${section.id}-p${partNum}`,
					type: "table-chunk",
					parentBlock: section.parentBlock,
					blocks: chunkBlocks,
					isContinuation,
				});

				isContinuation = true;
				partNum += 1;

				// Se ainda restam blocos nesta seção que não couberam, avança para folha nova
				if (blockIndex < targetBlocks.length) {
					startNewPage();
				}
			}
		}
	} else {
		// Estrutura plana contínua (ex: Semanal -> Diário direto sem subdivisão intermediária)
		const sortedBlocks = forest.map((node) => node.block);

		let blockIndex = 0;
		let isContinuation = false;
		let partNum = 1;

		while (blockIndex < sortedBlocks.length) {
			const firstWeight = getRowWeight(sortedBlocks[blockIndex]);
			const neededForTableAndRow =
				tableHeaderCost + tableContainerMargin + firstWeight;

			// Só cria nova folha se a folha atual já possui conteúdo e não cabe a primeira linha
			if (currentBudget < neededForTableAndRow && currentItems.length > 0) {
				startNewPage();
			}

			currentBudget -= tableHeaderCost + tableContainerMargin;
			const chunkBlocks: PlanningBlockWithRelations[] = [];

			while (blockIndex < sortedBlocks.length) {
				const block = sortedBlocks[blockIndex];
				const weight = getRowWeight(block);

				// Preenche a folha completamente até o limite físico da margem
				if (currentBudget >= weight || chunkBlocks.length === 0) {
					chunkBlocks.push(block);
					currentBudget -= weight;
					blockIndex += 1;
				} else {
					break;
				}
			}

			currentItems.push({
				id: `flat-chunk-p${partNum}`,
				type: "table-chunk",
				blocks: chunkBlocks,
				isContinuation,
			});

			isContinuation = true;
			partNum += 1;

			// Uma folha anterior só fecha se ainda houver blocos excedentes que não couberam
			if (blockIndex < sortedBlocks.length) {
				startNewPage();
			}
		}
	}

	if (currentItems.length > 0) {
		pages.push({ pageNumber: currentPageNumber, items: currentItems });
	}

	return pages;
}
