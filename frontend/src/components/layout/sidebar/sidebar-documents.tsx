"use client";

import { FileText, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
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
    key: "resumes",
    url: DASHBOARD_PAGES.RESUMES,
    icon: FileText,
  },
  {
    key: "coverLetters",
    url: DASHBOARD_PAGES.COVER_LETTERS,
    icon: Mail,
  },
] as const;

export function SidebarDocuments() {
  const { push } = useRouter();
  const tDocs = useTranslations("Sidebar.documents");
  const tMain = useTranslations("Sidebar.main");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{tDocs("title")}</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const title = tMain(item.key);
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
