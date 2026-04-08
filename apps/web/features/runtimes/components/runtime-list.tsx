import { ArrowUpCircle, Server } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AgentRuntime } from "@/shared/types";
import { latestCliVersionOptions } from "@core/runtimes/queries";
import { runtimeNeedsUpdate } from "../version";
import { RuntimeModeIcon } from "./shared";

function RuntimeListItem({
  runtime,
  isSelected,
  hasUpdate,
  onClick,
}: {
  runtime: AgentRuntime;
  isSelected: boolean;
  hasUpdate: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        isSelected ? "bg-accent" : "hover:bg-accent/50"
      }`}
    >
      <div
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          runtime.status === "online" ? "bg-success/10" : "bg-muted"
        }`}
      >
        <RuntimeModeIcon mode={runtime.runtime_mode} />
        {hasUpdate && (
          <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-destructive ring-2 ring-background" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{runtime.name}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {hasUpdate ? (
            <span className="inline-flex items-center gap-1 text-destructive">
              <ArrowUpCircle className="h-3 w-3" />
              Update available
            </span>
          ) : (
            <>
              {runtime.provider} &middot; {runtime.runtime_mode}
            </>
          )}
        </div>
      </div>
      <div
        className={`h-2 w-2 shrink-0 rounded-full ${
          runtime.status === "online" ? "bg-success" : "bg-muted-foreground/40"
        }`}
      />
    </button>
  );
}

export function RuntimeList({
  runtimes,
  selectedId,
  onSelect,
}: {
  runtimes: AgentRuntime[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { data: latestVersion } = useQuery(latestCliVersionOptions());

  return (
    <div className="overflow-y-auto h-full border-r">
      <div className="flex h-12 items-center justify-between border-b px-4">
        <h1 className="text-sm font-semibold">Runtimes</h1>
        <span className="text-xs text-muted-foreground">
          {runtimes.filter((r) => r.status === "online").length}/
          {runtimes.length} online
        </span>
      </div>
      {runtimes.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-12">
          <Server className="h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No runtimes registered
          </p>
          <p className="mt-1 text-xs text-muted-foreground text-center">
            Run{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              multica daemon start
            </code>{" "}
            to register a local runtime.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {runtimes.map((runtime) => (
            <RuntimeListItem
              key={runtime.id}
              runtime={runtime}
              isSelected={runtime.id === selectedId}
              hasUpdate={runtimeNeedsUpdate(runtime, latestVersion ?? null)}
              onClick={() => onSelect(runtime.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
