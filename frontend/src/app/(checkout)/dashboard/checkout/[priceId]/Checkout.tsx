"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { CheckoutContents } from "@/components/checkout/checkout-contents";
import { DASHBOARD_PAGES } from "@/constants/nav.constants";
import { useCurrentSubscription } from "@/hooks/api/useCurrentSubscription";
import { useProfile } from "@/hooks/use-profile";

export function Checkout() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const {
    data: subscription,
    isPending: subPending,
    isError: subError,
  } = useCurrentSubscription();

  // Pre-checkout guard (MONETIZE-11): block existing paid subscribers from
  // mounting the Paddle inline frame. The frame creates a NEW subscription;
  // plan changes for existing subs must go via /dashboard/upgrade →
  // POST /subscriptions/change-plan. Coarse "any paid → redirect" matches the
  // spec; we don't try to compare priceId against the current plan.
  //
  // Errors are treated as "proceed" — if the subscription endpoint fails (rare
  // here, since the (checkout) group is auth-gated), we let Paddle's own
  // customer auth gate be the fallback rather than locking the user out.
  const alreadyPaid =
    !subError &&
    !!subscription?.plan_slug &&
    subscription.plan_slug !== "free";

  useEffect(() => {
    if (subPending) return;
    if (alreadyPaid) {
      const target = subscription?.subscription_id
        ? `${DASHBOARD_PAGES.SUBSCRIPTIONS}/${subscription.subscription_id}`
        : DASHBOARD_PAGES.HOME;
      router.replace(target);
    }
  }, [subPending, alreadyPaid, subscription, router]);

  // While we resolve subscription state OR while the redirect is in flight,
  // don't mount the Paddle frame — initialising and immediately tearing it
  // down causes visible flicker and wastes a Paddle SDK init.
  if (subPending || alreadyPaid) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <CheckoutContents userEmail={profile?.email} userId={profile?.id} />;
}
