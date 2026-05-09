"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { useEffect, useRef, useState } from "react";

interface PriceInfo {
  formatted: string;
  raw: number;
}

interface UsePricePreviewResult {
  monthly: PriceInfo;
  annual: PriceInfo;
  savingsPercent: number;
  isLoading: boolean;
  isError: boolean;
}

interface UsePricePreviewOptions {
  monthlyPriceId: string | null;
  annualPriceId: string | null;
  /** Fallback cents values from the DB, used when Paddle preview fails */
  fallbackMonthlyCents?: number;
  fallbackAnnualCents?: number;
}

function centsToFormatted(cents: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export function usePricePreview({
  monthlyPriceId,
  annualPriceId,
  fallbackMonthlyCents = 0,
  fallbackAnnualCents = 0,
}: UsePricePreviewOptions): UsePricePreviewResult {
  const paddleRef = useRef<Paddle | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [paddleData, setPaddleData] = useState<{
    monthly: PriceInfo;
    annual: PriceInfo;
  } | null>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    const environment = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT as
      | "sandbox"
      | "production"
      | undefined;

    if (!token || !monthlyPriceId || !annualPriceId) {
      setIsLoading(false);
      return;
    }

    async function fetchPreview(paddle: Paddle) {
      try {
        const result = await paddle.PricePreview({
          items: [
            { priceId: monthlyPriceId as string, quantity: 1 },
            { priceId: annualPriceId as string, quantity: 1 },
          ],
        });

        const lineItems = result.data.details.lineItems;
        const currencyCode = result.data.currencyCode;

        let nextMonthly: PriceInfo | null = null;
        let nextAnnual: PriceInfo | null = null;

        for (const item of lineItems) {
          const rawStr = item.totals.subtotal;
          const raw = parseFloat(rawStr); // totals are in major units
          const formatted =
            item.formattedTotals.subtotal || centsToFormatted(Math.round(raw), currencyCode);

          if (item.price.id === monthlyPriceId) {
            nextMonthly = { formatted, raw: Math.round(raw) };
          } else if (item.price.id === annualPriceId) {
            nextAnnual = { formatted, raw: Math.round(raw) };
          }
        }

        if (nextMonthly && nextAnnual) {
          setPaddleData({ monthly: nextMonthly, annual: nextAnnual });
        }
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }

    if (paddleRef.current) {
      fetchPreview(paddleRef.current);
      return;
    }

    initializePaddle({
      token,
      environment: environment === "sandbox" ? "sandbox" : undefined,
    })
      .then((instance) => {
        if (!instance) {
          setIsError(true);
          setIsLoading(false);
          return;
        }
        paddleRef.current = instance;
        fetchPreview(instance);
      })
      .catch(() => {
        setIsError(true);
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyPriceId, annualPriceId]);

  const monthly: PriceInfo = paddleData?.monthly ?? {
    formatted: centsToFormatted(fallbackMonthlyCents),
    raw: fallbackMonthlyCents,
  };
  const annual: PriceInfo = paddleData?.annual ?? {
    formatted: centsToFormatted(fallbackAnnualCents),
    raw: fallbackAnnualCents,
  };

  const savingsPercent =
    monthly.raw > 0 ? Math.round(((monthly.raw * 12 - annual.raw) / (monthly.raw * 12)) * 100) : 0;

  return { monthly, annual, savingsPercent, isLoading, isError };
}
