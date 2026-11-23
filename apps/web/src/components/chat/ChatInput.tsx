import {
	FileSpreadsheet,
	FileText,
	FolderOpen,
	Image as ImageIcon,
	Paperclip,
	Send,
	Square,
	UploadCloud,
	X,
} from "lucide-react";
import * as React from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import {
	formatFileSize,
	type PendingAttachment,
	validateUploadFile,
} from "./types";

interface ChatInputProps {
	isStreaming: boolean;
	value?: string;
	onValueChange?: (value: string) => void;
	onSend: (text: string, attachment?: PendingAttachment) => void;
	onStop: () => void;
	pendingAttachment?: PendingAttachment | null;
	onPendingAttachmentChange?: (attachment: PendingAttachment | null) => void;
	onOpenSavedDocuments?: () => void;
	onError?: (error: string) => void;
}

export function getAttachmentTypeIcon(mimeType: string, name: string) {
	const norm = (mimeType || "").toLowerCase();
	const ext = (name || "").split(".").pop()?.toLowerCase();
	if (
		norm.startsWith("image/") ||
		["png", "jpg", "jpeg", "webp"].includes(ext || "")
	) {
		return (
			<ImageIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
		);
	}
	if (norm.includes("word") || ext === "docx") {
		return (
			<FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
		);
	}
	return <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />;
}

export function ChatInput({
	isStreaming,
	value: controlledValue,
	onValueChange,
	onSend,
	onStop,
	pendingAttachment: externalPendingAttachment,
	onPendingAttachmentChange,
	onOpenSavedDocuments,
	onError,
}: ChatInputProps) {
	const [text, setText] = React.useState(controlledValue ?? "");
	const [internalPendingAttachment, setInternalPendingAttachment] =
		React.useState<PendingAttachment | null>(null);
	const [showAttachmentMenu, setShowAttachmentMenu] = React.useState(false);

	const pendingAttachment =
		externalPendingAttachment !== undefined
			? externalPendingAttachment
			: internalPendingAttachment;

	const updatePendingAttachment = React.useCallback(
		(attachment: PendingAttachment | null) => {
			if (externalPendingAttachment !== undefined) {
				onPendingAttachmentChange?.(attachment);
			} else {
				setInternalPendingAttachment(attachment);
			}
		},
		[externalPendingAttachment, onPendingAttachmentChange],
	);

	const textareaRef = React.useRef<HTMLTextAreaElement>(null);
	const fileInputRef = React.useRef<HTMLInputElement>(null);
	const menuRef = React.useRef<HTMLDivElement>(null);
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

	// Fecha menu de anexo ao clicar fora ou apertar Escape
	React.useEffect(() => {
		if (!showAttachmentMenu) return;

		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setShowAttachmentMenu(false);
			}
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setShowAttachmentMenu(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [showAttachmentMenu]);

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

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		const validation = validateUploadFile(file);
		if (!validation.valid) {
			onError?.(validation.error || "Arquivo inválido");
			return;
		}

		updatePendingAttachment({
			file,
			name: file.name,
			size: file.size,
			mimeType: file.type || "application/octet-stream",
			previewUrl: file.type.startsWith("image/")
				? URL.createObjectURL(file)
				: undefined,
		});

		setShowAttachmentMenu(false);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleRemoveAttachment = () => {
		updatePendingAttachment(null);
	};

	const handleSubmit = (e?: React.FormEvent) => {
		e?.preventDefault();
		const trimmed = text.trim();
		const hasAttachment = Boolean(pendingAttachment);

		if ((!trimmed && !hasAttachment) || isStreaming) return;

		const messageText =
			trimmed ||
			(pendingAttachment
				? `Segue anexo para apoiar o planejamento: ${pendingAttachment.name}`
				: "");

		onSend(messageText, pendingAttachment || undefined);
		setText("");
		updatePendingAttachment(null);
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

	const isSendDisabled = !text.trim() && !pendingAttachment;

	return (
		<div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
			<form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex flex-col">
				{/* Chip de Pré-visualização de Anexo Pendente */}
				{pendingAttachment && (
					<div
						data-testid="pending-attachment-chip"
						className="flex items-center justify-between gap-3 p-2.5 px-3 mb-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 text-xs shadow-xs animate-in fade-in duration-200"
					>
						<div className="flex items-center gap-2.5 min-w-0">
							<div className="h-8 w-8 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0 shadow-xs">
								{getAttachmentTypeIcon(
									pendingAttachment.mimeType,
									pendingAttachment.name,
								)}
							</div>
							<div className="flex flex-col min-w-0">
								<span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
									{pendingAttachment.name}
								</span>
								<div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
									<span>{formatFileSize(pendingAttachment.size)}</span>
									<span>•</span>
									<Badge
										variant="outline"
										className="text-[10px] h-4 px-1.5 py-0 font-normal border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
									>
										{pendingAttachment.documentId
											? "Documento salvo"
											: "Novo arquivo"}
									</Badge>
								</div>
							</div>
						</div>

						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={handleRemoveAttachment}
							title="Remover anexo"
							aria-label="Remover anexo"
							className="h-7 w-7 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				)}

				<div className="flex items-end gap-2">
					{/* Botão de Anexo Lateral com Menu Dropdown */}
					<div ref={menuRef} className="relative">
						<input
							ref={fileInputRef}
							type="file"
							accept=".pdf,.docx,.png,.jpg,.jpeg,.webp"
							onChange={handleFileInputChange}
							className="hidden"
							data-testid="chat-file-input"
						/>

						<Button
							type="button"
							variant="outline"
							size="icon"
							disabled={isStreaming}
							onClick={() => setShowAttachmentMenu((prev) => !prev)}
							title="Anexar documento ou imagem"
							aria-label="Anexar documento ou imagem"
							data-testid="attach-button"
							className="h-11 w-11 rounded-lg shrink-0 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 border-slate-200 dark:border-slate-800"
						>
							<Paperclip className="h-5 w-5" />
						</Button>

						{showAttachmentMenu && (
							<div
								data-testid="attachment-dropdown-menu"
								className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-1.5 z-40 flex flex-col gap-1 text-xs animate-in fade-in zoom-in-95"
							>
								<button
									type="button"
									onClick={() => {
										setShowAttachmentMenu(false);
										fileInputRef.current?.click();
									}}
									data-testid="menu-upload-computer"
									className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer text-left w-full transition-colors"
								>
									<UploadCloud className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
									<span className="font-medium">Upload do Computador</span>
								</button>
								<button
									type="button"
									onClick={() => {
										setShowAttachmentMenu(false);
										onOpenSavedDocuments?.();
									}}
									data-testid="menu-saved-documents"
									className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer text-left w-full transition-colors"
								>
									<FolderOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
									<span className="font-medium">Documentos Salvos</span>
								</button>
							</div>
						)}
					</div>

					{/* Campo de Texto */}
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
									: pendingAttachment
										? "Adicione uma instrução para o arquivo ou envie diretamente..."
										: "Digite sua mensagem... (Enter para enviar, Shift+Enter para quebra)"
							}
							className="min-h-[44px] max-h-[220px] py-3 pr-4 resize-none shadow-xs text-sm leading-relaxed overflow-y-hidden"
						/>
					</div>

					{/* Botão de Envio / Parada */}
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
							disabled={isSendDisabled}
							title="Enviar mensagem"
							data-testid="chat-submit-button"
							className="h-11 w-11 rounded-lg shrink-0 shadow-sm"
						>
							<Send className="h-5 w-5" />
						</Button>
					)}
				</div>
			</form>
		</div>
	);
}
