"use client";

import { MessageSquareWarning, ShieldCheck, Users } from "lucide-react";
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
import { useUser } from "@/hooks/api/useUser";

// SPEC-admin-panel-phase1 §5.2 — admin-only sidebar section.
// Rendered between SidebarDocuments and the footer (Support / Feedback).
// Admin UI is English-only per SPEC §2 (no useTranslations).
const items = [
  {
    key: "users",
    title: "Users",
    url: DASHBOARD_PAGES.ADMIN_USERS,
    icon: Users,
  },
  {
    key: "feedback",
    title: "Feedback",
    url: DASHBOARD_PAGES.ADMIN_FEEDBACK,
    icon: MessageSquareWarning,
  },
] as const;

export function SidebarAdmin() {
  const { data } = useUser();
  const { push } = useRouter();

  // Hard gate: render nothing for non-admin (or unauthenticated) users.
  // The server-side admin layout is the source of truth — this is just UX.
  if (data?.is_admin !== true) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-1.5 text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Admin
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.key}>
              <SidebarMenuButton
                tooltip={item.title}
                onClick={() => push(item.url)}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
