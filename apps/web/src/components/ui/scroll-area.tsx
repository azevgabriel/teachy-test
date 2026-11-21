import * as React from "react";
import { cn } from "#/lib/utils";

export type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement>;

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
	({ className, children, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={cn("relative overflow-y-auto scroll-smooth", className)}
				{...props}
			>
				{children}
			</div>
		);
	},
);
ScrollArea.displayName = "ScrollArea";
