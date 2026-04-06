"use client";

import { Briefcase, FileText, LayoutDashboard, PenLine } from "lucide-react";
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
    title: "Dashboard",
    url: DASHBOARD_PAGES.HOME,
    icon: LayoutDashboard,
  },
  {
    title: "Job Tracking",
    url: DASHBOARD_PAGES.JOBS,
    icon: Briefcase,
  },
  {
    title: "Tailor Resume",
    url: DASHBOARD_PAGES.TAILOR_RESUME,
    icon: FileText,
  },
  {
    title: "Generate Cover Letter",
    url: DASHBOARD_PAGES.GENERATE_COVER_LETTERS,
    icon: PenLine,
  },
];

export function SidebarMain() {
  const { push } = useRouter();

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                onClick={() => push(item.url)}
              >
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
