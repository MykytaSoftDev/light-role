"use client";

/**
 * Cover Letters — list page (CL-10).
 *
 * Spec: `docs/v2/tasks-cover-letter.json` → CL-10 + PRD §3.6.
 *
 * Mirrors the resumes list page (TAILOR-15) for visual + structural parity:
 *   - Single React-Query call to GET /api/v1/cover-letters (client-side
 *     filter/sort — typical user has <50 CLs, no need to round-trip).
 *   - URL-state for search/sort so refresh / back preserves the view.
 *   - Card-grid layout, optimistic delete with rollback.
 *
 * The CL list endpoint does NOT join the Job row — to render the
 * "{company} — {title}" subtitle we fetch /jobs in parallel and build a
 * lookup map. This is also how the legacy CL list page worked, and matches
 * the wizard's eligible-jobs join pattern.
 */

import { Suspense, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { queryKeys } from "@/hooks/api/keys";
import { deleteCoverLetter, listCoverLetters } from "@/lib/cover-letter-api";
import { listJobs, type JobOption } from "@/lib/jobs-api";
import type { CoverLetterListItem } from "@/types/cover-letter";
import { CoverLetterCard, type JobLookup } from "./_components/cover-letter-card";
import { CoverLetterCardSkeleton } from "./_components/cover-letter-list-skeleton";
import { CoverLettersEmptyState } from "./_components/cover-letter-list-empty";
import {
  CoverLettersFilterBar,
  DEFAULT_SORT,
  type SortValue,
} from "./_components/cover-letters-filter-bar";

const VALID_SORTS: ReadonlyArray<SortValue> = [
  "newest",
  "oldest",
  "recently_updated",
];

function isSortValue(v: string | null): v is SortValue {
  return v != null && (VALID_SORTS as readonly string[]).includes(v);
}

interface CoverLetterListResponse {
  items: CoverLetterListItem[];
  total: number;
}

// ---------------------------------------------------------------------------
// Filter / sort logic (pure)
// ---------------------------------------------------------------------------

function applyFilters(
  items: CoverLetterListItem[],
  query: string,
  jobLookup: JobLookup
): CoverLetterListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((cl) => {
    if (cl.name.toLowerCase().includes(q)) return true;
    if (cl.job_id) {
      const job = jobLookup.get(cl.job_id);
      if (job) {
        if (job.title?.toLowerCase().includes(q)) return true;
        if (job.company?.toLowerCase().includes(q)) return true;
      }
    }
    return false;
  });
}

