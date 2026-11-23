import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";

(globalThis as unknown as { React: typeof React }).React = React;

import { renderToStaticMarkup } from "react-dom/server";
import { ExportActionCard } from "./ExportActionCard";
import { getExportPlanningCommands } from "./types";

test("getExportPlanningCommands: extrai comando único EXPORT_PLANNING com defaults", () => {
	const commands = {
		operation: "EXPORT_PLANNING",
		data: {},
	};

	const extracted = getExportPlanningCommands(commands);
	assert.equal(extracted.length, 1);
	assert.equal(extracted[0].format, "pdf");
	assert.equal(extracted[0].orientation, "portrait");
});

test("getExportPlanningCommands: extrai comando único com docx e landscape", () => {
	const commands = {
		operation: "EXPORT_PLANNING",
		data: {
			format: "docx",
			orientation: "landscape",
		},
	};

	const extracted = getExportPlanningCommands(commands);
	assert.equal(extracted.length, 1);
	assert.equal(extracted[0].format, "docx");
	assert.equal(extracted[0].orientation, "landscape");
});

test("getExportPlanningCommands: extrai comando dentro de array operations", () => {
	const commands = {
		operations: [
			{ operation: "UPSERT_PLANNING", data: {} },
			{
				operation: "EXPORT_PLANNING",
				data: { format: "pdf", orientation: "landscape" },
			},
		],
	};

	const extracted = getExportPlanningCommands(commands);
	assert.equal(extracted.length, 1);
	assert.equal(extracted[0].format, "pdf");
	assert.equal(extracted[0].orientation, "landscape");
});

test("getExportPlanningCommands: retorna vazio para comandos nulos ou sem EXPORT_PLANNING", () => {
	assert.deepEqual(getExportPlanningCommands(null), []);
	assert.deepEqual(getExportPlanningCommands(undefined), []);
	assert.deepEqual(
		getExportPlanningCommands({ operation: "READ_ONLY", data: {} }),
		[],
	);
});

test("ExportActionCard: renderiza card para formato PDF e orientação retrato", () => {
	const markup = renderToStaticMarkup(
		<ExportActionCard
			sessionId="sess-123"
			format="pdf"
			orientation="portrait"
			hasBlocks={true}
		/>,
	);

	// Título e identificadores
	assert.ok(markup.includes("Exportar Planejamento"));
	assert.ok(markup.includes("PDF"));
	assert.ok(markup.includes("Retrato"));
	assert.ok(markup.includes("Baixar PDF"));
	assert.ok(markup.includes("Diagramação A4"));
	// Não deve exibir aviso de blocos ausentes
	assert.ok(!markup.includes("no-blocks-warning"));
});

test("ExportActionCard: renderiza card para formato DOCX e orientação paisagem", () => {
	const markup = renderToStaticMarkup(
		<ExportActionCard
			sessionId="sess-123"
			format="docx"
			orientation="landscape"
			hasBlocks={true}
		/>,
	);

	assert.ok(markup.includes("Exportar Planejamento"));
	assert.ok(markup.includes("DOCX"));
	assert.ok(markup.includes("Paisagem"));
	assert.ok(markup.includes("Baixar DOCX"));
	assert.ok(markup.includes("Formato .docx"));
	assert.ok(!markup.includes("no-blocks-warning"));
});

test("ExportActionCard: exibe aviso quando hasBlocks é falso e desabilita botão", () => {
	const markup = renderToStaticMarkup(
		<ExportActionCard
			sessionId="sess-123"
			format="pdf"
			orientation="portrait"
			hasBlocks={false}
		/>,
	);

	// Deve conter aviso amigável
	assert.ok(
		markup.includes(
			"O planejamento ainda não possui blocos estruturados. Defina os componentes e o cronograma no chat antes de exportar.",
		),
	);
	// Botão deve indicar aguardando e estar desabilitado
	assert.ok(markup.includes("Aguardando Plano"));
	assert.ok(markup.includes("disabled"));
});
