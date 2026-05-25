import { api } from './api';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  params?: Record<string, string | number> | null;
  is_read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  unread_count: number;
}

export async function getNotifications(): Promise<NotificationListResponse> {
  const res = await api.get('/api/v1/notifications');
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
}

export async function markAsRead(id: string): Promise<Notification> {
  const res = await api.patch(`/api/v1/notifications/${id}/read`);
  if (!res.ok) throw new Error('Failed to mark notification as read');
  return res.json();
}

export async function markAllAsRead(): Promise<{ message: string; count: number }> {
  const res = await api.post('/api/v1/notifications/read-all');
  if (!res.ok) throw new Error('Failed to mark all notifications as read');
  return res.json();
}
