import { api } from './api';
import type {
  CoverLetterListItem,
  CoverLetterResponse,
  GenerateVariantsResponse,
  CLStyle,
  CLTone,
  CLLength,
} from '@/types/cover-letter';
import { LimitReachedError } from './resume-api';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function listCoverLetters(
  jobId?: string
): Promise<{ items: CoverLetterListItem[]; total: number }> {
  const url = jobId
    ? `/api/v1/cover-letters/?job_id=${encodeURIComponent(jobId)}`
    : '/api/v1/cover-letters/';
  const res = await api.get(url);
  if (!res.ok) throw new Error(`Failed to fetch cover letters: HTTP ${res.status}`);
  return res.json();
}

export async function getCoverLetter(id: string): Promise<CoverLetterResponse> {
  const res = await api.get(`/api/v1/cover-letters/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch cover letter: HTTP ${res.status}`);
  return res.json();
}

export async function generateCoverLetter(data: {
  job_id: string;
  resume_id: string;
  style: CLStyle;
  tone: CLTone;
  length: CLLength;
  additional_context: string;
}): Promise<GenerateVariantsResponse> {
  const res = await api.post('/api/v1/cover-letters/generate', data);
  if (!res.ok) {
    if (res.status === 403) {
      const json = await res.json().catch(() => ({}));
      throw new LimitReachedError(json?.detail ?? { message: "Limit reached", current_usage: 0, limit: 10, reset_date: "" });
    }
    throw new Error(`Failed to generate cover letter: HTTP ${res.status}`);
  }
  return res.json();
}

export async function regenerateCoverLetter(
  id: string,
  data: {
    style?: CLStyle;
    tone?: CLTone;
    length?: CLLength;
    additional_context?: string;
  }
): Promise<GenerateVariantsResponse> {
  const res = await api.post(`/api/v1/cover-letters/${id}/regenerate`, data);
  if (!res.ok) {
    if (res.status === 403) {
      const json = await res.json().catch(() => ({}));
      throw new LimitReachedError(json?.detail ?? { message: "Limit reached", current_usage: 0, limit: 10, reset_date: "" });
    }
    throw new Error(`Failed to regenerate cover letter: HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateCoverLetter(
  id: string,
  data: Partial<{
    content: string;
    name: string;
    style: CLStyle;
    tone: CLTone;
    length_setting: CLLength;
    selected_variant_index: number;
  }>
): Promise<CoverLetterResponse> {
  const res = await api.patch(`/api/v1/cover-letters/${id}`, data);
  if (!res.ok) throw new Error(`Failed to update cover letter: HTTP ${res.status}`);
  return res.json();
}

export async function deleteCoverLetter(id: string): Promise<void> {
  const res = await api.delete(`/api/v1/cover-letters/${id}`);
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete cover letter: HTTP ${res.status}`);
  }
}

/**
 * Export cover letter as PDF or DOCX and trigger a browser file download.
 */
export async function exportCoverLetter(id: string, format: 'pdf' | 'docx'): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/cover-letters/${id}/export?format=${format}`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) throw new Error('Export failed');

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cover-letter.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
