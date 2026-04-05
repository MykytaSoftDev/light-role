import { useQuery } from "@tanstack/react-query";
import { getNotifications } from "@/lib/notifications-api";
import type { NotificationListResponse } from "@/lib/notifications-api";
import { queryKeys } from "./keys";

export function useNotifications() {
  return useQuery<NotificationListResponse>({
    queryKey: queryKeys.user.notifications,
    queryFn: getNotifications,
    staleTime: 1000 * 60 * 1,
    refetchInterval: 30000,
  });
}