function applySort(
  items: CoverLetterListItem[],
  sort: SortValue
): CoverLetterListItem[] {
  const out = [...items];
  switch (sort) {
    case "newest":
      out.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      break;
    case "oldest":
      out.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      break;
    case "recently_updated":
      out.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Inner client (reads searchParams — must be wrapped in Suspense in Next.js 15)
// ---------------------------------------------------------------------------

function CoverLettersListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // ------- URL-derived state -------
  const search = searchParams.get("q") ?? "";
  const sortParam = searchParams.get("sort");
  const sort: SortValue = isSortValue(sortParam) ? sortParam : DEFAULT_SORT;

  // ------- Helper to update URL (defaults omitted) -------
  const updateParams = useCallback(
    (next: { q?: string; sort?: SortValue }) => {
      const usp = new URLSearchParams(searchParams.toString());

      if (next.q !== undefined) {
        if (next.q === "") usp.delete("q");
        else usp.set("q", next.q);
      }
      if (next.sort !== undefined) {
        if (next.sort === DEFAULT_SORT) usp.delete("sort");
        else usp.set("sort", next.sort);
      }

      const qs = usp.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams]
  );

  // ------- Data -------
  // Cover letters list. The list endpoint does NOT join the Job row —
  // we resolve {company, title} via a parallel /jobs fetch below.
  const {
    data: clData,
    isLoading: clLoading,
    isError: clError,
    refetch: refetchCovers,
    dataUpdatedAt,
  } = useQuery<CoverLetterListResponse>({
    queryKey: queryKeys.coverLetters.list(),
    queryFn: () => listCoverLetters(),
    staleTime: 1000 * 60 * 2,
  });

  // Jobs — needed to render `{company} — {title}` on each card (CL-10 spec).
  // Reuses queryKeys.jobs.lists() so it shares cache with the Jobs page.
  const { data: jobsData } = useQuery<{ items: JobOption[]; total: number }>({
    queryKey: queryKeys.jobs.lists(),
    queryFn: () => listJobs(),
    staleTime: 1000 * 60 * 2,
  });

  // Mount-time invalidate so a stale tab refreshes when the user returns.
  // Cross-tab "I generated a CL in another tab" recovery (mirrors TAILOR-15).
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.coverLetters.list() });
    // mount-only on purpose — we don't want this to fire on every searchParam change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On window focus, refetch if last fetch is older than 10s.
  useEffect(() => {
    const handler = () => {
      if (Date.now() - dataUpdatedAt > 10_000) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.coverLetters.list(),
        });
      }
    };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [dataUpdatedAt, queryClient]);

  const coverLetters = useMemo(() => clData?.items ?? [], [clData]);

  const jobLookup: JobLookup = useMemo(() => {
    const map: JobLookup = new Map();
    for (const j of jobsData?.items ?? []) {
      map.set(j.id, { title: j.title, company: j.company });
    }
    return map;
  }, [jobsData]);

  const filteredSorted = useMemo(() => {
    return applySort(applyFilters(coverLetters, search, jobLookup), sort);
  }, [coverLetters, search, jobLookup, sort]);

  // ------- Delete mutation (optimistic) -------
  const deleteMutation = useMutation({
    mutationFn: deleteCoverLetter,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.coverLetters.list(),
      });
      const snapshot = queryClient.getQueryData<CoverLetterListResponse>(
        queryKeys.coverLetters.list()
      );
      if (snapshot) {
        queryClient.setQueryData<CoverLetterListResponse>(
          queryKeys.coverLetters.list(),
          {
            items: snapshot.items.filter((cl) => cl.id !== id),
            total: Math.max(0, snapshot.total - 1),
          }
        );
      }
      return { snapshot };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData(
          queryKeys.coverLetters.list(),
          ctx.snapshot
        );
      }
      toast.error("Failed to delete cover letter. Please try again.");
    },
    onSuccess: () => {
      toast.success("Cover letter deleted.");
    },
    onSettled: () => {
      // Reconcile with server. Also invalidates job-detail caches that
      // surface a CL CTA, plus any per-job CL-existence checks the menu
      // makes (broad-stroke — `coverLetters.all` covers both shapes).
      queryClient.invalidateQueries({ queryKey: queryKeys.coverLetters.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });

  // ------- Handlers -------
  const handleSearchChange = useCallback(
    (q: string) => updateParams({ q }),
    [updateParams]
  );
  const handleSortChange = useCallback(
    (s: SortValue) => updateParams({ sort: s }),
    [updateParams]
  );
  const handleClearAll = useCallback(
    () => updateParams({ q: "", sort: DEFAULT_SORT }),
    [updateParams]
  );

  const totalCovers = coverLetters.length;
  const hasFilters = search !== "" || sort !== DEFAULT_SORT;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Cover Letters" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cover Letters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-generated cover letters tailored to your jobs.
          </p>
        </div>
        <Button asChild className="gap-1.5">
          <Link href="/dashboard/cover-letters/generate">
            <Plus className="h-4 w-4" />
            Generate New Cover Letter
          </Link>
        </Button>
      </div>

      {/* Filter bar — always rendered */}
      <CoverLettersFilterBar
        search={search}
        onSearchChange={handleSearchChange}
        sort={sort}
        onSortChange={handleSortChange}
        count={filteredSorted.length}
        onClearAll={handleClearAll}
      />

      {/* Body */}
      {clLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CoverLetterCardSkeleton key={i} />
          ))}
        </div>
      ) : clError ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/30 py-16">
          <EmptyState
            icon={<AlertCircle className="h-8 w-8 text-destructive" />}
            title="Couldn't load cover letters"
            description="We hit an error fetching your cover letters. Try again, or refresh the page."
            action={{ label: "Try again", onClick: () => refetchCovers() }}
          />
        </div>
      ) : totalCovers === 0 ? (
        <CoverLettersEmptyState variant="empty" />
      ) : filteredSorted.length === 0 ? (
        <CoverLettersEmptyState
          variant="no-matches"
          onClearFilters={hasFilters ? handleClearAll : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filteredSorted.map((cl) => (
            <CoverLetterCard
              key={cl.id}
              coverLetter={cl}
              jobLookup={jobLookup}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (Suspense boundary required for `useSearchParams` in Next.js 15)
// ---------------------------------------------------------------------------

export default function CoverLettersListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6 p-6">
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CoverLetterCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <CoverLettersListInner />
    </Suspense>
  );
}
