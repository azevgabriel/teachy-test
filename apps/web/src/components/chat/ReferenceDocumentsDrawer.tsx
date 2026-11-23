import {
	Download,
	FileSpreadsheet,
	FileText,
	FolderOpen,
	Image as ImageIcon,
	Link2,
	Loader2,
	Paperclip,
	Search,
	Trash2,
	Unlink2,
	UploadCloud,
	X,
} from "lucide-react";
import * as React from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import {
	formatFileSize,
	type ReferenceDocumentItem,
	validateUploadFile,
} from "./types";

export interface ReferenceDocumentsDrawerProps {
	isOpen: boolean;
	onClose: () => void;
	sessionId?: string;
	onSelectDocument: (doc: ReferenceDocumentItem) => void;
	onDocumentLinked?: (doc: ReferenceDocumentItem) => void;
	onDocumentUnlinked?: (docId: string) => void;
	onDocumentDeleted?: (docId: string) => void;
	initialDocuments?: ReferenceDocumentItem[];
}

function getDocumentIcon(mimeType: string, name: string) {
	const norm = mimeType.toLowerCase();
	const ext = name.split(".").pop()?.toLowerCase();
	if (
		norm.startsWith("image/") ||
		["png", "jpg", "jpeg", "webp"].includes(ext || "")
	) {
		return (
			<ImageIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
		);
	}
	if (norm.includes("word") || ext === "docx") {
		return (
			<FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
		);
	}
	return <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />;
}

