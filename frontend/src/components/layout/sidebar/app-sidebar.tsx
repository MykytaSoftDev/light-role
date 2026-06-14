"use client";

import { ComponentProps } from "react";

import { SidebarMain } from "@/components/layout/sidebar/sidebar-main";
import { SidebarPlanBadge } from "@/components/layout/sidebar/sidebar-plan-badge";
import { SidebarUser } from "@/components/layout/sidebar/sidebar-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { BrandMark } from "@/components/landing/brand/brand-mark";
import { Wordmark } from "@/components/landing/brand/wordmark";
import { DASHBOARD_PAGES } from "@/constants/nav.constants";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { SidebarAdmin } from "./sidebar-admin";
import { SidebarDocuments } from "./sidebar-documents";
import { SidebarSecondary } from "./sidebar-secondary";

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const tSidebarRoot = useTranslations("Sidebar");
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between gap-2">
              <SidebarMenuButton asChild className="w-auto flex-1">
                <Link
                  href={DASHBOARD_PAGES.HOME}
                  aria-label={tSidebarRoot("dashboardHomeAria")}
                  className="flex items-center gap-2"
                >
                  <BrandMark size={26} className="shrink-0" />
                  <Wordmark
                    size={18}
                    className="group-data-[collapsible=icon]:hidden"
                  />
                </Link>
              </SidebarMenuButton>
              <SidebarPlanBadge />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMain />
        <SidebarDocuments />
        <SidebarAdmin />
      </SidebarContent>
      <SidebarFooter>
        <SidebarSecondary />
        <SidebarUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
