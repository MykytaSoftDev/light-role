// ---------------------------------------------------------------------------
// Analytics redesign — new shape (SPEC-analytics-redesign.md §3).
//
// Mirrors backend/app/schemas/analytics.py AnalyticsResponse. Legacy types
// (FunnelData, HeroCounters, ResumePerformanceData, ResponseTimeData,
// AIOperationCount, DataSufficiency, and the legacy AnalyticsResponse fields)
// are retained at the bottom marked @deprecated until Phase 10.5 cleanup so
// that DEMO_ANALYTICS_DATA and the orphaned legacy card components still
// type-check while the new page lands.
// ---------------------------------------------------------------------------

export type AnalyticsPeriod = "7d" | "30d" | "90d" | "all";

/** One bucket of the applications timeline (day/week/month — granularity is
 * server-determined; date is always the start of the bucket as ISO date). */
export interface TimelineBucket {
  date: string;
  count: number;
}

/** One day in the activity heatmap. Always daily granularity and covers the
 * last ~91 days regardless of the page period selector. */
export interface DailyActivity {
  date: string;
  count: number;
}

/** Best 7-day window of applications, all-time. */
export interface PersonalBest {
  start_date: string;
  end_date: string;
  count: number;
  metric: "applications";
}

/** One headline KPI card on the strip. */
export interface KpiMetric {
  current: number;
  delta: number;
  sparkline: number[];
}

/** One stage row of the cumulative funnel. `percentage_of_top` is count /
 * saved-stage-count (0 when saved == 0). */
export interface FunnelStage {
  stage: "saved" | "applied" | "screening" | "interview" | "offer";
  count: number;
  percentage_of_top: number;
}

/** One slice of the active-pipeline donut. `status` is an ApplicationStatus
 * enum value from the backend (kept as string here — the donut component
 * narrows when it maps colors). */
export interface StatusCount {
  status: string;
  count: number;
}

/** One bucket of the document-generation timeline. Granularity matches the
 * applications timeline so the charts line up visually. */
export interface GenerationBucket {
  date: string;
  resumes: number;
  cover_letters: number;
}

export type ActivityEventType =
  | "status_change_offer"
  | "status_change_interview"
  | "status_change_screening"
  | "status_change_applied"
  | "status_change_rejected"
  | "resume_tailored"
  | "cover_letter_generated"
  | "job_saved";

/** One row in the recent-activity feed. `id` is composite
 * (`{source}_{source_id}`) so list keys never collide across the three
 * event sources.
 *
 * The new structured fields (`company`, `role`, `to_status`) are the canonical
 * source of truth — the title is now built client-side via `useTranslations`
 * off `type` + `company` + `role`. The legacy `title` and `meta` fields are
 * still returned by the backend (Russian-hardcoded) but should not be read. */
export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  occurred_at: string;
  /** @deprecated Russian-hardcoded backend pre-format. Build the title
   * client-side from `type` + `company` + `role` using `useTranslations`. */
  title: string;
  /** @deprecated Russian-hardcoded backend meta (e.g. "новый статус: ..."),
   * redundant with the localised action verb. Do not render. */
  meta: string | null;
  application_id: string | null;
  /** Company name when the event has an associated application/job (e.g. "Acme"). */
  company: string | null;
  /** Role/title when the event has an associated application/job (e.g. "Senior Frontend Engineer"). */
  role: string | null;
  /** Destination status for `status_change_*` events; null for other event types. */
  to_status: string | null;
}

/** Full payload returned by `GET /api/v1/analytics?period={period}`. */
export interface AnalyticsResponse {
  period: AnalyticsPeriod;
  period_start: string;
  period_end: string;

  // Hero block — big number + dual-line chart.
  applications_current: number;
  applications_previous: number;
  applications_delta: number;
  applications_timeline: TimelineBucket[];
  applications_timeline_previous: TimelineBucket[];

  // Streak panel — heatmap is period-independent (always last 91 days).
  current_streak_days: number;
  longest_streak_days: number;
  daily_activity: DailyActivity[];
  personal_best: PersonalBest | null;

  // KPI strip — 4 cards with sparklines.
  jobs_saved: KpiMetric;
  applied: KpiMetric;
  interviews: KpiMetric;
  offers: KpiMetric;

  // Funnel + insight callout.
  funnel: FunnelStage[];
  funnel_insight: string | null;

  // Active-pipeline donut.
  status_breakdown: StatusCount[];

  // Generations area chart.
  generations_total_resumes: number;
  generations_total_cover_letters: number;
  generations_timeline: GenerationBucket[];

  // Recent-activity feed.
  recent_activity: ActivityEvent[];
}

// ---------------------------------------------------------------------------
// LEGACY shape — kept until Phase 10.5 cleanup so that DEMO_ANALYTICS_DATA
// and the orphaned legacy card components (HeroStats, ConversionFunnel,
// ApplicationsTimeline, StatusBreakdown, ResumePerformance, ResponseTime,
// AIOperationsBreakdown, InsufficientDataState) still type-check.
//
// Do not extend or add new usages — these interfaces will be deleted.
// ---------------------------------------------------------------------------

/** @deprecated Legacy funnel stage with drop-off semantics. Use FunnelStage above. */
export interface FunnelStageLegacy {
  stage: string;
  count: number;
  pct_of_saved: number;
  drop_off_pct: number | null;
}

/** @deprecated Legacy funnel wrapper. */
export interface FunnelData {
  stages: FunnelStageLegacy[];
  insight: string | null;
}

/** @deprecated Legacy month-granularity bucket. Use TimelineBucket above. */
export interface TimelineMonth {
  month: string;
  count: number;
}

/** @deprecated Legacy resume sparkline point. */
export interface ResumeSparklinePoint {
  score: number;
  resume_id: string;
  resume_name: string;
}

/** @deprecated Legacy resume-performance block. */
export interface ResumePerformanceData {
  avg_score: number | null;
  sparkline: ResumeSparklinePoint[];
  best_resume_id: string | null;
  best_resume_name: string | null;
  best_score: number | null;
  worst_resume_id: string | null;
  worst_resume_name: string | null;
  worst_score: number | null;
  trend: "improving" | "declining" | "stable" | null;
}

/** @deprecated Legacy AI operation count. */
export interface AIOperationCount {
  operation_type: string;
  count: number;
}

/** @deprecated Legacy hero counters block. Use KpiMetric per-card above. */
export interface HeroCounters {
  jobs_saved: number;
  applied: number;
  interviews: number;
  offers: number;
  jobs_saved_delta: number;
  applied_delta: number;
  interviews_delta: number;
  offers_delta: number;
}

/** @deprecated Legacy response-time block (removed from the redesigned page). */
export interface ResponseTimeData {
  avg_days: number | null;
}

/** @deprecated Legacy data-sufficiency gate (removed from the redesigned page). */
export interface DataSufficiency {
  total_jobs: number;
  total_applications: number;
  total_scored_resumes: number;
  threshold_jobs: number;
  threshold_applications: number;
  threshold_scored_resumes: number;
  has_sufficient_data: boolean;
}

/** @deprecated Legacy analytics response shape. Use AnalyticsResponse above.
 * Kept so DEMO_ANALYTICS_DATA and the orphaned card components compile until
 * Phase 10.5 cleanup. */
export interface AnalyticsResponseLegacy {
  funnel: FunnelData;
  timeline: TimelineMonth[];
  status_breakdown: StatusCount[];
  resume_performance: ResumePerformanceData;
  ai_operations: AIOperationCount[];
  response_time: ResponseTimeData;
  hero_counters: HeroCounters;
  data_sufficiency: DataSufficiency;
}
