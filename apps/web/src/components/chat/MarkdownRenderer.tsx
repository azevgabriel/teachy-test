import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { cn } from "#/lib/utils";

interface MarkdownRendererProps {
	content: string;
	isUser?: boolean;
	className?: string;
}

export function MarkdownRenderer({
	content,
	isUser = false,
	className,
}: MarkdownRendererProps) {
	if (isUser) {
		return (
			<div
				className={cn(
					"text-sm leading-relaxed break-words text-white",
					className,
				)}
			>
				<ReactMarkdown
					remarkPlugins={[remarkGfm, remarkMath]}
					rehypePlugins={[rehypeKatex]}
					components={{
						p: ({ children }) => (
							<p className="mb-2 last:mb-0 leading-relaxed break-words text-white">
								{children}
							</p>
						),
						strong: ({ children }) => (
							<strong className="font-semibold text-white">{children}</strong>
						),
						a: ({ href, children }) => (
							<a
								href={href}
								target="_blank"
								rel="noopener noreferrer"
								className="text-white underline underline-offset-2 hover:text-emerald-100"
							>
								{children}
							</a>
						),
						code: ({ children, ...props }) => (
							<code
								className="px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-emerald-700/60 text-white"
								{...props}
							>
								{children}
							</code>
						),
					}}
				>
					{content}
				</ReactMarkdown>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"text-sm leading-relaxed text-slate-900 dark:text-slate-100 break-words",
				className,
			)}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkMath]}
				rehypePlugins={[rehypeKatex]}
				components={{
					p: ({ children }) => (
						<p className="mb-2.5 last:mb-0 leading-relaxed break-words">
							{children}
						</p>
					),
					h1: ({ children }) => (
						<h1 className="text-base font-bold mt-4 mb-2 pb-1 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50">
							{children}
						</h1>
					),
					h2: ({ children }) => (
						<h2 className="text-sm font-bold mt-3 mb-1.5 text-slate-900 dark:text-slate-100">
							{children}
						</h2>
					),
					h3: ({ children }) => (
						<h3 className="text-xs font-semibold mt-2.5 mb-1 uppercase tracking-wider text-slate-700 dark:text-slate-300">
							{children}
						</h3>
					),
					ul: ({ children }) => (
						<ul className="list-disc pl-5 my-2 space-y-1 text-slate-800 dark:text-slate-200">
							{children}
						</ul>
					),
					ol: ({ children }) => (
						<ol className="list-decimal pl-5 my-2 space-y-1 text-slate-800 dark:text-slate-200">
							{children}
						</ol>
					),
					li: ({ children }) => <li className="leading-relaxed">{children}</li>,
					strong: ({ children }) => (
						<strong className="font-semibold text-slate-900 dark:text-slate-50">
							{children}
						</strong>
					),
					blockquote: ({ children }) => (
						<blockquote className="border-l-3 border-emerald-500 pl-3 my-2.5 italic text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 py-1 rounded-r-sm">
							{children}
						</blockquote>
					),
					hr: () => (
						<hr className="my-3 border-slate-200 dark:border-slate-800" />
					),
					a: ({ href, children }) => (
						<a
							href={href}
							target="_blank"
							rel="noopener noreferrer"
							className="text-emerald-600 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-700 dark:hover:text-emerald-300"
						>
							{children}
						</a>
					),
					table: ({ children }) => (
						<div className="overflow-x-auto my-3 rounded-lg border border-slate-200 dark:border-slate-800">
							<table className="w-full text-xs text-left border-collapse">
								{children}
							</table>
						</div>
					),
					thead: ({ children }) => (
						<thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200">
							{children}
						</thead>
					),
					tbody: ({ children }) => (
						<tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
							{children}
						</tbody>
					),
					tr: ({ children }) => <tr>{children}</tr>,
					th: ({ children }) => (
						<th className="p-2 font-semibold border-b border-slate-200 dark:border-slate-700">
							{children}
						</th>
					),
					td: ({ children }) => <td className="p-2">{children}</td>,
					code: ({ className: codeClassName, children, ...props }) => {
						const isInline = !codeClassName && !String(children).includes("\n");

						if (isInline) {
							return (
								<code
									className="px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-slate-200/80 dark:border-slate-700/80"
									{...props}
								>
									{children}
								</code>
							);
						}

						return (
							<code
								className="text-xs font-mono block whitespace-pre"
								{...props}
							>
								{children}
							</code>
						);
					},
					pre: ({ children }) => (
						<div className="relative my-2.5 rounded-lg overflow-hidden bg-slate-900 text-slate-100 dark:bg-slate-950 border border-slate-800 shadow-xs">
							<pre className="p-3 overflow-x-auto text-xs leading-relaxed font-mono">
								{children}
							</pre>
						</div>
					),
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
