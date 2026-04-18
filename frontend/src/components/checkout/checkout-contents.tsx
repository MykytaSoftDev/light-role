"use client";

import { PriceSection } from "@/components/checkout/price-section";
import { DASHBOARD_PAGES } from "@/constants/nav.constants";
import { useSubscription } from "@/hooks/use-subscription";
import { type Environments, initializePaddle, type Paddle } from "@paddle/paddle-js";
import type { CheckoutEventsData } from "@paddle/paddle-js/types/checkout/events";
import throttle from "lodash.throttle";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface PathParams {
  priceId: string;
  [key: string]: string | string[];
}

interface Props {
  userEmail?: string;
  userId?: string;
}

export function CheckoutContents({ userEmail, userId }: Props) {
  const { priceId } = useParams<PathParams>();
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [checkoutData, setCheckoutData] = useState<CheckoutEventsData | null>(null);
  const customerIdSaved = useRef<boolean>(false);
  const { mutate, isPending } = useSubscription();
  const theme =
    typeof window !== "undefined" ? (localStorage.getItem("theme") ?? "system") : "system";

  const handleCheckoutEvents = useCallback(
    (event: CheckoutEventsData) => {
      setCheckoutData(event);
      console.log("checkoutData", event);
      console.log("customerIdSaved", customerIdSaved.current);

      if (event.customer.id && !customerIdSaved.current) {
        const data = { paddleUserId: event.customer.id };
        mutate(data, {
          onSuccess: () => {
            customerIdSaved.current = true;
          },
          onError: (error) => {
            console.log("error", error);
            toast.error("We experienced some technical issues. Please try again later.");
          },
        });
      }
    },
    [mutate, userEmail]
  );

  const updateItems = useCallback(
    throttle((paddle: Paddle, priceId: string, quantity: number) => {
      paddle.Checkout.updateItems([{ priceId, quantity }]);
    }, 1000),
    []
  );

  useEffect(() => {
    if (
      !paddle?.Initialized &&
      process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN &&
      process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT
    ) {
      initializePaddle({
        token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
        environment: process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT as Environments,
        eventCallback: (event) => {
          if (event.data && event.name) {
            handleCheckoutEvents(event.data);
          }
        },
        checkout: {
          settings: {
            variant: "one-page",
            displayMode: "inline",
            theme: theme === "dark" ? "dark" : "light",
            allowLogout: !userEmail,
            frameTarget: "paddle-checkout-frame",
            frameInitialHeight: 450,
            frameStyle: "width: 100%; background-color: transparent; border: none",
            successUrl: DASHBOARD_PAGES.CHECKOUT_SUCCESS,
          },
        },
      }).then(async (paddle) => {
        if (paddle && priceId) {
          setPaddle(paddle);
          paddle.Checkout.open({
            ...(userEmail && { customer: { email: userEmail } }),
            items: [{ priceId: priceId, quantity: 1 }],
            ...(userId && { customData: { user_id: userId } }),
          });
        }
      });
    }
  }, [paddle?.Initialized, priceId, userEmail, handleCheckoutEvents]);

  useEffect(() => {
    if (paddle && priceId && paddle.Initialized) {
      console.log("paddle2", paddle);
      updateItems(paddle, priceId, 1);
    }
  }, [paddle, priceId, updateItems]);

  return (
    <div
      className={
        "md:bg-background/80 relative flex flex-col justify-between rounded-lg border shadow-lg shadow-primary/40 md:min-h-[400px] md:p-10 md:pt-12 md:pl-16 md:backdrop-blur-[24px]"
      }
    >
      <div className={"flex flex-col gap-8 md:flex-row md:gap-16"}>
        <div className={"w-full md:w-[400px]"}>
          <PriceSection checkoutData={checkoutData} quantity={1} />
        </div>
        <div className={"min-w-[375px] lg:min-w-[535px]"}>
          <div className={"mb-8 text-base leading-[20px] font-semibold"}>Payment details</div>
          <div className={"paddle-checkout-frame"} />
        </div>
      </div>
    </div>
  );
}
