export interface FunnelStage {
  stage: string;
  count: number;
  pct_of_saved: number;
  drop_off_pct: number | null;
}

export interface FunnelData {
  stages: FunnelStage[];
  insight: string | null;
}

export interface TimelineMonth {
  month: string; // "2025-10"
  count: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface ResumeSparklinePoint {
  score: number;
  resume_id: string;
  resume_name: string;
}

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

export interface AIOperationCount {
  operation_type: string;
  count: number;
}

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

export interface ResponseTimeData {
  avg_days: number | null;
}

export interface DataSufficiency {
  total_jobs: number;
  total_applications: number;
  total_scored_resumes: number;
  threshold_jobs: number;
  threshold_applications: number;
  threshold_scored_resumes: number;
  has_sufficient_data: boolean;
}

export interface AnalyticsResponse {
  funnel: FunnelData;
  timeline: TimelineMonth[];
  status_breakdown: StatusCount[];
  resume_performance: ResumePerformanceData;
  ai_operations: AIOperationCount[];
  response_time: ResponseTimeData;
  hero_counters: HeroCounters;
  data_sufficiency: DataSufficiency;
}

export type AnalyticsPeriod = "7d" | "30d" | "90d" | "all";
