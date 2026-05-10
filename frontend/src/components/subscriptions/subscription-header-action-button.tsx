"use client";

import { ChevronDown, CreditCard, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Confirmation } from "@/components/shared/confirmation";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cancelSubscription } from "@/app/(dashboard)/dashboard/subscriptions/actions";

interface Props {
  subscriptionId: string;
}

export function SubscriptionHeaderActionButton({ subscriptionId }: Props) {
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const tHeader = useTranslations("Subscriptions.header");
  const tCommon = useTranslations("Common");

  function handleCancelSubscription() {
    setModalOpen(false);
    setLoading(true);
    cancelSubscription(subscriptionId)
      .then(() => {
        toast(tHeader("cancelScheduledToast"));
      })
      .catch(() => {
        toast(tCommon("toast.genericError"));
      })
      .finally(() => setLoading(false));
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={loading}
            size={"sm"}
            variant={"outline"}
            className={"flex items-center gap-2"}
          >
            {tHeader("manage")}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href="/dashboard/pricing" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              {tHeader("changePlan")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setModalOpen(true)}
            className="text-destructive focus:text-destructive flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            {tHeader("cancel")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirmation
        description={tHeader("cancelConfirmBody")}
        title={tHeader("cancelConfirmTitle")}
        onClose={() => setModalOpen(false)}
        isOpen={isModalOpen}
        onConfirm={handleCancelSubscription}
        confirmLabel={tHeader("cancel")}
      />
    </>
  );
}
