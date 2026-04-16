const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

let _isRefreshing = false;

async function fetchWithRefresh(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 401 || _isRefreshing) return res;

  _isRefreshing = true;
  try {
    const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!refreshRes.ok) return res;
  } finally {
    _isRefreshing = false;
  }

  return fetch(input, init);
}

export const api = {
  post: (path: string, body?: unknown) =>
    fetchWithRefresh(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    }),
  get: (path: string) =>
    fetchWithRefresh(`${BASE_URL}${path}`, {
      credentials: 'include',
    }),
  patch: (path: string, body?: unknown) =>
    fetchWithRefresh(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: (path: string) =>
    fetchWithRefresh(`${BASE_URL}${path}`, {
      method: 'DELETE',
      credentials: 'include',
    }),
};
