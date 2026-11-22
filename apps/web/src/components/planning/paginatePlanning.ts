import { formatGranularity } from "./PlanningHeader";
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
	dateRange?: string;
}

export interface PageData {
	pageNumber: number;
	items: PageItem[];
}

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

/**
 * Estima a altura real do cabeçalho institucional macro.
 * Considera a orientação: em modo Paisagem (largura ~1123px), os metadados e badges
 * se distribuem em mais colunas horizontais, reduzindo a altura vertical consumida.
 */
function estimateHeaderCost(
	planning: PlanningAggregate,
	specifications: Specification[],
	orientation: PageOrientation = "portrait",
): number {
	const isLandscape = orientation === "landscape";
	let cost = isLandscape ? 140 : 165;

	// Habilidades BNCC Gerais (Macro)
	const bnccCount = planning.learningObjectives?.length || 0;
	if (bnccCount > 0) {
		const badgesPerRow = isLandscape ? 7 : 4;
		const bnccRows = Math.ceil(bnccCount / badgesPerRow);
		cost += 25 + bnccRows * 26;
	}

	// Metadados do Cabeçalho (tableRef === PLANNING)
	const macroSpecs = specifications.filter((s) => s.tableRef === "PLANNING");
	if (macroSpecs.length > 0) {
		const colsPerRow = isLandscape ? 3 : 2;
		const specRows = Math.ceil(macroSpecs.length / colsPerRow);
		cost += 25 + specRows * (isLandscape ? 45 : 55);
	}

	// Avaliações Macro do Planejamento (planning.evaluations)
	const evalCount = planning.evaluations?.length || 0;
	if (evalCount > 0) {
		cost += 25 + evalCount * (isLandscape ? 75 : 90);
	}

	// Margem de separação pb-3 mb-4
	cost += 20;

	return cost;
}

/**
 * Estima a altura real que uma linha da tabela consumirá (<tr>).
 * Em modo Paisagem, as colunas são muito mais largas (~220px para metodologia e ~160px para metadados),
 * o que reduz sensivelmente o número de linhas de texto vertical e a altura total da linha.
 */
function estimateRowWeight(
	block: PlanningBlockWithRelations,
	orientation: PageOrientation = "portrait",
): number {
	const isLandscape = orientation === "landscape";
	// Padding da célula (py-2 = 16px) + bordas
	const basePadding = 24;

	// Coluna 2: Metodologia / Sequência Didática
	const metLen = block.metodologia?.length || 0;
	const charsPerLineMet = isLandscape ? 32 : 20;
	const metLines = Math.ceil(metLen / charsPerLineMet);
	const metHeight = metLines * 16;

	// Colunas Dinâmicas EAV
	const charsPerLineMv = isLandscape ? 24 : 16;
	let maxMvHeight = 0;
	for (const mv of block.metadataValues || []) {
		const text = mv.textValue || "";
		if (text) {
			const lines = Math.ceil(text.length / charsPerLineMv);
			const h = lines * 16;
			if (h > maxMvHeight) maxMvHeight = h;
		}
	}

	// Coluna 3: Habilidades BNCC (em paisagem, badges podem ficar lado a lado em 2 colunas)
	const bnccCount = block.learningObjectives?.length || 0;
	const bnccHeight = isLandscape
		? Math.ceil(bnccCount / 2) * 22
		: bnccCount * 22;

	// Coluna 4: Avaliações (~40px cada cartão)
	const evalCount = block.evaluations?.length || 0;
	const evalHeight = evalCount * 40;

	// Altura máxima entre as colunas + margem preventiva
	const maxContentHeight = Math.max(
		metHeight,
		maxMvHeight,
		bnccHeight,
		evalHeight,
		40,
	);

	return Math.round(basePadding + maxContentHeight + (isLandscape ? 16 : 20));
}

const SECTION_TITLE_COST = 36;
const TABLE_HEADER_COST = 42;

