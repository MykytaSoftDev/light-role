"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useAdminUsers } from "@/hooks/api/useAdmin";

import { AdminUsersFilters } from "../_components/admin-users-filters";
import { AdminUsersPagination } from "../_components/admin-users-pagination";
import {
  AdminUsersTable,
  type SortableField,
  type SortOrder,
} from "../_components/admin-users-table";

export default function AdminUsersPage() {
  // Local UI state — page reloads on every filter change reset to page 1.
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortableField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // 300ms debounce on the search box. Backend filters on first_name +
  // last_name + email server-side, so we just hold the typed value locally.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any filter change → reset back to page 1 (preserves the convention of
  // pagination-resets-on-filter-change used elsewhere in the app).
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, plan, status, pageSize, sortBy, sortOrder]);

  const query = useAdminUsers({
    q: debouncedSearch,
    plan,
    page,
    pageSize,
    sortBy,
    sortOrder,
  });

  const handleSortChange = (field: SortableField) => {
    if (field === sortBy) {
      setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setPlan("all");
    setStatus("all");
  };

  const hasActiveFilters = useMemo(
    () => debouncedSearch !== "" || plan !== "all" || status !== "all",
    [debouncedSearch, plan, status]
  );

  const total = query.data?.total ?? 0;
  const rows = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage user accounts, subscriptions, and impersonation.
          </p>
        </div>
      </div>

      <AdminUsersFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        plan={plan}
        onPlanChange={setPlan}
        status={status}
        onStatusChange={setStatus}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={query.data?.total}
      />

      {query.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {query.error?.message ??
                "Something went wrong loading the users list. Try again in a moment."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <AdminUsersTable
            rows={rows}
            isLoading={query.isLoading}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onClearFilters={handleClearFilters}
            hasActiveFilters={hasActiveFilters}
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
