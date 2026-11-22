import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";

(globalThis as unknown as { React: typeof React }).React = React;

import { renderToStaticMarkup } from "react-dom/server";
import { PlanningHeader } from "./PlanningHeader";
import { PlanningTableChunk, SectionDivider } from "./PlanningTable";
import { paginatePlanning } from "./paginatePlanning";
import type {
	PlanningAggregate,
	PlanningBlockWithRelations,
	Specification,
} from "./types";

const mockBlock: PlanningBlockWithRelations = {
	id: "block-1",
	planningId: "plan-1",
	order: 0,
	granularity: "DAILY",
	startAt: "2026-03-01T08:00:00Z",
	endAt: "2026-03-01T09:00:00Z",
	metodologia: "Sequência detalhada de atividades didáticas.",
	learningObjectives: [
		{
			id: "lo-1",
			bnccSkill: {
				id: "skill-1",
				code: "EF06MA01",
				description: "Habilidade de Matemática",
			},
		},
	],
	evaluations: [
		{
			id: "eval-1",
			name: "Prova Diagnóstica",
			instrumentType: "Formativa",
			criteria: "Critérios de avaliação",
		},
	],
	metadataValues: [
		{
			id: "mv-1",
			specificationId: "spec-dyn-1",
			textValue: "Conteúdo dinâmico personalizado",
			specification: {
				id: "spec-dyn-1",
				sessionId: "sess-1",
				tableRef: "PLANNING_BLOCK",
				colName: "recursos",
				customLabel: "Recursos Didáticos",
				isRequired: false,
				isVisible: true,
			},
		},
	],
};

const mockPlanning: PlanningAggregate = {
	id: "plan-1",
	sessionId: "sess-1",
	curricularComponents: [{ id: "comp-1", name: "Matemática" }],
	applicationYear: { id: "year-1", name: "6º Ano Fundamental" },
	school: { id: "school-1", name: "Escola Municipal Exemplo" },
	startAt: "2026-02-01T00:00:00Z",
	endAt: "2026-12-15T00:00:00Z",
	granularity: "DAILY",
	learningObjectives: [
		{
			id: "lo-macro-1",
			bnccSkill: {
				id: "skill-macro-1",
				code: "EF06MA01",
				description: "Habilidade Geral",
			},
		},
	],
	evaluations: [
		{
			id: "eval-macro-1",
			name: "Avaliação Bimestral",
			instrumentType: "Somativa",
			criteria: "Critérios gerais",
		},
	],
	metadataValues: [
		{
			id: "mv-header-1",
			specificationId: "spec-header-dyn",
			textValue: "Objetivo geral do curso",
			specification: {
				id: "spec-header-dyn",
				sessionId: "sess-1",
				tableRef: "PLANNING",
				colName: "objetivo_geral",
				customLabel: "Objetivo Geral",
				isRequired: false,
				isVisible: true,
			},
		},
	],
	blocks: [mockBlock],
};

test("PlanningTableChunk: oculta coluna de metodologia quando isVisible: false", () => {
	const specsHidden: Specification[] = [
		{
			id: "spec-met-1",
			sessionId: "sess-1",
			tableRef: "PLANNING_BLOCK",
			colName: "metodologia",
			customLabel: "Sequência Didática",
			isRequired: false,
			isVisible: false,
		},
	];

	const htmlHidden = renderToStaticMarkup(
		<PlanningTableChunk blocks={[mockBlock]} specifications={specsHidden} />,
	);

	assert.strictEqual(
		htmlHidden.includes("Sequência Didática"),
		false,
		"Coluna 'Sequência Didática' não deve estar presente no HTML quando isVisible: false",
	);
	assert.strictEqual(
		htmlHidden.includes("Sequência detalhada de atividades didáticas."),
		false,
		"Conteúdo de metodologia não deve ser renderizado quando isVisible: false",
	);

	// Quando isVisible: true, deve renderizar normalmente
	const specsVisible: Specification[] = [
		{
			...specsHidden[0],
			isVisible: true,
		},
	];

	const htmlVisible = renderToStaticMarkup(
		<PlanningTableChunk blocks={[mockBlock]} specifications={specsVisible} />,
	);

	assert.strictEqual(
		htmlVisible.includes("Sequência Didática"),
		true,
		"Coluna 'Sequência Didática' deve estar presente no HTML quando isVisible: true",
	);
	assert.strictEqual(
		htmlVisible.includes("Sequência detalhada de atividades didáticas."),
		true,
	);
});

test("PlanningTableChunk: oculta Habilidades BNCC e Avaliações quando isVisible: false", () => {
	const specs: Specification[] = [
		{
			id: "spec-bncc",
			sessionId: "sess-1",
			tableRef: "PLANNING_BLOCK",
			colName: "bncc",
			customLabel: "Habilidades BNCC",
			isRequired: false,
			isVisible: false,
		},
		{
			id: "spec-eval",
			sessionId: "sess-1",
			tableRef: "PLANNING_BLOCK",
			colName: "evaluations",
			customLabel: "Avaliação",
			isRequired: false,
			isVisible: false,
		},
	];

	const html = renderToStaticMarkup(
		<PlanningTableChunk blocks={[mockBlock]} specifications={specs} />,
	);

	assert.strictEqual(html.includes("Habilidades BNCC"), false);
	assert.strictEqual(html.includes("EF06MA01"), false);
	assert.strictEqual(html.includes("Prova Diagnóstica"), false);
});

