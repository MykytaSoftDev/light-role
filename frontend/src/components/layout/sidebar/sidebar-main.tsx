"use client";

import { Briefcase, FileText, LayoutDashboard, PenLine, TrendingUp, UserCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

import { DASHBOARD_PAGES } from "@/constants/nav.constants";

const items = [
  {
    key: "dashboard",
    url: DASHBOARD_PAGES.HOME,
    icon: LayoutDashboard,
  },
  {
    key: "profile",
    url: DASHBOARD_PAGES.PROFILE,
    icon: UserCircle,
  },
  {
    key: "jobs",
    url: DASHBOARD_PAGES.JOBS,
    icon: Briefcase,
  },
  {
    key: "tailorResume",
    url: DASHBOARD_PAGES.TAILOR_RESUME,
    icon: FileText,
  },
  {
    key: "generateCoverLetter",
    url: DASHBOARD_PAGES.GENERATE_COVER_LETTERS,
    icon: PenLine,
  },
  {
    key: "analytics",
    url: DASHBOARD_PAGES.ANALYTICS,
    icon: TrendingUp,
  },
] as const;

export function SidebarMain() {
  const { push } = useRouter();
  const t = useTranslations("Sidebar.main");

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const title = t(item.key);
            return (
              <SidebarMenuItem key={item.key}>
                <SidebarMenuButton
                  tooltip={title}
                  onClick={() => push(item.url)}
                >
                  {item.icon && <item.icon />}
                  <span>{title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
