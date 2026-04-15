import type { AnalyticsResponse } from "@/lib/types/analytics";

export const DEMO_ANALYTICS_DATA: AnalyticsResponse = {
  hero_counters: {
    jobs_saved: 18,
    applied: 12,
    interviews: 4,
    offers: 1,
    jobs_saved_delta: 3,
    applied_delta: 2,
    interviews_delta: 1,
    offers_delta: 1,
  },
  funnel: {
    stages: [
      { stage: "saved", count: 18, pct_of_saved: 100, drop_off_pct: null },
      { stage: "applied", count: 12, pct_of_saved: 66.7, drop_off_pct: 33.3 },
      { stage: "screening", count: 7, pct_of_saved: 38.9, drop_off_pct: 41.7 },
      { stage: "interview", count: 4, pct_of_saved: 22.2, drop_off_pct: 42.9 },
      { stage: "offer", count: 1, pct_of_saved: 5.6, drop_off_pct: 75.0 },
    ],
    insight: "Your screening-to-interview conversion is above average. Focus on applying to more roles.",
  },
  timeline: [
    { month: "2025-11", count: 1 },
    { month: "2025-12", count: 2 },
    { month: "2026-01", count: 3 },
    { month: "2026-02", count: 4 },
    { month: "2026-03", count: 5 },
    { month: "2026-04", count: 3 },
  ],
  status_breakdown: [
    { status: "saved", count: 6 },
    { status: "applied", count: 5 },
    { status: "screening", count: 3 },
    { status: "interview", count: 3 },
    { status: "offer", count: 1 },
  ],
  resume_performance: {
    avg_score: 74,
    sparkline: [
      { score: 58, resume_id: "r1", resume_name: "Software Engineer v1" },
      { score: 63, resume_id: "r2", resume_name: "Software Engineer v2" },
      { score: 70, resume_id: "r3", resume_name: "Backend Engineer" },
      { score: 74, resume_id: "r4", resume_name: "Full Stack v1" },
      { score: 82, resume_id: "r5", resume_name: "Full Stack v2" },
    ],
    best_resume_id: "r5",
    best_resume_name: "Full Stack v2",
    best_score: 82,
    worst_resume_id: "r1",
    worst_resume_name: "Software Engineer v1",
    worst_score: 58,
    trend: "improving",
  },
  ai_operations: [
    { operation_type: "resume_analyze", count: 8 },
    { operation_type: "cl_generate", count: 6 },
    { operation_type: "job_parse", count: 12 },
    { operation_type: "cl_regenerate", count: 3 },
  ],
  response_time: {
    avg_days: 5.4,
  },
  data_sufficiency: {
    total_jobs: 18,
    total_applications: 12,
    total_scored_resumes: 5,
    threshold_jobs: 5,
    threshold_applications: 3,
    threshold_scored_resumes: 1,
    has_sufficient_data: true,
  },
};
