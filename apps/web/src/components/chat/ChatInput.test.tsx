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
