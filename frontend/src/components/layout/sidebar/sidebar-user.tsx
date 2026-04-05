"use client";

import { BadgeCheck, ChevronsUpDown, CreditCard, Receipt, Sparkles } from "lucide-react";
import Link from "next/link";

import LogoutButton from "@/components/layout/sidebar/logout-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

import { DASHBOARD_PAGES } from "@/constants/nav.constants";

import { usePlan } from "@/hooks/use-plan";
import { useProfile } from "@/hooks/use-profile";

export function SidebarUser() {
  const { data, isLoading } = useProfile();
  const currentPlan = usePlan();

  const { isMobile } = useSidebar();
  const userName = data?.first_name ? `${data.first_name} ${data.last_name}` : "User";
  const email = data?.email ? data.email : "";
  const plan = currentPlan.plan || "free";
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isLoading ? (
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Skeleton className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <Skeleton className="mb-1 h-2 w-1/3 bg-gray-300 dark:bg-gray-600" />
                  <Skeleton className="h-2 w-3/4 bg-gray-300 dark:bg-gray-600" />
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  {/*TODO Add avatar ability*/}
                  {/*<AvatarImage src={user.avatar} alt={user.name} />*/}
                  <AvatarFallback className="rounded-lg bg-indigo-300">
                    {userName[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{userName}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {/*<AvatarImage src={user.avatar} alt={user.name} />*/}
                  <AvatarFallback className="rounded-lg bg-indigo-300">
                    {userName[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{userName}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {plan === "free" ? (
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Sparkles />
                  <Link href={DASHBOARD_PAGES.SUBSCRIPTIONS}>Upgrade your Plan</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </DropdownMenuGroup>
            ) : (
              ""
            )}
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <BadgeCheck />
                <Link href={DASHBOARD_PAGES.PROFILE}>Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard />
                <Link href={DASHBOARD_PAGES.PAYMENTS}>Payments</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Receipt />
                <Link href={`${DASHBOARD_PAGES.SUBSCRIPTIONS}/${currentPlan.subscriptionId}`}>
                  My Subscription
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <LogoutButton />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
