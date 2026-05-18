import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CurrentSubscription } from "./useCurrentSubscription";
import type { UsageResponse } from "./useUsage";

// ── Types ──────────────────────────────────────────────────────────────────
//
// Mirrors backend `app/schemas/admin.py` (Phase 1 Step 4/5). Enum string
// values for `auth_provider` and `subscription_status` come from
// `backend/app/models/enums.py` — see `AuthProvider` and `SubscriptionStatus`.

export type AdminAuthProvider = "email" | "google";
export type AdminSubscriptionStatus =
  | "active"
  | "cancelled"
  | "past_due"
  | "paused"
  // NOTE: `trialing` is NOT in the backend SubscriptionStatus enum, but the
  // design lists it as a filter option and the SPEC §4.6 schema declares the
  // column as `SubscriptionStatus | None`. Keep it on the TS side so the
  // dropdown compiles; backend will simply never return it today.
  | "trialing";

export interface AdminUserListItem {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  auth_provider: AdminAuthProvider;
  plan_slug: string | null;
  plan_name: string | null;
  subscription_status: AdminSubscriptionStatus | null;
  is_verified: boolean;
  is_admin: boolean;
  ai_operations_used_current_cycle: number;
  active_jobs_count: number;
  created_at: string;
  last_login_at: string | null;
}

export interface AdminUserListResponse {
  items: AdminUserListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminUserCounts {
  jobs: number;
  applications: number;
  resumes: number;
  cover_letters: number;
  feedbacks: number;
}

export interface AdminLifetimeUsage {
  /** All-time successful resume-credit operations (impersonator excluded). */
  resume_generations: number;
  /** All-time successful cover-letter-credit operations. */
  cl_generations: number;
}

export interface AdminUserDetail {
  user: AdminUserListItem;
  subscription: CurrentSubscription | null;
  usage: UsageResponse;
  counts: AdminUserCounts;
  lifetime_usage: AdminLifetimeUsage;
}

// ── Query params ───────────────────────────────────────────────────────────

export interface UseAdminUsersParams {
  q?: string;
  plan?: string; // "all" | "free" | "pro" | "pro_annual"
  status?: string; // currently not sent server-side until backend supports it
  page?: number;
  pageSize?: number;
  sortBy?: "created_at" | "email" | "last_login_at";
  sortOrder?: "asc" | "desc";
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useAdminUsers(
  params: UseAdminUsersParams
): UseQueryResult<AdminUserListResponse, Error> {
  const {
    q = "",
    plan = "all",
    page = 1,
    pageSize = 25,
    sortBy = "created_at",
    sortOrder = "desc",
  } = params;

  return useQuery<AdminUserListResponse, Error>({
    queryKey: ["admin", "users", { q, plan, page, pageSize, sortBy, sortOrder }],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (q) search.set("q", q);
      if (plan && plan !== "all") search.set("plan", plan);
      search.set("page", String(page));
      search.set("page_size", String(pageSize));
      search.set("sort_by", sortBy);
      search.set("sort_order", sortOrder);

      const res = await api.get(`/api/v1/admin/users?${search.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load admin users: HTTP ${res.status}`);
      }
      return res.json();
    },
    staleTime: 1000 * 30,
  });
}

