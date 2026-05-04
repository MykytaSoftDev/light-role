// STUB FILE — created in ARCH-1 (Phase 3.1) to keep cover-letter UI compiling
// after the legacy resume editor and `lib/resume-api.ts` were deleted.
//
// The cover-letter UI is reworked in Phase 4. Until then, these stubs
// preserve the type surface so TypeScript compiles. Calls will throw at
// runtime — the cover-letter routes are expected to be unreachable in v2.1
// during the transition.

import type { ResumeListItem, ResumeResponse } from '@/types/resume';

export interface LimitDetail {
  message: string;
  current_usage: number;
  limit: number;
  reset_date: string;
}

export class LimitReachedError extends Error {
  detail: LimitDetail;
  constructor(detail: LimitDetail) {
    super(detail.message ?? 'Limit reached');
    this.name = 'LimitReachedError';
    this.detail = detail;
  }
}

const NOT_AVAILABLE = 'Resume API removed in ARCH-1; rework in Phase 4';

export async function listResumes(): Promise<{ items: ResumeListItem[]; total: number }> {
  return { items: [], total: 0 };
}

export async function getResume(_id: string): Promise<ResumeResponse> {
  throw new Error(NOT_AVAILABLE);
}

export async function uploadResume(_file: File, _jobId?: string): Promise<ResumeResponse> {
  throw new Error(NOT_AVAILABLE);
}

export async function updateResume(
  _id: string,
  _data: Partial<{ name: string; sections_order: string[]; template: string }>,
): Promise<ResumeResponse> {
  throw new Error(NOT_AVAILABLE);
}

export async function deleteResume(_id: string): Promise<void> {
  throw new Error(NOT_AVAILABLE);
}

export async function setBaseResume(_id: string): Promise<ResumeResponse> {
  throw new Error(NOT_AVAILABLE);
}

export async function analyzeResume(
  _resumeId: string,
  _jobId: string,
): Promise<{ task_id: string; resume_id: string }> {
  throw new Error(NOT_AVAILABLE);
}

export async function getAnalysisStatus(_taskId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resume_id: string;
  error?: string;
}> {
  throw new Error(NOT_AVAILABLE);
}
