"use client";

import { ChevronDown, CreditCard, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

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

  function handleCancelSubscription() {
    setModalOpen(false);
    setLoading(true);
    cancelSubscription(subscriptionId)
      .then(() => {
        toast("Subscription scheduled to cancel at the end of the billing period.");
      })
      .catch(() => {
        toast("Something went wrong, please try again later");
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
            Manage Subscription
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href="/dashboard/pricing" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Change Plan
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setModalOpen(true)}
            className="text-destructive focus:text-destructive flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Cancel Subscription
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirmation
        description={
          "This subscription will be scheduled to cancel at the end of the billing period."
        }
        title={"Cancel subscription?"}
        onClose={() => setModalOpen(false)}
        isOpen={isModalOpen}
        onConfirm={handleCancelSubscription}
        confirmLabel="Cancel subscription"
      />
    </>
  );
}
