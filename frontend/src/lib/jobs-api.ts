import { api } from './api';

export interface JobOption {
  id: string;
  title: string;
  company: string | null;
  status?: string;
}

export async function listJobs(): Promise<{ items: JobOption[]; total: number }> {
  const res = await api.get('/api/v1/jobs?limit=100');
  if (!res.ok) throw new Error(`Failed to fetch jobs: HTTP ${res.status}`);
  return res.json();
}
