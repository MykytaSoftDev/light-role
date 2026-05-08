"use client";

/**
 * Tailored Resumes — list page (TAILOR-15).
 *
 * Spec: docs/v2/specs/resumes-list-spec.md
 *
 * The page is a thin shell: filter bar (URL-state-backed) + grid +
 * empty/loading/error states. Heavy lifting (the card visual, dialog,
 * skeletons, filter chrome) lives in `_components/`.
 *
 * Data: a single React-Query call to GET /api/v1/tailored-resumes. We do
 * filter/sort client-side because the typical user has <50 resumes — the
 * payload is tiny and round-trip latency on every keystroke would feel
 * sluggish. Spec §7.2.
 *
 * URL state (spec §7): `?q=`, `?job=uuid,uuid`, `?sort=newest|oldest|name_asc|name_desc`.
 * Defaults are omitted from the URL.
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
import {
  deleteTailoredResume,
  listTailoredResumes,
  type TailoredResumeListItem,
  type TailoredResumeListResponse,
} from "@/lib/tailored-resume-api";
import { ResumeCard } from "./_components/resume-card";
import { ResumeCardSkeleton } from "./_components/resume-card-skeleton";
import { ResumesEmptyState } from "./_components/resumes-empty-state";
import {
  DEFAULT_SORT,
  ResumesFilterBar,
  type JobFilterOption,
  type SortValue,
} from "./_components/resumes-filter-bar";

const VALID_SORTS: ReadonlyArray<SortValue> = [
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
];

function isSortValue(v: string | null): v is SortValue {
  return v != null && (VALID_SORTS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Filter / sort logic (pure)
// ---------------------------------------------------------------------------

function applyFilters(
  resumes: TailoredResumeListItem[],
  query: string,
  selectedJobIds: Set<string>
): TailoredResumeListItem[] {
  const q = query.trim().toLowerCase();
  return resumes.filter((r) => {
    if (selectedJobIds.size > 0 && !selectedJobIds.has(r.job_id)) return false;
    if (q && !r.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

function applySort(
  resumes: TailoredResumeListItem[],
  sort: SortValue
): TailoredResumeListItem[] {
  const out = [...resumes];
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
    case "name_asc":
      out.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name_desc":
      out.sort((a, b) => b.name.localeCompare(a.name));
      break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Inner client (reads searchParams — must be wrapped in Suspense in Next.js 15)
// ---------------------------------------------------------------------------

function ResumesListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // ------- URL-derived state -------
  const search = searchParams?.get("q") ?? "";
  const jobParam = searchParams?.get("job") ?? "";
  const sortParam = searchParams?.get("sort") ?? null;
  const sort: SortValue = isSortValue(sortParam) ? sortParam : DEFAULT_SORT;
  const selectedJobIds = useMemo(
    () => new Set(jobParam ? jobParam.split(",").filter(Boolean) : []),
    [jobParam]
  );

  // ------- Helper to update URL (defaults omitted) -------
  const updateParams = useCallback(
    (next: { q?: string; jobs?: Set<string>; sort?: SortValue }) => {
      const usp = new URLSearchParams(searchParams?.toString() ?? "");

      if (next.q !== undefined) {
        if (next.q === "") usp.delete("q");
        else usp.set("q", next.q);
      }
      if (next.jobs !== undefined) {
        if (next.jobs.size === 0) usp.delete("job");
        else usp.set("job", Array.from(next.jobs).join(","));
      }
      if (next.sort !== undefined) {
        if (next.sort === DEFAULT_SORT) usp.delete("sort");
        else usp.set("sort", next.sort);
      }

      const qs = usp.toString();
      // replace, not push — keystroke history would be intolerable.
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams]
  );

  // ------- Data -------
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery<
    TailoredResumeListResponse
  >({
    queryKey: queryKeys.resumes.lists(),
    queryFn: () => listTailoredResumes({ limit: 100 }),
    staleTime: 1000 * 60 * 2,
  });

  // Invalidate on mount so a stale tab refreshes when the user comes back.
  // (Spec §3.3 — handles the cross-tab "I tailored in another tab" case.)
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.resumes.lists() });
    // mount-only on purpose — we don't want this to fire on every searchParam change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On window focus, refetch if last fetch is older than 10s. Cheap polling
  // without a timer (§3.3).
  useEffect(() => {
    const handler = () => {
      if (Date.now() - dataUpdatedAt > 10_000) {
        queryClient.invalidateQueries({ queryKey: queryKeys.resumes.lists() });
      }
    };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [dataUpdatedAt, queryClient]);

  const resumes = useMemo(() => data?.items ?? [], [data]);

  // Job options derived from loaded resumes (spec §1.3).
  const jobOptions: JobFilterOption[] = useMemo(() => {
    const seen = new Map<string, JobFilterOption>();
    for (const r of resumes) {
      if (seen.has(r.job_id)) continue;
      const label =
        r.job_company && r.job_title
          ? `${r.job_title} — ${r.job_company}`
          : r.job_title || r.job_company || "Untitled job";
      seen.set(r.job_id, { id: r.job_id, label });
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [resumes]);

  const filteredSorted = useMemo(() => {
    return applySort(applyFilters(resumes, search, selectedJobIds), sort);
  }, [resumes, search, selectedJobIds, sort]);

  // ------- Delete mutation (optimistic) -------
  const deleteMutation = useMutation({
    mutationFn: deleteTailoredResume,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.resumes.lists(),
      });
      const snapshot = queryClient.getQueryData<TailoredResumeListResponse>(
        queryKeys.resumes.lists()
      );
      if (snapshot) {
        queryClient.setQueryData<TailoredResumeListResponse>(
          queryKeys.resumes.lists(),
          {
            items: snapshot.items.filter((r) => r.id !== id),
            total: Math.max(0, snapshot.total - 1),
          }
        );
      }
      return { snapshot };
    },
    onError: (_err, _id, ctx) => {
      // Roll back the optimistic remove.
      if (ctx?.snapshot) {
        queryClient.setQueryData(queryKeys.resumes.lists(), ctx.snapshot);
      }
      toast.error("Failed to delete resume. Please try again.");
    },
    onSuccess: () => {
      toast.success("Resume deleted.");
    },
    onSettled: () => {
      // Reconcile with server (also clears any per-job tailored-resume cache
      // entries — TAILOR-16 menu state will repaint correctly on next open).
      queryClient.invalidateQueries({
        queryKey: queryKeys.resumes.lists(),
      });
    },
  });

  // ------- Handlers -------
  const handleSearchChange = useCallback(
    (q: string) => updateParams({ q }),
    [updateParams]
  );
  const handleJobsChange = useCallback(
    (jobs: Set<string>) => updateParams({ jobs }),
    [updateParams]
  );
  const handleSortChange = useCallback(
    (s: SortValue) => updateParams({ sort: s }),
    [updateParams]
  );
  const handleClearAll = useCallback(
    () => updateParams({ q: "", jobs: new Set(), sort: DEFAULT_SORT }),
    [updateParams]
  );

  const totalResumes = resumes.length;
  const hasFilters =
    search !== "" || selectedJobIds.size > 0 || sort !== DEFAULT_SORT;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Breadcrumb (spec §1.2) */}
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Resumes" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Resumes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tailored resumes you&apos;ve generated for your jobs.
          </p>
        </div>
        <Button asChild className="gap-1.5">
          <Link href="/dashboard/resumes/tailor">
            <Plus className="h-4 w-4" />
            Tailor New Resume
          </Link>
        </Button>
      </div>

      {/* Filter bar — always rendered */}
      <ResumesFilterBar
        search={search}
        onSearchChange={handleSearchChange}
        jobOptions={jobOptions}
        selectedJobIds={selectedJobIds}
        onSelectedJobsChange={handleJobsChange}
        sort={sort}
        onSortChange={handleSortChange}
        count={filteredSorted.length}
        onClearAll={handleClearAll}
      />

      {/* Body */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ResumeCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/30 py-16">
          <EmptyState
            icon={<AlertCircle className="h-8 w-8 text-destructive" />}
            title="Couldn't load resumes"
            description="We hit an error fetching your resumes. Try again, or refresh the page."
            action={{ label: "Try again", onClick: () => refetch() }}
          />
        </div>
      ) : totalResumes === 0 ? (
        <ResumesEmptyState variant="empty" />
      ) : filteredSorted.length === 0 ? (
        <ResumesEmptyState
          variant="no-matches"
          onClearFilters={hasFilters ? handleClearAll : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filteredSorted.map((resume) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
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

export default function ResumesListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6 p-6">
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ResumeCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <ResumesListInner />
    </Suspense>
  );
}
