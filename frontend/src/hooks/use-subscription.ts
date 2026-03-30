import { useMutation } from '@tanstack/react-query';
import { saveCustomerId } from '@/lib/subscription-api';

interface SaveCustomerPayload {
  paddleUserId: string;
}

export function useSubscription() {
  return useMutation({
    mutationFn: ({ paddleUserId }: SaveCustomerPayload) =>
      saveCustomerId(paddleUserId),
  });
}
