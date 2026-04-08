"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { IssueReaction } from "@/shared/types";
import type {
  IssueReactionAddedPayload,
  IssueReactionRemovedPayload,
} from "@/shared/types";
import { issueReactionsOptions, issueKeys } from "@core/issues/queries";
import { useToggleIssueReaction } from "@core/issues/mutations";
import { useWSEvent, useWSReconnect } from "@/features/realtime";

export function useIssueReactions(issueId: string, userId?: string) {
  const qc = useQueryClient();
  const { data: reactions = [], isLoading: loading } = useQuery(
    issueReactionsOptions(issueId),
  );

  const toggleMutation = useToggleIssueReaction(issueId);

  // Reconnect recovery
  useWSReconnect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: issueKeys.reactions(issueId) });
    }, [qc, issueId]),
  );

  // --- WS event handlers ---

  useWSEvent(
    "issue_reaction:added",
    useCallback(
      (payload: unknown) => {
        const { reaction, issue_id } = payload as IssueReactionAddedPayload;
        if (issue_id !== issueId) return;
        qc.setQueryData<IssueReaction[]>(
          issueKeys.reactions(issueId),
          (old) => {
            if (!old) return old;
            if (old.some((r) => r.id === reaction.id)) return old;
            return [...old, reaction];
          },
        );
      },
      [qc, issueId],
    ),
  );

  useWSEvent(
    "issue_reaction:removed",
    useCallback(
      (payload: unknown) => {
        const p = payload as IssueReactionRemovedPayload;
        if (p.issue_id !== issueId) return;
        qc.setQueryData<IssueReaction[]>(
          issueKeys.reactions(issueId),
          (old) =>
            old?.filter(
              (r) =>
                !(
                  r.emoji === p.emoji &&
                  r.actor_type === p.actor_type &&
                  r.actor_id === p.actor_id
                ),
            ),
        );
      },
      [qc, issueId],
    ),
  );

  // --- Mutation ---

  const toggleReaction = useCallback(
    async (emoji: string) => {
      if (!userId) return;
      const existing = reactions.find(
        (r) =>
          r.emoji === emoji &&
          r.actor_type === "member" &&
          r.actor_id === userId,
      );
      toggleMutation.mutate({ emoji, existing });
    },
    [userId, reactions, toggleMutation],
  );

  return { reactions, loading, toggleReaction };
}
