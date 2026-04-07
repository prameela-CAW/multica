"use client";

import { create } from "zustand";
import type { Issue } from "@/shared/types";
import { toast } from "sonner";
import { api } from "@/shared/api";
import { createLogger } from "@/shared/logger";

const logger = createLogger("issue-store");

const CLOSED_PAGE_SIZE = 50;

interface IssueState {
  issues: Issue[];
  loading: boolean;
  activeIssueId: string | null;
  hasMoreClosed: boolean;
  closedOffset: number;
  fetch: () => Promise<void>;
  fetchMoreClosed: () => Promise<void>;
  setIssues: (issues: Issue[]) => void;
  addIssue: (issue: Issue) => void;
  updateIssue: (id: string, updates: Partial<Issue>) => void;
  removeIssue: (id: string) => void;
  setActiveIssue: (id: string | null) => void;
}

export const useIssueStore = create<IssueState>((set, get) => ({
  issues: [],
  loading: true,
  activeIssueId: null,
  hasMoreClosed: false,
  closedOffset: 0,

  fetch: async () => {
    logger.debug("fetch start");
    const isInitialLoad = get().issues.length === 0;
    if (isInitialLoad) set({ loading: true });
    try {
      // Phase 1: fetch ALL open issues (no limit)
      // Phase 2: fetch first page of closed issues
      const [openRes, closedRes] = await Promise.all([
        api.listIssues({ open_only: true }),
        api.listIssues({ status: "done", limit: CLOSED_PAGE_SIZE, offset: 0 }),
      ]);
      const allIssues = [...openRes.issues, ...closedRes.issues];
      logger.info("fetched", openRes.issues.length, "open +", closedRes.issues.length, "closed issues");
      set({
        issues: allIssues,
        loading: false,
        hasMoreClosed: closedRes.issues.length >= CLOSED_PAGE_SIZE,
        closedOffset: CLOSED_PAGE_SIZE,
      });
    } catch (err) {
      logger.error("fetch failed", err);
      toast.error("Failed to load issues");
      if (isInitialLoad) set({ loading: false });
    }
  },

  fetchMoreClosed: async () => {
    const { closedOffset } = get();
    try {
      const res = await api.listIssues({
        status: "done",
        limit: CLOSED_PAGE_SIZE,
        offset: closedOffset,
      });
      set((s) => ({
        issues: [
          ...s.issues,
          ...res.issues.filter((ni) => !s.issues.some((ei) => ei.id === ni.id)),
        ],
        closedOffset: closedOffset + CLOSED_PAGE_SIZE,
        hasMoreClosed: res.issues.length >= CLOSED_PAGE_SIZE,
      }));
    } catch (err) {
      logger.error("fetchMoreClosed failed", err);
      toast.error("Failed to load more issues");
    }
  },

  setIssues: (issues) => set({ issues }),
  addIssue: (issue) =>
    set((s) => ({
      issues: s.issues.some((i) => i.id === issue.id)
        ? s.issues
        : [...s.issues, issue],
    })),
  updateIssue: (id, updates) =>
    set((s) => ({
      issues: s.issues.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    })),
  removeIssue: (id) =>
    set((s) => ({ issues: s.issues.filter((i) => i.id !== id) })),
  setActiveIssue: (id) => set({ activeIssueId: id }),
}));
