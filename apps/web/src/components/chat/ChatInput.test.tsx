import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";

(globalThis as unknown as { React: typeof React }).React = React;

import { renderToStaticMarkup } from "react-dom/server";
import { ChatInput } from "./ChatInput";

test("ChatInput: renderiza textarea habilitado e botão de envio quando isStreaming: false", () => {
	const markup = renderToStaticMarkup(
		<ChatInput isStreaming={false} onSend={() => {}} onStop={() => {}} />,
	);

	assert.ok(markup.includes("Digite sua mensagem..."));
	assert.ok(!/<textarea[^>]*\sdisabled(?=[>\s=])/.test(markup));
	assert.ok(markup.includes("Enviar mensagem"));
	assert.ok(!markup.includes("Interromper geração (Stop)"));
});

test("ChatInput: renderiza textarea desabilitado e botão de parada quando isStreaming: true", () => {
	const markup = renderToStaticMarkup(
		<ChatInput isStreaming={true} onSend={() => {}} onStop={() => {}} />,
	);

	assert.ok(markup.includes("Estamos trabalhando na sua requisição..."));
	assert.ok(/<textarea[^>]*\sdisabled(?=[>\s=])/.test(markup));
	assert.ok(markup.includes("Interromper geração (Stop)"));
	assert.ok(!markup.includes("Enviar mensagem"));
});

test("ChatInput: inicializa com o valor controlado quando fornecido", () => {
	const markup = renderToStaticMarkup(
		<ChatInput
			isStreaming={false}
			value="Texto pré-preenchido"
			onSend={() => {}}
			onStop={() => {}}
		/>,
	);

	assert.ok(markup.includes("Texto pré-preenchido"));
});

test("ChatInput: renderiza botão lateral de anexo com ícone de clipe e input file com formatos permitidos", () => {
	const markup = renderToStaticMarkup(
		<ChatInput isStreaming={false} onSend={() => {}} onStop={() => {}} />,
	);

	assert.ok(markup.includes('data-testid="attach-button"'));
	assert.ok(markup.includes('title="Anexar documento ou imagem"'));
	assert.ok(markup.includes('data-testid="chat-file-input"'));
	assert.ok(markup.includes(".pdf,.docx,.png,.jpg,.jpeg,.webp"));
});

test("ChatInput: renderiza chip de pré-visualização de anexo pendente com nome, tamanho e opção de remoção", () => {
	const markup = renderToStaticMarkup(
		<ChatInput
			isStreaming={false}
			pendingAttachment={{
				name: "matriz-curricular-2026.pdf",
				size: 1024 * 350,
				mimeType: "application/pdf",
			}}
			onSend={() => {}}
			onStop={() => {}}
		/>,
	);

	assert.ok(markup.includes('data-testid="pending-attachment-chip"'));
	assert.ok(markup.includes("matriz-curricular-2026.pdf"));
	assert.ok(markup.includes("350 KB"));
	assert.ok(markup.includes("Novo arquivo"));
	assert.ok(markup.includes("Remover anexo"));
	// Botão de envio deve estar habilitado mesmo com texto vazio quando há anexo
	assert.ok(
		!/<button[^>]*data-testid="chat-submit-button"[^>]*\sdisabled(?=[>\s=])/.test(
			markup,
		),
	);
});

test("ChatInput: renderiza chip de documento salvo com badge identificador", () => {
	const markup = renderToStaticMarkup(
		<ChatInput
			isStreaming={false}
			pendingAttachment={{
				documentId: "doc-uuid-1",
				name: "modelo-coordenacao.docx",
				size: 1024 * 1024 * 1.5,
				mimeType:
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			}}
			onSend={() => {}}
			onStop={() => {}}
		/>,
	);

	assert.ok(markup.includes("modelo-coordenacao.docx"));
	assert.ok(markup.includes("1.5 MB"));
	assert.ok(markup.includes("Documento salvo"));
});
