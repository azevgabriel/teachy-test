import {
	FileSpreadsheet,
	FileText,
	FolderOpen,
	Image as ImageIcon,
	Loader2,
	Search,
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

interface ReferenceDocumentsDrawerProps {
	isOpen: boolean;
	onClose: () => void;
	sessionId?: string;
	onSelectDocument: (doc: ReferenceDocumentItem) => void;
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
}: ReferenceDocumentsDrawerProps) {
	const [documents, setDocuments] = React.useState<ReferenceDocumentItem[]>([]);
	const [isLoading, setIsLoading] = React.useState(false);
	const [searchQuery, setSearchQuery] = React.useState("");
	const [isUploading, setIsUploading] = React.useState(false);
	const [uploadError, setUploadError] = React.useState<string | null>(null);
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
		if (isOpen) {
			fetchDocuments();
		}
	}, [isOpen, fetchDocuments]);

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

	const filteredDocuments = React.useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return documents;
		return documents.filter((d) => d.originalName.toLowerCase().includes(q));
	}, [documents, searchQuery]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
			<div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
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
								Selecione um documento já cadastrado para vincular a esta
								conversa
							</p>
						</div>
					</div>

					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={onClose}
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
						<div className="flex flex-col gap-2">
							{filteredDocuments.map((doc) => (
								<div
									key={doc.id}
									className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors shadow-xs"
								>
									<div className="flex items-center gap-3 min-w-0">
										<div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
											{getDocumentIcon(doc.mimeType, doc.originalName)}
										</div>
										<div className="flex flex-col min-w-0">
											<span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs md:max-w-md">
												{doc.originalName}
											</span>
											<div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
												<span>{formatFileSize(doc.fileSize)}</span>
												<span>•</span>
												<span>
													{new Date(doc.createdAt).toLocaleDateString("pt-BR")}
												</span>
												{doc.isLinkedToSession && (
													<Badge
														variant="secondary"
														className="text-[10px] h-4 px-1.5 py-0 font-normal bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
													>
														Vinculado a esta conversa
													</Badge>
												)}
											</div>
										</div>
									</div>

									<Button
										type="button"
										variant={doc.isLinkedToSession ? "outline" : "default"}
										size="sm"
										onClick={() => {
											onSelectDocument(doc);
											onClose();
										}}
										className="text-xs shrink-0"
									>
										{doc.isLinkedToSession ? "Usar novamente" : "Selecionar"}
									</Button>
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