test("PlanningTableChunk: oculta coluna de identificação/ordem quando orderSpec.isVisible: false", () => {
	const specs: Specification[] = [
		{
			id: "spec-order",
			sessionId: "sess-1",
			tableRef: "PLANNING_BLOCK",
			colName: "order",
			customLabel: "Aula / Data",
			isRequired: false,
			isVisible: false,
		},
	];

	const html = renderToStaticMarkup(
		<PlanningTableChunk blocks={[mockBlock]} specifications={specs} />,
	);

	assert.strictEqual(html.includes("col-order"), false);
	assert.strictEqual(html.includes("Aula / Data"), false);
});

test("PlanningTableChunk: filtra colunas dinâmicas EAV com isVisible: false", () => {
	const specs: Specification[] = [
		{
			id: "spec-dyn-1",
			sessionId: "sess-1",
			tableRef: "PLANNING_BLOCK",
			colName: "recursos",
			customLabel: "Recursos Didáticos",
			isRequired: false,
			isVisible: false,
		},
	];

	const html = renderToStaticMarkup(
		<PlanningTableChunk blocks={[mockBlock]} specifications={specs} />,
	);

	assert.strictEqual(html.includes("Recursos Didáticos"), false);
	assert.strictEqual(html.includes("Conteúdo dinâmico personalizado"), false);
});

test("SectionDivider: oculta metodologia pedagógica quando showMethodology: false", () => {
	const parentWithMet: PlanningBlockWithRelations = {
		...mockBlock,
		id: "parent-1",
		metodologia: "Metodologia geral do bimestre/mês.",
	};

	const htmlHidden = renderToStaticMarkup(
		<SectionDivider
			title="Mês 1"
			parentBlock={parentWithMet}
			showMethodology={false}
		/>,
	);

	assert.strictEqual(
		htmlHidden.includes("Metodologia geral do bimestre/mês."),
		false,
	);

	const htmlVisible = renderToStaticMarkup(
		<SectionDivider
			title="Mês 1"
			parentBlock={parentWithMet}
			showMethodology={true}
		/>,
	);

	assert.strictEqual(
		htmlVisible.includes("Metodologia geral do bimestre/mês."),
		true,
	);
});

test("PlanningHeader: oculta componentes, ano, escola, período, BNCC e avaliações quando isVisible: false", () => {
	const specs: Specification[] = [
		{
			id: "s-comp",
			sessionId: "sess-1",
			tableRef: "PLANNING",
			colName: "componente",
			isVisible: false,
			isRequired: false,
		},
		{
			id: "s-year",
			sessionId: "sess-1",
			tableRef: "PLANNING",
			colName: "ano",
			isVisible: false,
			isRequired: false,
		},
		{
			id: "s-school",
			sessionId: "sess-1",
			tableRef: "PLANNING",
			colName: "escola",
			isVisible: false,
			isRequired: false,
		},
		{
			id: "s-period",
			sessionId: "sess-1",
			tableRef: "PLANNING",
			colName: "periodo",
			isVisible: false,
			isRequired: false,
		},
		{
			id: "s-bncc",
			sessionId: "sess-1",
			tableRef: "PLANNING",
			colName: "bncc",
			isVisible: false,
			isRequired: false,
		},
		{
			id: "s-eval",
			sessionId: "sess-1",
			tableRef: "PLANNING",
			colName: "avaliacoes",
			isVisible: false,
			isRequired: false,
		},
		{
			id: "s-dyn",
			sessionId: "sess-1",
			tableRef: "PLANNING",
			colName: "objetivo_geral",
			isVisible: false,
			isRequired: false,
		},
	];

	const html = renderToStaticMarkup(
		<PlanningHeader planning={mockPlanning} specifications={specs} />,
	);

	// Grid items should not contain hidden fields
	assert.strictEqual(html.includes("header-component"), false);
	assert.strictEqual(html.includes("header-year"), false);
	assert.strictEqual(html.includes("header-school"), false);
	assert.strictEqual(html.includes("header-period"), false);
	// Subtitle should not contain hidden year
	assert.strictEqual(html.includes("6º Ano Fundamental"), false);
	// Macro sections should not contain hidden BNCC and Evaluations
	assert.strictEqual(html.includes("macro-bncc"), false);
	assert.strictEqual(html.includes("macro-evaluations"), false);
	assert.strictEqual(html.includes("Objetivo Geral"), false);
});

test("paginatePlanning: recalcula páginas considerando especificações com isVisible: false", () => {
	// Com tudo visível
	const pagesDefault = paginatePlanning(mockPlanning, []);
	assert.ok(pagesDefault.length >= 1);

	// Com tudo oculto
	const specsAllHidden: Specification[] = [
		{
			id: "s-1",
			sessionId: "s",
			tableRef: "PLANNING",
			colName: "bncc",
			isVisible: false,
			isRequired: false,
		},
		{
			id: "s-2",
			sessionId: "s",
			tableRef: "PLANNING",
			colName: "avaliacoes",
			isVisible: false,
			isRequired: false,
		},
		{
			id: "s-3",
			sessionId: "s",
			tableRef: "PLANNING_BLOCK",
			colName: "metodologia",
			isVisible: false,
			isRequired: false,
		},
	];

	const pagesHidden = paginatePlanning(mockPlanning, specsAllHidden);
	assert.ok(pagesHidden.length >= 1);
});
