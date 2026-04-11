import { SubscriptionDetail } from "@/components/subscriptions/subscription-details";
import { SubscriptionErrorBoundary } from "@/components/subscriptions/subscription-error-boundary";

export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ subscriptionId: string }>;
}) {
  const { subscriptionId } = await params;
  return (
    <div className="relative px-4 lg:gap-6 lg:px-8">
      <SubscriptionErrorBoundary>
        <SubscriptionDetail subscriptionId={subscriptionId} />
      </SubscriptionErrorBoundary>
    </div>
  );
}
