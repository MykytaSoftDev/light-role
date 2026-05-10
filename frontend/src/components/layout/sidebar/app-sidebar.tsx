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
import { DASHBOARD_PAGES } from "@/constants/nav.constants";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { SidebarDocuments } from "./sidebar-documents";
import { SidebarSecondary } from "./sidebar-secondary";

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const tBranding = useTranslations("Auth.branding");
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
                >
                  <Image
                    src="/assets/logo/lightrole-text.svg"
                    width={150}
                    height={200}
                    priority={true}
                    alt={tBranding("logoAlt")}
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
      </SidebarContent>
      <SidebarFooter>
        <SidebarSecondary />
        <SidebarUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