export function ReferenceDocumentsDrawer({
	isOpen,
	onClose,
	sessionId,
	onSelectDocument,
	onDocumentLinked,
	onDocumentUnlinked,
	onDocumentDeleted,
	initialDocuments,
}: ReferenceDocumentsDrawerProps) {
	const [documents, setDocuments] = React.useState<ReferenceDocumentItem[]>(
		initialDocuments ?? [],
	);
	const [isLoading, setIsLoading] = React.useState(false);
	const [searchQuery, setSearchQuery] = React.useState("");
	const [isUploading, setIsUploading] = React.useState(false);
	const [uploadError, setUploadError] = React.useState<string | null>(null);
	const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(
		null,
	);
	const [deletingDocId, setDeletingDocId] = React.useState<string | null>(null);
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const fetchDocuments = React.useCallback(async () => {
		setIsLoading(true);
		setUploadError(null);
		try {
			const url = sessionId
				? `/api/documents?sessionId=${encodeURIComponent(sessionId)}`
				: "/api/documents";
			const res = await fetch(url);
			if (res.ok) {
				const data: ReferenceDocumentItem[] = await res.json();
				setDocuments(data);
			}
		} catch (err) {
			console.error("Erro ao carregar documentos:", err);
		} finally {
			setIsLoading(false);
		}
	}, [sessionId]);

	React.useEffect(() => {
		if (isOpen && !initialDocuments) {
			fetchDocuments();
		}
	}, [isOpen, initialDocuments, fetchDocuments]);

	const handleUploadClick = () => {
		fileInputRef.current?.click();
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		const validation = validateUploadFile(file);
		if (!validation.valid) {
			setUploadError(validation.error || "Arquivo inválido");
			return;
		}

		setIsUploading(true);
		setUploadError(null);

		try {
			const formData = new FormData();
			formData.append("file", file);
			const url = sessionId
				? `/api/documents/upload?sessionId=${encodeURIComponent(sessionId)}`
				: "/api/documents/upload";

			const res = await fetch(url, {
				method: "POST",
				body: formData,
			});

			if (!res.ok) {
				throw new Error("Falha ao salvar o documento no servidor.");
			}

			const newDoc: ReferenceDocumentItem = await res.json();
			await fetchDocuments();
			if (sessionId) {
				onDocumentLinked?.(newDoc);
			}
			onSelectDocument(newDoc);
			onClose();
		} catch (err: unknown) {
			const msg =
				err instanceof Error ? err.message : "Erro ao enviar arquivo.";
			setUploadError(msg);
		} finally {
			setIsUploading(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	const handleLink = async (doc: ReferenceDocumentItem) => {
		if (!sessionId) return;
		setActionLoadingId(doc.id);
		try {
			const res = await fetch(
				`/api/sessions/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(doc.id)}/link`,
				{ method: "POST" },
			);
			if (res.ok) {
				setDocuments((prev) =>
					prev.map((d) =>
						d.id === doc.id ? { ...d, isLinkedToSession: true } : d,
					),
				);
				onDocumentLinked?.({ ...doc, isLinkedToSession: true });
			}
		} catch (err) {
			console.error("Erro ao vincular documento à sessão:", err);
		} finally {
			setActionLoadingId(null);
		}
	};

	const handleUnlink = async (doc: ReferenceDocumentItem) => {
		if (!sessionId) return;
		setActionLoadingId(doc.id);
		try {
			const res = await fetch(
				`/api/sessions/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(doc.id)}/unlink`,
				{ method: "DELETE" },
			);
			if (res.ok) {
				setDocuments((prev) =>
					prev.map((d) =>
						d.id === doc.id ? { ...d, isLinkedToSession: false } : d,
					),
				);
				onDocumentUnlinked?.(doc.id);
			}
		} catch (err) {
			console.error("Erro ao desvincular documento da sessão:", err);
		} finally {
			setActionLoadingId(null);
		}
	};

	const handleDelete = async (docId: string) => {
		setActionLoadingId(docId);
		try {
			const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
				method: "DELETE",
			});
			if (res.ok) {
				setDocuments((prev) => prev.filter((d) => d.id !== docId));
				setDeletingDocId(null);
				onDocumentDeleted?.(docId);
			}
		} catch (err) {
			console.error("Erro ao excluir documento:", err);
		} finally {
			setActionLoadingId(null);
		}
	};

	const filteredDocuments = React.useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return documents;
		return documents.filter((d) => d.originalName.toLowerCase().includes(q));
	}, [documents, searchQuery]);

	if (!isOpen) return null;

	return (
		<div
			data-testid="reference-drawer"
			className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
		>
			<div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-200 dark:border-slate-800">
					<div className="flex items-center gap-3">
						<div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
							<FolderOpen className="h-5 w-5" />
						</div>
						<div>
							<h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
								Documentos de Referência Salvos
							</h3>
							<p className="text-xs text-slate-500 dark:text-slate-400">
								Vincule materiais diretivos à sessão atual com 1 clique ou anexe
								ao chat
							</p>
						</div>
					</div>

					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={onClose}
						data-testid="close-drawer-btn"
						className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>

				{/* Barra de Pesquisa e Botão de Novo Upload */}
				<div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Pesquisar por nome do documento..."
							data-testid="search-documents-input"
							className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 dark:text-slate-200"
						/>
					</div>

					<input
						ref={fileInputRef}
						type="file"
						accept=".pdf,.docx,.png,.jpg,.jpeg,.webp"
						onChange={handleFileChange}
						className="hidden"
					/>

					<Button
						type="button"
						variant="default"
						size="sm"
						onClick={handleUploadClick}
						disabled={isUploading}
						data-testid="drawer-upload-button"
						className="gap-2 text-xs shrink-0"
					>
						{isUploading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<UploadCloud className="h-4 w-4" />
						)}
						<span>Fazer upload de novo arquivo</span>
					</Button>
				</div>

				{uploadError && (
					<div className="px-4 py-2 bg-red-50 dark:bg-red-950/50 border-b border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs">
						{uploadError}
					</div>
				)}

				{/* Lista de Documentos */}
				<ScrollArea className="flex-1 p-4">
					{isLoading ? (
						<div className="py-12 flex flex-col items-center justify-center text-slate-400">
							<Loader2 className="h-7 w-7 animate-spin text-emerald-600 mb-2" />
							<span className="text-xs">Carregando documentos...</span>
						</div>
					) : filteredDocuments.length === 0 ? (
						<div className="py-12 flex flex-col items-center justify-center text-center">
							<div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
								<FolderOpen className="h-6 w-6" />
							</div>
							<p className="text-sm font-medium text-slate-700 dark:text-slate-300">
								{searchQuery
									? "Nenhum documento encontrado para essa busca."
									: "Nenhum documento salvo ainda."}
							</p>
							<p className="text-xs text-slate-400 max-w-sm mt-1">
								Envie diretrizes curriculares, modelos em PDF, DOCX ou fotos
								para reutilizar em suas sessões de planejamento.
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-2.5">
							{filteredDocuments.map((doc) => (
								<div
									key={doc.id}
									data-testid={`document-item-${doc.id}`}
									className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors shadow-xs"
								>
									{/* Info do Documento */}
									<div className="flex items-center gap-3 min-w-0 flex-1">
										<div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
											{getDocumentIcon(doc.mimeType, doc.originalName)}
										</div>
										<div className="flex flex-col min-w-0">
											<span
												className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate"
												title={doc.originalName}
											>
												{doc.originalName}
											</span>
											<div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
												<span>{formatFileSize(doc.fileSize)}</span>
												<span>•</span>
												<span>
													{new Date(doc.createdAt).toLocaleDateString("pt-BR")}
												</span>
												{doc.isLinkedToSession && (
													<Badge
														variant="secondary"
														data-testid={`badge-linked-${doc.id}`}
														className="text-[10px] h-4 px-1.5 py-0 font-normal bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
													>
														Vinculado a esta conversa
													</Badge>
												)}
											</div>
										</div>
									</div>

									{/* Botões de Ação */}
									<div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
										{/* Download / Visualização */}
										<a
											href={doc.url || `/api/documents/${doc.id}/download`}
											download={doc.originalName}
											target="_blank"
											rel="noopener noreferrer"
											title="Baixar arquivo"
											data-testid={`download-btn-${doc.id}`}
											className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
										>
											<Download className="h-4 w-4" />
										</a>

										{/* Excluir Permanentemente do Repositório */}
										{deletingDocId === doc.id ? (
											<div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/60 p-1 rounded-lg border border-red-200 dark:border-red-800 animate-in fade-in">
												<span className="text-[10px] text-red-600 dark:text-red-300 font-medium px-1">
													Excluir?
												</span>
												<Button
													type="button"
													size="sm"
													variant="destructive"
													onClick={() => handleDelete(doc.id)}
													disabled={actionLoadingId === doc.id}
													data-testid={`confirm-delete-btn-${doc.id}`}
													className="h-6 px-2 text-[10px]"
												>
													{actionLoadingId === doc.id ? (
														<Loader2 className="h-3 w-3 animate-spin" />
													) : (
														"Sim"
													)}
												</Button>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													onClick={() => setDeletingDocId(null)}
													data-testid={`cancel-delete-btn-${doc.id}`}
													className="h-6 px-1.5 text-[10px]"
												>
													Não
												</Button>
											</div>
										) : (
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() => setDeletingDocId(doc.id)}
												title="Excluir permanentemente do repositório"
												data-testid={`delete-btn-${doc.id}`}
												className="h-8 w-8 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										)}

										{/* Vínculo Multi-sessão em 1 Clique */}
										{sessionId &&
											(doc.isLinkedToSession ? (
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => handleUnlink(doc)}
													disabled={actionLoadingId === doc.id}
													data-testid={`unlink-btn-${doc.id}`}
													title="Desvincular desta sessão (continua salvo no repositório global)"
													className="gap-1 text-xs h-8 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30"
												>
													{actionLoadingId === doc.id ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
													) : (
														<Unlink2 className="h-3.5 w-3.5" />
													)}
													<span className="hidden sm:inline">Desvincular</span>
												</Button>
											) : (
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => handleLink(doc)}
													disabled={actionLoadingId === doc.id}
													data-testid={`link-btn-${doc.id}`}
													title="Vincular à sessão ativa com 1 clique"
													className="gap-1 text-xs h-8 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
												>
													{actionLoadingId === doc.id ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
													) : (
														<Link2 className="h-3.5 w-3.5" />
													)}
													<span className="hidden sm:inline">Vincular</span>
												</Button>
											))}

										{/* Anexar ao Chat Input */}
										<Button
											type="button"
											variant="default"
											size="sm"
											onClick={() => {
												onSelectDocument(doc);
												onClose();
											}}
											data-testid={`select-btn-${doc.id}`}
											title="Anexar à mensagem"
											className="gap-1.5 text-xs h-8"
										>
											<Paperclip className="h-3.5 w-3.5" />
											<span>Anexar</span>
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				{/* Footer */}
				<div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-950/20">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onClose}
						className="text-xs"
					>
						Fechar
					</Button>
				</div>
			</div>
		</div>
	);
}
