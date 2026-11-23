import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";

(globalThis as unknown as { React: typeof React }).React = React;

import { renderToStaticMarkup } from "react-dom/server";
import { Sidebar } from "./Sidebar";
import type { SessionSummary } from "./types";

const mockSessions: SessionSummary[] = [
	{
		id: "s1",
		name: "Planejamento 1º Ano A",
		createdAt: "2026-11-20T00:00:00.000Z",
		updatedAt: "2026-11-20T00:00:00.000Z",
		planning: {
			id: "p1",
			granularity: "WEEKLY",
			applicationYear: { id: "y1", name: "1º Ano EF" },
			curricularComponents: [{ id: "c1", name: "Matemática" }],
		},
	},
];

test("Sidebar: renderiza botão de Documentos de Referência na barra lateral expandida", () => {
	const markup = renderToStaticMarkup(
		<Sidebar
			isOpen={true}
			onToggle={() => {}}
			sessions={mockSessions}
			activeSessionId="s1"
			onSelectSession={() => {}}
			onNewChat={() => {}}
			onOpenDocumentsDrawer={() => {}}
		/>,
	);

	assert.ok(markup.includes("Nova Conversa"));
	assert.ok(markup.includes('data-testid="sidebar-open-documents-btn"'));
	assert.ok(markup.includes("Documentos de Referência"));
	assert.ok(markup.includes("Planejamento 1º Ano A"));
	assert.ok(markup.includes("Matemática"));
	assert.ok(markup.includes("1º Ano EF"));
});

test("Sidebar: renderiza botão colapsado de Documentos de Referência quando isOpen: false", () => {
	const markup = renderToStaticMarkup(
		<Sidebar
			isOpen={false}
			onToggle={() => {}}
			sessions={mockSessions}
			onSelectSession={() => {}}
			onNewChat={() => {}}
			onOpenDocumentsDrawer={() => {}}
		/>,
	);

	assert.ok(
		markup.includes('data-testid="sidebar-open-documents-collapsed-btn"'),
	);
	assert.ok(markup.includes('title="Documentos de Referência"'));
});
