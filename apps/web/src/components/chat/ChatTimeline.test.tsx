import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";

(globalThis as unknown as { React: typeof React }).React = React;

import { renderToStaticMarkup } from "react-dom/server";
import {
	APPLICATION_LOADING_STEPS,
	ChatTimeline,
	COMPREHENSION_LOADING_STEPS,
} from "./ChatTimeline";
import type { Message } from "./types";

const mockMessages: Message[] = [
	{
		id: "msg-1",
		sessionId: "sess-1",
		type: "USER",
		interrupted: false,
		text: "Adicionar uma atividade prática de frações no início da aula.",
		createdAt: "2026-03-01T10:00:00Z",
	},
	{
		id: "msg-2",
		sessionId: "sess-1",
		type: "IA",
		interrupted: false,
		text: "Entendido! Proposta ajustada com foco em frações equivalentes.",
		createdAt: "2026-03-01T10:00:05Z",
	},
];

test("ChatTimeline: exibe COMPREHENSION_LOADING_STEPS quando isStreaming está ativo e partialText é vazio", () => {
	const markup = renderToStaticMarkup(
		<ChatTimeline messages={mockMessages} isStreaming={true} partialText="" />,
	);

	// Deve renderizar o primeiro passo da fase de compreensão
	assert.ok(markup.includes(COMPREHENSION_LOADING_STEPS[0]));

	// Não deve renderizar o passo da fase de aplicação
	assert.ok(!markup.includes(APPLICATION_LOADING_STEPS[0]));
});

test("ChatTimeline: exibe APPLICATION_LOADING_STEPS no rodapé quando isStreaming está ativo e partialText possui conteúdo", () => {
	const partialText = "Elaborando plano com a nova estrutura metodológica...";
	const markup = renderToStaticMarkup(
		<ChatTimeline
			messages={mockMessages}
			isStreaming={true}
			partialText={partialText}
		/>,
	);

	// Deve renderizar o texto parcial gerado
	assert.ok(markup.includes(partialText));

	// Deve renderizar a mensagem de loading da fase de aplicação
	assert.ok(markup.includes(APPLICATION_LOADING_STEPS[0]));

	// Não deve exibir as mensagens exclusivas da fase de compreensão inicial
	assert.ok(!markup.includes(COMPREHENSION_LOADING_STEPS[0]));
});

test("ChatTimeline: não exibe mensagens de loading quando isStreaming é falso", () => {
	const markup = renderToStaticMarkup(
		<ChatTimeline messages={mockMessages} isStreaming={false} partialText="" />,
	);

	assert.ok(!markup.includes(COMPREHENSION_LOADING_STEPS[0]));
	assert.ok(!markup.includes(APPLICATION_LOADING_STEPS[0]));
	// Mensagens anteriores devem ser renderizadas normalmente
	assert.ok(markup.includes("Adicionar uma atividade prática de frações"));
	assert.ok(
		markup.includes("Entendido! Proposta ajustada com foco em frações"),
	);
});

test("ChatTimeline: renderiza ExportActionCard quando a mensagem da IA possui comando EXPORT_PLANNING", () => {
	const messagesWithExport: Message[] = [
		{
			id: "msg-ai-export",
			sessionId: "sess-1",
			type: "IA",
			interrupted: false,
			text: "Aqui está o seu planejamento formatado para exportação.",
			createdAt: "2026-03-01T10:05:00Z",
			commands: {
				operation: "EXPORT_PLANNING",
				data: { format: "pdf", orientation: "portrait" },
			},
		},
	];

	const markup = renderToStaticMarkup(
		<ChatTimeline
			messages={messagesWithExport}
			sessionId="sess-1"
			hasBlocks={true}
		/>,
	);

	assert.ok(markup.includes("Exportar Planejamento"));
	assert.ok(markup.includes("Baixar PDF"));
	assert.ok(markup.includes("PDF"));
	assert.ok(markup.includes("Retrato"));
});

test("ChatTimeline: renderiza anexo no balão da mensagem do usuário com card, nome, tamanho e download", () => {
	const messagesWithAttachment: Message[] = [
		{
			id: "msg-user-with-att",
			sessionId: "sess-1",
			type: "USER",
			interrupted: false,
			text: "Monte a aula com base nesta diretriz escolar.",
			createdAt: "2026-03-01T10:10:00Z",
			attachment: {
				id: "doc-att-1",
				name: "diretriz-pedagogica.pdf",
				size: 1024 * 500,
				mimeType: "application/pdf",
				url: "/api/documents/doc-att-1/download",
			},
		},
	];

	const markup = renderToStaticMarkup(
		<ChatTimeline messages={messagesWithAttachment} sessionId="sess-1" />,
	);

	assert.ok(markup.includes('data-testid="message-attachment-card"'));
	assert.ok(markup.includes("diretriz-pedagogica.pdf"));
	assert.ok(markup.includes("500 KB"));
	assert.ok(markup.includes('href="/api/documents/doc-att-1/download"'));
	assert.ok(markup.includes("Monte a aula com base nesta diretriz"));
});

test("ChatTimeline: renderiza anexo quando armazenado dentro de commands.attachment", () => {
	const messagesWithCommandsAttachment: Message[] = [
		{
			id: "msg-user-commands-att",
			sessionId: "sess-1",
			type: "USER",
			interrupted: false,
			text: "Segue o cronograma da escola.",
			createdAt: "2026-03-01T10:12:00Z",
			commands: {
				attachment: {
					name: "cronograma.docx",
					size: 1024 * 250,
					mimeType:
						"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				},
			},
		},
	];

	const markup = renderToStaticMarkup(
		<ChatTimeline
			messages={messagesWithCommandsAttachment}
			sessionId="sess-1"
		/>,
	);

	assert.ok(markup.includes('data-testid="message-attachment-card"'));
	assert.ok(markup.includes("cronograma.docx"));
	assert.ok(markup.includes("250 KB"));
});
