"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useAdminFeedback } from "@/hooks/api/useAdmin";

import { AdminFeedbackFilters } from "../_components/admin-feedback-filters";
import { AdminFeedbackTable } from "../_components/admin-feedback-table";
import { AdminUsersPagination } from "../_components/admin-users-pagination";

export default function AdminFeedbackPage() {
  // Local UI state — every filter change resets to page 1, matching the
  // convention from the Users list page.
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // 300ms debounce on the search box. Backend filters on first_name +
  // last_name + email server-side, so we just hold the typed value locally.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, type, status, pageSize]);

  const query = useAdminFeedback({
    q: debouncedSearch,
    type,
    status,
    page,
    pageSize,
  });

  const handleClearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setType("all");
    setStatus("all");
  };

  const hasActiveFilters = useMemo(
    () => debouncedSearch !== "" || type !== "all" || status !== "all",
    [debouncedSearch, type, status]
  );

  const total = query.data?.total ?? 0;
  const rows = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Feedback</h1>
        <p className="text-sm text-muted-foreground">
          User-submitted feedback across the app.
        </p>
      </div>

      <AdminFeedbackFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        type={type}
        onTypeChange={setType}
        status={status}
        onStatusChange={setStatus}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={query.data?.total}
      />

      {query.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {query.error?.message ??
                "Something went wrong loading the feedback list. Try again in a moment."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <AdminFeedbackTable
            rows={rows}
            isLoading={query.isLoading}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
          />
          <div className="border-t border-border" />
          <AdminUsersPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