export function paginatePlanning(
	planning: PlanningAggregate | null,
	specifications: Specification[],
	orientation: PageOrientation = "portrait",
): PageData[] {
	if (!planning) {
		return [{ pageNumber: 1, items: [] }];
	}

	const isLandscape = orientation === "landscape";
	// Orçamentos verticais de altura para 96 DPI:
	// - Portrait: Total 1123px, útil ~940px / 910px
	// - Landscape: Total 794px, útil ~630px / 600px
	const usablePageHeight = isLandscape ? 630 : 940;
	const subsequentPageUsable = isLandscape ? 600 : 910;

	const blocks = planning.blocks || [];
	const headerCost = estimateHeaderCost(planning, specifications, orientation);

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

	// Se o cabeçalho institucional for extenso demais para caber ao menos 1 linha
	if (blocks.length > 0 && currentBudget < TABLE_HEADER_COST + 120) {
		startNewPage();
	}

	if (blocks.length === 0) {
		pages.push({ pageNumber: 1, items: currentItems });
		return pages;
	}

	const hasHierarchy = blocks.some(
		(b) => b.parentId !== null && b.parentId !== undefined,
	);

	if (hasHierarchy) {
		// Estrutura hierárquica (ex: Trimestral -> Mensal -> Semanal)
		const parentBlocks = blocks
			.filter((b) => !b.parentId)
			.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

		const childrenMap = new Map<string, PlanningBlockWithRelations[]>();
		for (const b of blocks) {
			if (b.parentId) {
				const list = childrenMap.get(b.parentId) || [];
				list.push(b);
				childrenMap.set(b.parentId, list);
			}
		}

		for (let pIdx = 0; pIdx < parentBlocks.length; pIdx += 1) {
			const parent = parentBlocks[pIdx];
			const children = (childrenMap.get(parent.id) || []).sort(
				(a, b) => (a.order ?? 0) - (b.order ?? 0),
			);
			const targetBlocks = children.length > 0 ? children : [parent];

			const sectionTitle = parent.granularity
				? `${formatGranularity(parent.granularity)} ${pIdx + 1}`
				: `Bloco ${pIdx + 1}`;
			const dateRange = formatBlockDateRange(parent.startAt, parent.endAt);

			let blockIndex = 0;
			let isContinuation = false;
			let partNum = 1;

			while (blockIndex < targetBlocks.length) {
				const firstWeight = estimateRowWeight(
					targetBlocks[blockIndex],
					orientation,
				);
				const neededForHeaderAndRow =
					SECTION_TITLE_COST + TABLE_HEADER_COST + firstWeight;

				if (currentBudget < neededForHeaderAndRow && currentItems.length > 0) {
					startNewPage();
				}

				// Adiciona título da seção
				currentItems.push({
					id: `sec-${parent.id}-p${partNum}`,
					type: "section-title",
					parentBlock: parent,
					title: isContinuation
						? `${sectionTitle} (Continuação)`
						: sectionTitle,
					dateRange,
					isContinuation,
				});
				currentBudget -= SECTION_TITLE_COST + TABLE_HEADER_COST;

				// Agrupa todas as linhas que cabem nesta folha
				const chunkBlocks: PlanningBlockWithRelations[] = [];
				while (blockIndex < targetBlocks.length) {
					const block = targetBlocks[blockIndex];
					const weight = estimateRowWeight(block, orientation);

					if (currentBudget >= weight || chunkBlocks.length === 0) {
						chunkBlocks.push(block);
						currentBudget -= weight;
						blockIndex += 1;
					} else {
						break;
					}
				}

				currentItems.push({
					id: `chunk-${parent.id}-p${partNum}`,
					type: "table-chunk",
					parentBlock: parent,
					blocks: chunkBlocks,
					isContinuation,
				});

				isContinuation = true;
				partNum += 1;

				// Se ainda restam blocos nesta seção, a próxima parte deve começar em folha nova
				if (blockIndex < targetBlocks.length) {
					startNewPage();
				}
			}
		}
	} else {
		// Estrutura plana (ex: Semanal -> Diário direto)
		const sortedBlocks = [...blocks].sort(
			(a, b) => (a.order ?? 0) - (b.order ?? 0),
		);

		let blockIndex = 0;
		let isContinuation = false;
		let partNum = 1;

		while (blockIndex < sortedBlocks.length) {
			const firstWeight = estimateRowWeight(
				sortedBlocks[blockIndex],
				orientation,
			);
			const neededForTableAndRow = TABLE_HEADER_COST + firstWeight;

			// Se não cabe o cabeçalho da tabela + a linha na folha atual, cria nova folha
			if (currentBudget < neededForTableAndRow && currentItems.length > 0) {
				startNewPage();
			}

			currentBudget -= TABLE_HEADER_COST;
			const chunkBlocks: PlanningBlockWithRelations[] = [];

			while (blockIndex < sortedBlocks.length) {
				const block = sortedBlocks[blockIndex];
				const weight = estimateRowWeight(block, orientation);

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

			// Uma folha acomoda apenas uma tabela contínua; se sobraram blocos, avança para nova folha
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
