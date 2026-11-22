import { Send, Square } from "lucide-react";
import * as React from "react";
import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";

interface ChatInputProps {
	isStreaming: boolean;
	value?: string;
	onValueChange?: (value: string) => void;
	onSend: (text: string) => void;
	onStop: () => void;
}

export function ChatInput({
	isStreaming,
	value: controlledValue,
	onValueChange,
	onSend,
	onStop,
}: ChatInputProps) {
	const [text, setText] = React.useState(controlledValue ?? "");
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);
	const prevStreamingRef = React.useRef(isStreaming);

	// Restaura o foco automaticamente quando o streaming for concluído, interrompido ou falhar
	React.useEffect(() => {
		let frameId: number | undefined;
		if (prevStreamingRef.current && !isStreaming) {
			frameId = requestAnimationFrame(() => {
				textareaRef.current?.focus();
			});
		}
		prevStreamingRef.current = isStreaming;

		return () => {
			if (frameId !== undefined) {
				cancelAnimationFrame(frameId);
			}
		};
	}, [isStreaming]);

	// Sincroniza com valor externo (ex: ao clicar em "Copiar para editar")
	React.useEffect(() => {
		if (controlledValue !== undefined) {
			setText(controlledValue);
			if (controlledValue) {
				textareaRef.current?.focus();
			}
		}
	}, [controlledValue]);

	// Ajusta a altura automaticamente até o limite de 6~10 linhas (~220px)
	const adjustHeight = React.useCallback((_content: string) => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		textarea.style.height = "auto";
		const minHeight = 44; // 1 linha
		const maxHeight = 220; // 8 a 10 linhas
		const nextHeight = Math.min(
			Math.max(textarea.scrollHeight, minHeight),
			maxHeight,
		);
		textarea.style.height = `${nextHeight}px`;
		textarea.style.overflowY =
			textarea.scrollHeight > maxHeight ? "auto" : "hidden";
	}, []);

	React.useEffect(() => {
		adjustHeight(text);
	}, [text, adjustHeight]);

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target.value;
		setText(val);
		onValueChange?.(val);
	};

	const handleSubmit = (e?: React.FormEvent) => {
		e?.preventDefault();
		const trimmed = text.trim();
		if (!trimmed || isStreaming) return;

		onSend(trimmed);
		setText("");
		onValueChange?.("");
		if (textareaRef.current) {
			textareaRef.current.style.height = "44px";
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	return (
		<div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
			<form
				onSubmit={handleSubmit}
				className="max-w-3xl mx-auto flex items-end gap-2"
			>
				<div className="flex-1 relative">
					<Textarea
						ref={textareaRef}
						value={text}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						disabled={isStreaming}
						rows={1}
						placeholder={
							isStreaming
								? "Estamos trabalhando na sua requisição... aguarde ou interrompa."
								: "Digite sua mensagem... (Enter para enviar, Shift+Enter para quebra)"
						}
						className="min-h-[44px] max-h-[220px] py-3 pr-4 resize-none shadow-xs text-sm leading-relaxed overflow-y-hidden"
					/>
				</div>

				{isStreaming ? (
					<Button
						type="button"
						variant="destructive"
						size="icon"
						onClick={onStop}
						title="Interromper geração (Stop)"
						className="h-11 w-11 rounded-lg shrink-0 shadow-sm animate-pulse"
					>
						<Square className="h-5 w-5 fill-current" />
					</Button>
				) : (
					<Button
						type="submit"
						variant="default"
						size="icon"
						disabled={!text.trim()}
						title="Enviar mensagem"
						className="h-11 w-11 rounded-lg shrink-0 shadow-sm"
					>
						<Send className="h-5 w-5" />
					</Button>
				)}
			</form>
		</div>
	);
}
