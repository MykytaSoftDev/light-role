"use client";

import { CheckoutContents } from "@/components/checkout/checkout-contents";
import { useProfile } from "@/hooks/use-profile";
import "@/styles/checkout.css";

export function Checkout() {
  const { data, isLoading } = useProfile();

  return (
    // <div className={"relative min-h-screen w-full overflow-hidden"}>
    //   <CheckoutGradients />
    //   <div
    //     className={
    //       "relative mx-auto flex max-w-6xl flex-col justify-between gap-6 px-[16px] py-[24px] md:px-[32px]"
    //     }
    //   >
    <CheckoutContents userEmail={data?.email} />
    //   </div>
    // </div>
  );
}
