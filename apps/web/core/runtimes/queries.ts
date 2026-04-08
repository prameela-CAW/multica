import { queryOptions } from "@tanstack/react-query";
import { api } from "@/shared/api";
import { fetchLatestVersion } from "@/features/runtimes/version";

export const runtimeKeys = {
  all: (wsId: string) => ["runtimes", wsId] as const,
  list: (wsId: string) => [...runtimeKeys.all(wsId), "list"] as const,
};

export function runtimeListOptions(wsId: string) {
  return queryOptions({
    queryKey: runtimeKeys.list(wsId),
    queryFn: () => api.listRuntimes({ workspace_id: wsId }),
  });
}

export function latestCliVersionOptions() {
  return queryOptions({
    queryKey: ["cli", "latest-version"] as const,
    queryFn: fetchLatestVersion,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
