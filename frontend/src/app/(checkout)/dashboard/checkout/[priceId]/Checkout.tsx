"use client";

import { CheckoutContents } from "@/components/checkout/checkout-contents";
import { useProfile } from "@/hooks/use-profile";

export function Checkout() {
  const { data, isLoading } = useProfile();

  return <CheckoutContents userEmail={data?.email} />;
}
