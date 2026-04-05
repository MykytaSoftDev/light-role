"use client";

import { FileText, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { DASHBOARD_PAGES } from "@/constants/nav.constants";

const items = [
  {
    title: "Resumes",
    url: DASHBOARD_PAGES.RESUMES,
    icon: FileText,
  },
  {
    title: "Cover Letters",
    url: DASHBOARD_PAGES.COVER_LETTERS,
    icon: Mail,
  },
];

export function SidebarDocuments() {
  const { push } = useRouter();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Documents</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                onClick={() => push(item.url)}
                className={"cursor-pointer"}
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
