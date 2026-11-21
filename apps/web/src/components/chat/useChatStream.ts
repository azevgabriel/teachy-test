import * as React from "react";
import type { Message } from "./types";

interface UseChatStreamOptions {
	initialMessages?: Message[];
	onSessionCreated?: (sessionId: string) => void;
	onMessageSaved?: (message: Message) => void;
}

export function useChatStream({
	initialMessages = [],
	onSessionCreated,
	onMessageSaved,
}: UseChatStreamOptions = {}) {
	const [messages, setMessages] = React.useState<Message[]>(initialMessages);
	const [partialText, setPartialText] = React.useState("");
	const [isStreaming, setIsStreaming] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const abortControllerRef = React.useRef<AbortController | null>(null);
	const currentPartialTextRef = React.useRef<string>("");
	const currentAiMessageIdRef = React.useRef<string | null>(null);
	const lastUserMessageIdRef = React.useRef<string | null>(null);
	const currentSessionIdRef = React.useRef<string | null>(null);

	// Sincroniza se as mensagens iniciais mudarem (ex.: ao trocar de sessão)
	React.useEffect(() => {
		setMessages(initialMessages);
		setPartialText("");
		currentPartialTextRef.current = "";
		currentAiMessageIdRef.current = null;
		lastUserMessageIdRef.current = null;
		setError(null);
	}, [initialMessages]);

	const stopStream = React.useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}
	}, []);

	const sendMessage = React.useCallback(
		async (sessionId: string | null, text: string): Promise<string | null> => {
			setError(null);
			const controller = new AbortController();
			abortControllerRef.current = controller;
			setIsStreaming(true);
			setPartialText("");
			currentPartialTextRef.current = "";
			currentAiMessageIdRef.current = null;

			let currentSessionId = sessionId;

			try {
				// 1. Se ainda não há sessão (página inicial vazia), cria uma nova sessão
				if (!currentSessionId) {
					const createRes = await fetch("/api/sessions", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ name: text.slice(0, 30) }),
						signal: controller.signal,
					});

					if (!createRes.ok) {
						throw new Error("Não foi possível criar uma nova sessão.");
					}

					const newSession = await createRes.json();
					currentSessionId = newSession.id;
					onSessionCreated?.(newSession.id);
				}

				if (!currentSessionId) {
					throw new Error("Identificador de sessão inválido.");
				}

				currentSessionIdRef.current = currentSessionId;

				// Adiciona otimisticamente a mensagem do usuário na tela
				const optimisticUserMessage: Message = {
					id: `temp-${Date.now()}`,
					sessionId: currentSessionId,
					text,
					type: "USER",
					interrupted: false,
					createdAt: new Date().toISOString(),
				};
				lastUserMessageIdRef.current = optimisticUserMessage.id;
				setMessages((prev) => [...prev, optimisticUserMessage]);

				// 2. Dispara a requisição de streaming para o backend
				const response = await fetch(
					`/api/sessions/${currentSessionId}/messages`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ text }),
						signal: controller.signal,
					},
				);

				if (!response.ok) {
					throw new Error(`Falha na requisição: ${response.statusText}`);
				}

				const reader = response.body?.getReader();
				const decoder = new TextDecoder();
				let buffer = "";

				while (reader) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const blocks = buffer.split("\n\n");
					buffer = blocks.pop() || "";

					for (const block of blocks) {
						const line = block.split("\n").find((l) => l.startsWith("data: "));
						if (line) {
							const jsonStr = line.replace(/^data:\s*/, "");
							try {
								const event = JSON.parse(jsonStr);

								if (event.type === "init") {
									currentAiMessageIdRef.current = event.messageId;
								} else if (event.type === "chunk") {
									currentPartialTextRef.current += event.content;
									setPartialText(currentPartialTextRef.current);
								} else if (event.type === "done") {
									const savedMsg = event.message as Message;
									setMessages((prev) => {
										// Evita duplicatas se o ID já existir
										const exists = prev.some((m) => m.id === savedMsg.id);
										if (exists) {
											return prev.map((m) =>
												m.id === savedMsg.id ? savedMsg : m,
											);
										}
										return [...prev, savedMsg];
									});
									setPartialText("");
									currentPartialTextRef.current = "";
									onMessageSaved?.(savedMsg);
								} else if (event.type === "cancelled") {
									const savedMsg = event.message as Message;
									setMessages((prev) => {
										if (savedMsg.type === "USER") {
											// Usuário foi interrompido antes do início da resposta
											return prev.map((m) =>
												m.id === savedMsg.id ||
												(m.type === "USER" &&
													m.id === lastUserMessageIdRef.current)
													? savedMsg
													: m,
											);
										}
										// Resposta da IA interrompida parcialmente
										const exists = prev.some((m) => m.id === savedMsg.id);
										if (exists) {
											return prev.map((m) =>
												m.id === savedMsg.id ? savedMsg : m,
											);
										}
										return [...prev, savedMsg];
									});
									setPartialText("");
									currentPartialTextRef.current = "";
									onMessageSaved?.(savedMsg);
								} else if (event.type === "error") {
									setError(event.message || "Erro desconhecido da IA");
								}
							} catch (e) {
								console.error("Erro ao decodificar evento SSE:", e, jsonStr);
							}
						}
					}
				}

				return currentSessionId;
			} catch (err: unknown) {
				if (err instanceof Error && err.name === "AbortError") {
					// Cancelado intencionalmente pelo usuário via botão Stop
					const partial = currentPartialTextRef.current;
					const activeSessionId =
						currentSessionId || currentSessionIdRef.current || "";

					if (!partial || partial.trim().length === 0) {
						// Caso A: Interrompido enquanto ainda estava pensando
						// Marca imediatamente a mensagem do usuário como interrompida na interface
						setMessages((prev) =>
							prev.map((m) => {
								if (
									m.id === lastUserMessageIdRef.current ||
									(m.type === "USER" &&
										m ===
											[...prev].reverse().find((item) => item.type === "USER"))
								) {
									return { ...m, interrupted: true };
								}
								return m;
							}),
						);
					} else {
						// Caso B: Interrompido após o início da geração (apresenta resposta parcial com risco)
						const interruptedAiMsg: Message = {
							id:
								currentAiMessageIdRef.current || `interrupted-ai-${Date.now()}`,
							sessionId: activeSessionId,
							text: partial,
							type: "IA",
							interrupted: true,
							createdAt: new Date().toISOString(),
						};
						setMessages((prev) => {
							const exists = prev.some((m) => m.id === interruptedAiMsg.id);
							if (exists) {
								return prev.map((m) =>
									m.id === interruptedAiMsg.id ? interruptedAiMsg : m,
								);
							}
							return [...prev, interruptedAiMsg];
						});
						onMessageSaved?.(interruptedAiMsg);
					}
					setPartialText("");
					currentPartialTextRef.current = "";
				} else {
					const msg = err instanceof Error ? err.message : "Erro inesperado";
					setError(msg);
					console.error("Erro no chat stream:", err);
				}
				return currentSessionId;
			} finally {
				setIsStreaming(false);
				abortControllerRef.current = null;
			}
		},
		[onSessionCreated, onMessageSaved],
	);

	return {
		messages,
		partialText,
		isStreaming,
		error,
		sendMessage,
		stopStream,
		setMessages,
	};
}
