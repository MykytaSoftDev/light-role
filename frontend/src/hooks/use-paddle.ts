"use client";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Totals {
  subtotal: string | null;
  tax: string | null;
  total: string | null;
  currencyCode: string | null;
}

function formatAmount(
  amount: number | string | undefined,
  currency: string | undefined
): string | null {
  if (amount == null || currency == null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(Number(amount) / 100);
  } catch {
    return String(amount);
  }
}

function extractTotals(
  data: Record<string, unknown> | undefined
): Totals | null {
  const t = data?.totals as Record<string, unknown> | undefined;
  const currency = data?.currency_code as string | undefined;
  if (!t) return null;
  return {
    subtotal: formatAmount(t.subtotal as number | string | undefined, currency),
    tax: formatAmount(t.tax as number | string | undefined, currency),
    total: formatAmount(t.total as number | string | undefined, currency),
    currencyCode: currency ?? null,
  };
}

export function usePaddle() {
  const router = useRouter();
  const paddleRef = useRef<Paddle | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState(false);
  const [totals, setTotals] = useState<Totals>({
    subtotal: null,
    tax: null,
    total: null,
    currencyCode: null,
  });

  // Initialize Paddle once on mount
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    const environment = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT as
      | "sandbox"
      | "production"
      | undefined;

    if (!token) return;

    initializePaddle({
      token,
      environment: environment === "sandbox" ? "sandbox" : undefined,
      eventCallback(event) {
        switch (event.name) {
          case "checkout.loaded": {
            setIsLoaded(true);
            const data = event.data as unknown as
              | Record<string, unknown>
              | undefined;
            const extracted = extractTotals(data);
            if (extracted) setTotals(extracted);
            break;
          }
          case "checkout.updated": {
            const data = event.data as unknown as
              | Record<string, unknown>
              | undefined;
            const extracted = extractTotals(data);
            if (extracted) setTotals(extracted);
            break;
          }
          case "checkout.completed": {
            const data = event.data as unknown as
              | Record<string, unknown>
              | undefined;
            const txnId = (data?.transaction_id as string) ?? "";
            router.push(`/dashboard/checkout/success?txn=${txnId}`);
            break;
          }
          case "checkout.error": {
            router.push("/dashboard/checkout/failure");
            break;
          }
        }
      },
    })
      .then((instance) => {
        paddleRef.current = instance;
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init once

  const openCheckout = useCallback(
    (
      priceId: string,
      userEmail: string,
      userId: string,
      containerTarget: string,
      theme: "light" | "dark"
    ) => {
      if (!paddleRef.current) return;
      paddleRef.current.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: { email: userEmail },
        customData: { user_id: userId },
        settings: {
          displayMode: "inline",
          frameTarget: containerTarget,
          frameInitialHeight: 450,
          frameStyle:
            "width: 100%; min-width: 312px; background-color: transparent; border: none;",
          theme,
          variant: "one-page",
          allowLogout: false,
          showAddDiscounts: true,
        },
      });
    },
    []
  );

  const updateCheckout = useCallback((options: { priceId: string }) => {
    if (!paddleRef.current) return;
    try {
      (
        paddleRef.current as Paddle & {
          Checkout: { updateCheckout: (opts: unknown) => void };
        }
      ).Checkout.updateCheckout({
        items: [{ priceId: options.priceId, quantity: 1 }],
      });
    } catch {
      // updateCheckout not available in this SDK version — caller should reopen
      console.warn("usePaddle: updateCheckout not supported, reopen checkout instead");
    }
  }, []);

  const closeCheckout = useCallback(() => {
    if (!paddleRef.current) return;
    try {
      paddleRef.current.Checkout.close();
    } catch {
      console.warn("usePaddle: closeCheckout not supported in this SDK version");
    }
  }, []);

  return {
    isLoaded,
    totals,
    openCheckout,
    updateCheckout,
    closeCheckout,
  };
}