export function useAdminUser(
  userId: string | undefined
): UseQueryResult<AdminUserDetail, Error> {
  return useQuery<AdminUserDetail, Error>({
    queryKey: ["admin", "user", userId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/admin/users/${userId}`);
      if (!res.ok) {
        throw new Error(`Failed to load admin user: HTTP ${res.status}`);
      }
      return res.json();
    },
    enabled: !!userId,
    staleTime: 1000 * 30,
  });
}

// ── Mutations (Phase 1 Step 6) ─────────────────────────────────────────────
//
// Manual admin actions on a user's subscription. All four POST to
// `/api/v1/admin/users/{user_id}/<action>` and on success invalidate the
// per-user detail query AND the users list (the list shows plan_slug +
// ai_operations_used which can change after these actions).
//
// Error parsing mirrors `ResumePreferencesError` in `lib/user.ts`: read the
// FastAPI `detail` field if present, otherwise fall back to a generic HTTP
// message. Callers display `error.message` inline inside the modal.

async function parseAdminError(res: Response, fallback: string): Promise<Error> {
  let message = `${fallback}: HTTP ${res.status}`;
  try {
    const data = await res.json();
    if (data && typeof data === "object" && "detail" in data) {
      message =
        typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail);
    }
  } catch {
    // Body wasn't JSON — keep generic HTTP message.
  }
  return new Error(message);
}

function useInvalidateAdminUser() {
  const queryClient = useQueryClient();
  return (userId: string) => {
    queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  };
}

export interface GrantProPayload {
  userId: string;
  days: number;
}

export function useGrantPro(): UseMutationResult<
  CurrentSubscription,
  Error,
  GrantProPayload
> {
  const invalidate = useInvalidateAdminUser();
  return useMutation<CurrentSubscription, Error, GrantProPayload>({
    mutationFn: async ({ userId, days }) => {
      const res = await api.post(
        `/api/v1/admin/users/${userId}/grant-pro`,
        { days }
      );
      if (!res.ok) throw await parseAdminError(res, "Failed to grant Pro");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidate(variables.userId);
    },
  });
}

export interface AdminUserActionPayload {
  userId: string;
}

export function useCancelSubscription(): UseMutationResult<
  CurrentSubscription,
  Error,
  AdminUserActionPayload
> {
  const invalidate = useInvalidateAdminUser();
  return useMutation<CurrentSubscription, Error, AdminUserActionPayload>({
    mutationFn: async ({ userId }) => {
      const res = await api.post(
        `/api/v1/admin/users/${userId}/cancel-subscription`
      );
      if (!res.ok) throw await parseAdminError(res, "Failed to cancel subscription");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidate(variables.userId);
    },
  });
}

export function useResetBillingCycle(): UseMutationResult<
  CurrentSubscription,
  Error,
  AdminUserActionPayload
> {
  const invalidate = useInvalidateAdminUser();
  return useMutation<CurrentSubscription, Error, AdminUserActionPayload>({
    mutationFn: async ({ userId }) => {
      const res = await api.post(
        `/api/v1/admin/users/${userId}/reset-billing-cycle`
      );
      if (!res.ok) throw await parseAdminError(res, "Failed to reset billing cycle");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidate(variables.userId);
    },
  });
}

export function useResetAiOps(): UseMutationResult<
  UsageResponse,
  Error,
  AdminUserActionPayload
> {
  const invalidate = useInvalidateAdminUser();
  return useMutation<UsageResponse, Error, AdminUserActionPayload>({
    mutationFn: async ({ userId }) => {
      const res = await api.post(
        `/api/v1/admin/users/${userId}/reset-ai-ops`
      );
      if (!res.ok) throw await parseAdminError(res, "Failed to reset AI ops");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidate(variables.userId);
    },
  });
}

// ── Impersonation mutations (Phase 1 Step 7) ───────────────────────────────
//
// `useImpersonate`     POST /api/v1/admin/users/{userId}/impersonate → 204
//                      Backend sets `original_admin_token` + a new `access_token`
//                      cookie. Caller is responsible for the full reload to
//                      `/dashboard` after success (per SPEC §6.4) — we don't do
//                      it inside `mutationFn` so callers can stamp sessionStorage
//                      first (impersonation_target_id + impersonation_started_at).
//
// `useStopImpersonation` POST /api/v1/admin/impersonation/stop → 204
//                      Restores the admin's original `access_token` cookie. The
//                      banner is the only caller; it likewise does the
//                      `window.location.href` redirect itself so it can read the
//                      stored target_id and route the admin back to
//                      `/dashboard/admin/users/{id}`.
//
// Both endpoints return 204 with no body — only check `res.ok`.

export function useImpersonate(): UseMutationResult<
  void,
  Error,
  AdminUserActionPayload
> {
  return useMutation<void, Error, AdminUserActionPayload>({
    mutationFn: async ({ userId }) => {
      const res = await api.post(
        `/api/v1/admin/users/${userId}/impersonate`
      );
      if (!res.ok) throw await parseAdminError(res, "Failed to start impersonation");
    },
  });
}

export function useStopImpersonation(): UseMutationResult<void, Error, void> {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await api.post(`/api/v1/admin/impersonation/stop`);
      if (!res.ok) throw await parseAdminError(res, "Failed to stop impersonation");
    },
  });
}

// ── Feedback list (Phase 1 Step 8) ─────────────────────────────────────────
//
// Mirrors backend `app/schemas/admin.py` `AdminFeedbackItem` /
// `AdminFeedbackListResponse`. Enum strings come from
// `backend/app/models/enums.py` — `FeedbackType` / `FeedbackStatus`.
//
// NOTE: enum values differ from the original SPEC §5.6 prose. Source of truth
// is the Python enum, which currently defines `improvement` (not `praise`) and
// status values `new` / `reviewed` / `planned` / `done` / `declined` (not the
// `triaged`/`responded`/`archived` set used in earlier drafts).

export type FeedbackType =
  | "bug"
  | "feature_request"
  | "improvement"
  | "other";

export type FeedbackStatus =
  | "new"
  | "reviewed"
  | "planned"
  | "done"
  | "declined";

export interface AdminFeedbackItem {
  id: string;
  user_id: string;
  user_email: string;
  user_first_name: string | null;
  user_last_name: string | null;
  type: FeedbackType;
  status: FeedbackStatus;
  message: string;
  page_url: string | null;
  user_agent: string | null;
  created_at: string;
  admin_notes: string | null;
}

export interface AdminFeedbackListResponse {
  items: AdminFeedbackItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface UseAdminFeedbackParams {
  q?: string;
  type?: string; // "all" or one of FeedbackType
  status?: string; // "all" or one of FeedbackStatus
  page?: number;
  pageSize?: number;
}

export function useAdminFeedback(
  params: UseAdminFeedbackParams
): UseQueryResult<AdminFeedbackListResponse, Error> {
  const { q = "", type = "all", status = "all", page = 1, pageSize = 25 } = params;

  return useQuery<AdminFeedbackListResponse, Error>({
    queryKey: ["admin", "feedback", { q, type, status, page, pageSize }],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (q) search.set("q", q);
      if (type && type !== "all") search.set("type", type);
      if (status && status !== "all") search.set("status", status);
      search.set("page", String(page));
      search.set("page_size", String(pageSize));

      const res = await api.get(`/api/v1/admin/feedback?${search.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load admin feedback: HTTP ${res.status}`);
      }
      return res.json();
    },
    staleTime: 1000 * 30,
  });
}

// ── Audit log list (Phase 1 Step 9) ────────────────────────────────────────
//
// Mirrors backend `app/schemas/admin.py` `AdminAuditLogItem` /
// `AdminAuditLogListResponse`. `action` is a free-form string sourced from
// `backend/app/constants/admin_actions.py`; payload is action-specific JSON.
//
// Typical use from the User detail page right column:
//   useAdminAuditLogs({ targetUserId: id, pageSize: 10 })

export interface AdminAuditLogItem {
  id: string;
  // `admin_id` is nullable after the admin deletes their own account — the
  // FK becomes NULL but the audit row survives. `admin_email` is still
  // guaranteed to be a string (backend falls back to a snapshot email or
  // the literal "(deleted admin)"). Mirrors backend `AdminAuditLogItem`
  // in `app/schemas/admin.py` (`admin_id: Optional[uuid.UUID]`).
  admin_id: string | null;
  admin_email: string;
  target_user_id: string | null;
  target_user_email: string | null;
  action: string;
  payload: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface AdminAuditLogListResponse {
  items: AdminAuditLogItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface UseAdminAuditLogsParams {
  targetUserId?: string;
  adminId?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}

export function useAdminAuditLogs(
  params: UseAdminAuditLogsParams
): UseQueryResult<AdminAuditLogListResponse, Error> {
  const { targetUserId, adminId, action, page = 1, pageSize = 25 } = params;

  return useQuery<AdminAuditLogListResponse, Error>({
    queryKey: [
      "admin",
      "audit-logs",
      { targetUserId, adminId, action, page, pageSize },
    ],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (targetUserId) search.set("target_user_id", targetUserId);
      if (adminId) search.set("admin_id", adminId);
      if (action) search.set("action", action);
      search.set("page", String(page));
      search.set("page_size", String(pageSize));

      const res = await api.get(`/api/v1/admin/audit-logs?${search.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load admin audit logs: HTTP ${res.status}`);
      }
      return res.json();
    },
    staleTime: 1000 * 30,
  });
}
