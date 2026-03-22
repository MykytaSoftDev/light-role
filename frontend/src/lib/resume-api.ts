import { api } from './api';
import type {
  ResumeListItem,
  ResumeResponse,
  ResumeData,
} from '@/types/resume';

// ---------------------------------------------------------------------------
// LimitReachedError — thrown when the backend returns 403 (limit exceeded)
// ---------------------------------------------------------------------------

export interface LimitDetail {
  message: string;
  current_usage: number;
  limit: number;
  reset_date: string;
}

export class LimitReachedError extends Error {
  detail: LimitDetail;
  constructor(detail: LimitDetail) {
    super(detail.message ?? "Limit reached");
    this.name = "LimitReachedError";
    this.detail = detail;
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function listResumes(): Promise<{ items: ResumeListItem[]; total: number }> {
  const res = await api.get('/api/v1/resumes?limit=100');
  if (!res.ok) throw new Error(`Failed to fetch resumes: HTTP ${res.status}`);
  return res.json();
}

export async function getResume(id: string): Promise<ResumeResponse> {
  const res = await api.get(`/api/v1/resumes/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch resume: HTTP ${res.status}`);
  return res.json();
}

/**
 * Upload a resume file via multipart/form-data.
 * Cannot use api.post() as that sends JSON; we use raw fetch with FormData.
 */
export async function uploadResume(file: File, jobId?: string): Promise<ResumeResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const url = jobId
    ? `${BASE_URL}/api/v1/resumes/upload?job_id=${encodeURIComponent(jobId)}`
    : `${BASE_URL}/api/v1/resumes/upload`;

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    // Do NOT set Content-Type header — browser sets it with the boundary automatically
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Failed to upload resume: HTTP ${res.status}${errorText ? ` — ${errorText}` : ''}`);
  }
  return res.json();
}

export async function updateResume(
  id: string,
  data: Partial<{
    name: string;
    parsed_data: ResumeData;
    sections_order: string[];
    template: string;
  }>
): Promise<ResumeResponse> {
  const res = await api.patch(`/api/v1/resumes/${id}`, data);
  if (!res.ok) throw new Error(`Failed to update resume: HTTP ${res.status}`);
  return res.json();
}

export async function deleteResume(id: string): Promise<void> {
  const res = await api.delete(`/api/v1/resumes/${id}`);
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete resume: HTTP ${res.status}`);
  }
}

export async function setBaseResume(id: string): Promise<ResumeResponse> {
  const res = await api.patch(`/api/v1/resumes/${id}/set-base`);
  if (!res.ok) throw new Error(`Failed to set base resume: HTTP ${res.status}`);
  return res.json();
}

/**
 * Start an async resume analysis job.
 * Returns 202 Accepted with task_id and resume_id immediately.
 * Poll getAnalysisStatus() until status === 'completed' or 'failed'.
 */
export async function analyzeResume(
  resumeId: string,
  jobId: string
): Promise<{ task_id: string; resume_id: string }> {
  const res = await fetch(`${BASE_URL}/api/v1/resumes/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ resume_id: resumeId, job_id: jobId }),
  });
  if (!res.ok) {
    if (res.status === 403) {
      const json = await res.json().catch(() => ({}));
      throw new LimitReachedError(json?.detail ?? { message: "Limit reached", current_usage: 0, limit: 10, reset_date: "" });
    }
    throw new Error(await res.text());
  }
  return res.json();
}

/**
 * Poll the status of an ongoing analysis task.
 */
export async function getAnalysisStatus(taskId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resume_id: string;
  error?: string;
}> {
  const res = await fetch(`${BASE_URL}/api/v1/resumes/analysis-status/${taskId}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Export resume as PDF or DOCX and trigger a browser file download.
 */
export async function exportResume(id: string, format: 'pdf' | 'docx'): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/resumes/${id}/export?format=${format}`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Export failed');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `resume.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
