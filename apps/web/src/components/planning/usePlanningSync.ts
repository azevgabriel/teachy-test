import * as React from "react";
import type { PlanningResponseDto } from "./types";

interface UsePlanningSyncOptions {
	sessionId?: string;
}

export function usePlanningSync({ sessionId }: UsePlanningSyncOptions = {}) {
	const [data, setData] = React.useState<PlanningResponseDto | null>(null);
	const [isLoading, setIsLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const fetchPlanning = React.useCallback(
		async (targetSessionId?: string) => {
			const id = targetSessionId || sessionId;
			if (!id) {
				setData(null);
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setError(null);

			try {
				const res = await fetch(`/api/sessions/${id}/planning`);
				if (!res.ok) {
					if (res.status === 404) {
						setData({ planning: null, specifications: [] });
						return;
					}
					throw new Error(`Falha ao obter planejamento (${res.statusText})`);
				}

				const json: PlanningResponseDto = await res.json();
				setData(json);
			} catch (err) {
				const msg =
					err instanceof Error ? err.message : "Erro ao carregar planejamento.";
				setError(msg);
				console.error("Erro no usePlanningSync:", err);
			} finally {
				setIsLoading(false);
			}
		},
		[sessionId],
	);

	// Busca automaticamente quando o sessionId mudar
	React.useEffect(() => {
		if (sessionId) {
			fetchPlanning(sessionId);
		} else {
			setData(null);
		}
	}, [sessionId, fetchPlanning]);

	return {
		data,
		isLoading,
		error,
		refetch: fetchPlanning,
	};
}
