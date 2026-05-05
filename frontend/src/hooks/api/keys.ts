export const queryKeys = {
  jobs: {
    all: ["jobs"] as const,
    lists: () => [...queryKeys.jobs.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.jobs.lists(), filters] as const,
    details: () => [...queryKeys.jobs.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.jobs.details(), id] as const,
  },
  resumes: {
    all: ["resumes"] as const,
    lists: () => [...queryKeys.resumes.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.resumes.lists(), filters] as const,
    details: () => [...queryKeys.resumes.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.resumes.details(), id] as const,
  },
  coverLetters: {
    all: ["coverLetters"] as const,
    lists: () => [...queryKeys.coverLetters.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.coverLetters.lists(), filters] as const,
    details: () => [...queryKeys.coverLetters.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.coverLetters.details(), id] as const,
  },
  user: {
    me: ["user", "me"] as const,
    subscription: ["user", "subscription"] as const,
    usage: ["user", "usage"] as const,
    notifications: ["user", "notifications"] as const,
  },
  plans: {
    all: ["plans"] as const,
  },
  feedback: {
    all: ["feedback"] as const,
    create: () => [...queryKeys.feedback.all, "create"] as const,
  },
  support: {
    all: ["support"] as const,
    contact: () => [...queryKeys.support.all, "contact"] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    detail: (period: string) => ["analytics", period] as const,
  },
  profile: {
    // NOTE: cannot be `["profile"]` — collides with the legacy `hooks/use-profile.ts`
    // which uses that exact key for `getUserData()` (a User object, not a ProfileResponse).
    // The old hook is consumed by sidebar-user / use-subscription / Checkout, so it
    // mounts first on every dashboard page and primes the cache. Without the rename,
    // GET /api/v1/profile is never fired (cache hit on the User object) and the profile
    // form sees `data` as a truthy User with no `profile_data` field.
    all: ["user-profile"] as const,
  },
} as const;
