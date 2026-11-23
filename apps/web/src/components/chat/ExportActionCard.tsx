import {
	AlertCircle,
	CheckCircle2,
	Download,
	FileDown,
	FileText,
	Loader2,
} from "lucide-react";
import * as React from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { cn } from "#/lib/utils";

export interface ExportActionCardProps {
	sessionId: string;
	format?: "pdf" | "docx";
	orientation?: "portrait" | "landscape";
	hasBlocks?: boolean;
	className?: string;
}

export function ExportActionCard({
	sessionId,
	format = "pdf",
	orientation = "portrait",
	hasBlocks = true,
	className,
}: ExportActionCardProps) {
	const [isDownloading, setIsDownloading] = React.useState(false);
	const [downloadSuccess, setDownloadSuccess] = React.useState(false);
	const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

	const isPdf = format === "pdf";
	const isLandscape = orientation === "landscape";
	const formatLabel = isPdf ? "PDF" : "DOCX";
	const orientationLabel = isLandscape ? "Paisagem" : "Retrato";

	const handleDownload = async () => {
		if (!sessionId || !hasBlocks || isDownloading) return;

		setIsDownloading(true);
		setErrorMessage(null);
		setDownloadSuccess(false);

		try {
			const res = await fetch(
				`/api/sessions/${sessionId}/planning/export?format=${format}&orientation=${orientation}`,
			);

			if (!res.ok) {
				throw new Error(`Falha ao exportar arquivo: ${res.statusText}`);
			}

			const blob = await res.blob();
			const blobUrl = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = blobUrl;
			link.download = `planejamento-${orientation}.${format}`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(blobUrl);

			setDownloadSuccess(true);
			setTimeout(() => {
				setDownloadSuccess(false);
			}, 3500);
		} catch (err) {
			console.error(`Erro ao baixar ${formatLabel}:`, err);
			setErrorMessage(
				"Não foi possível baixar o arquivo. Verifique sua conexão e tente novamente.",
			);
		} finally {
			setIsDownloading(false);
		}
	};

	return (
		<Card
			data-testid="export-action-card"
			className={cn(
				"my-3 w-full max-w-md border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs transition-all",
				className,
			)}
		>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-center gap-2.5">
						<div
							className={cn(
								"p-2 rounded-lg shrink-0",
								isPdf
									? "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400"
									: "bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400",
							)}
						>
							{isPdf ? (
								<FileDown className="h-5 w-5" data-testid="icon-pdf" />
							) : (
								<FileText className="h-5 w-5" data-testid="icon-docx" />
							)}
						</div>
						<div>
							<CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">
								Exportar Planejamento
							</CardTitle>
							<CardDescription className="text-xs text-slate-500 dark:text-slate-400">
								{isPdf
									? "Documento formatado para impressão ou arquivamento"
									: "Documento editável do Microsoft Word"}
							</CardDescription>
						</div>
					</div>

					<div className="flex items-center gap-1.5 shrink-0">
						<Badge
							variant="outline"
							className={cn(
								"text-[10px] uppercase font-bold tracking-wider px-2 py-0.5",
								isPdf
									? "border-red-200 text-red-700 dark:border-red-800 dark:text-red-400"
									: "border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400",
							)}
						>
							{formatLabel}
						</Badge>
						<Badge
							variant="secondary"
							className="text-[10px] font-medium px-2 py-0.5"
						>
							{orientationLabel}
						</Badge>
					</div>
				</div>
			</CardHeader>

			<CardContent className="pt-0 pb-3">
				{!hasBlocks ? (
					<div
						data-testid="no-blocks-warning"
						className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs"
					>
						<AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
						<p className="leading-relaxed">
							O planejamento ainda não possui blocos estruturados. Defina os
							componentes e o cronograma no chat antes de exportar.
						</p>
					</div>
				) : (
					<p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
						Clique abaixo para gerar e iniciar o download do arquivo em formato{" "}
						<strong className="font-semibold text-slate-800 dark:text-slate-200">
							{formatLabel}
						</strong>{" "}
						({orientationLabel.toLowerCase()}).
					</p>
				)}

				{errorMessage && (
					<div className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
						<AlertCircle className="h-3.5 w-3.5 shrink-0" />
						<span>{errorMessage}</span>
					</div>
				)}
			</CardContent>

			<CardFooter className="pt-0 flex items-center justify-between gap-2 border-t border-emerald-100 dark:border-emerald-900/40 p-3 bg-white/40 dark:bg-slate-900/40">
				<span className="text-[11px] text-slate-500 dark:text-slate-400">
					{isPdf ? "Diagramação A4" : "Formato .docx"}
				</span>

				<Button
					type="button"
					size="sm"
					variant={isPdf ? "default" : "secondary"}
					disabled={!hasBlocks || isDownloading}
					onClick={handleDownload}
					className={cn(
						"h-8 px-3 text-xs gap-1.5 font-medium cursor-pointer shadow-xs",
						isPdf && "bg-red-600 hover:bg-red-700 text-white border-0",
						downloadSuccess &&
							"bg-emerald-600 hover:bg-emerald-700 text-white border-0",
					)}
				>
					{isDownloading ? (
						<>
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
							<span>Baixando...</span>
						</>
					) : downloadSuccess ? (
						<>
							<CheckCircle2 className="h-3.5 w-3.5" />
							<span>Baixado!</span>
						</>
					) : (
						<>
							<Download className="h-3.5 w-3.5" />
							<span>
								{!hasBlocks ? "Aguardando Plano" : `Baixar ${formatLabel}`}
							</span>
						</>
					)}
				</Button>
			</CardFooter>
		</Card>
	);
}
