import type * as React from "react";
import { cn } from "#/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
	variant?: "default" | "secondary" | "destructive" | "outline";
}

export function Badge({
	className,
	variant = "default",
	...props
}: BadgeProps) {
	const baseStyles =
		"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

	const variantStyles = {
		default:
			"border-transparent bg-emerald-600 text-white hover:bg-emerald-700",
		secondary:
			"border-transparent bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
		destructive:
			"border-transparent bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
		outline:
			"text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
	};

	return (
		<div
			className={cn(baseStyles, variantStyles[variant], className)}
			{...props}
		/>
	);
}
