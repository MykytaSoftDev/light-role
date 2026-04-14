"use client";

import { useState } from "react";
import { LifeBuoy, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { SupportDialog } from "@/components/support/support-dialog";

export function SidebarSecondary() {
  const t = useTranslations();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={t("sidebar.support")}
                onClick={() => setSupportOpen(true)}
              >
                <LifeBuoy />
                <span>{t("sidebar.support")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={t("sidebar.feedback")}
                onClick={() => setFeedbackOpen(true)}
              >
                <MessageSquare />
                <span>{t("sidebar.feedback")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
    </>
  );
}
