import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";

(globalThis as unknown as { React: typeof React }).React = React;

import { renderToStaticMarkup } from "react-dom/server";
import { ReferenceDocumentsDrawer } from "./ReferenceDocumentsDrawer";
import type { ReferenceDocumentItem } from "./types";

const mockDocuments: ReferenceDocumentItem[] = [
	{
		id: "doc-1",
		originalName: "Diretrizes_Curriculares_2026.pdf",
		mimeType: "application/pdf",
		fileSize: 1024 * 500, // 500 KB
		createdAt: "2026-11-23T00:00:00.000Z",
		url: "/api/documents/doc-1/download",
		isLinkedToSession: false,
	},
	{
		id: "doc-2",
		originalName: "Modelo_Plano_Ensino.docx",
		mimeType:
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		fileSize: 1024 * 1024 * 2, // 2 MB
		createdAt: "2026-11-22T00:00:00.000Z",
		url: "/api/documents/doc-2/download",
		isLinkedToSession: true,
	},
	{
		id: "doc-3",
		originalName: "Quadro_Horario.png",
		mimeType: "image/png",
		fileSize: 1024 * 80, // 80 KB
		createdAt: "2026-11-21T00:00:00.000Z",
		url: "/api/documents/doc-3/download",
		isLinkedToSession: false,
	},
];

test("ReferenceDocumentsDrawer: não renderiza markup quando isOpen: false", () => {
	const markup = renderToStaticMarkup(
		<ReferenceDocumentsDrawer
			isOpen={false}
			onClose={() => {}}
			onSelectDocument={() => {}}
		/>,
	);

	assert.equal(markup, "");
});

test("ReferenceDocumentsDrawer: renderiza cabeçalho, barra de busca e upload quando isOpen: true", () => {
	const markup = renderToStaticMarkup(
		<ReferenceDocumentsDrawer
			isOpen={true}
			onClose={() => {}}
			onSelectDocument={() => {}}
			initialDocuments={[]}
		/>,
	);

	assert.ok(markup.includes('data-testid="reference-drawer"'));
	assert.ok(markup.includes("Documentos de Referência Salvos"));
	assert.ok(markup.includes('data-testid="search-documents-input"'));
	assert.ok(markup.includes('data-testid="drawer-upload-button"'));
	assert.ok(markup.includes("Nenhum documento salvo ainda."));
});

test("ReferenceDocumentsDrawer: renderiza lista de documentos com metadados e botão de vincular em 1 clique", () => {
	const markup = renderToStaticMarkup(
		<ReferenceDocumentsDrawer
			isOpen={true}
			sessionId="session-123"
			onClose={() => {}}
			onSelectDocument={() => {}}
			initialDocuments={mockDocuments}
		/>,
	);

	// Documento 1 (não vinculado à sessão)
	assert.ok(markup.includes("Diretrizes_Curriculares_2026.pdf"));
	assert.ok(markup.includes("500 KB"));
	assert.ok(markup.includes('data-testid="link-btn-doc-1"'));
	assert.ok(markup.includes('data-testid="select-btn-doc-1"'));
	assert.ok(markup.includes('data-testid="download-btn-doc-1"'));
	assert.ok(markup.includes('data-testid="delete-btn-doc-1"'));

	// Documento 2 (já vinculado à sessão)
	assert.ok(markup.includes("Modelo_Plano_Ensino.docx"));
	assert.ok(markup.includes("2 MB"));
	assert.ok(markup.includes('data-testid="badge-linked-doc-2"'));
	assert.ok(markup.includes("Vinculado a esta conversa"));
	assert.ok(markup.includes('data-testid="unlink-btn-doc-2"'));
});

test("ReferenceDocumentsDrawer: omite botões de vincular/desvincular quando sessionId não é fornecido", () => {
	const markup = renderToStaticMarkup(
		<ReferenceDocumentsDrawer
			isOpen={true}
			onClose={() => {}}
			onSelectDocument={() => {}}
			initialDocuments={mockDocuments}
		/>,
	);

	// Quando aberto fora do contexto de uma sessão, não há link/unlink específico
	assert.ok(!markup.includes('data-testid="link-btn-doc-1"'));
	assert.ok(!markup.includes('data-testid="unlink-btn-doc-2"'));
	// Mas permite anexar ao chat e baixar
	assert.ok(markup.includes('data-testid="select-btn-doc-1"'));
	assert.ok(markup.includes('data-testid="download-btn-doc-1"'));
});
