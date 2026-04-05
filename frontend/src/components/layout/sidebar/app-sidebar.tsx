import { ComponentProps } from "react";

import { SidebarMain } from "@/components/layout/sidebar/sidebar-main";
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
import Image from "next/image";
import { SidebarDocuments } from "./sidebar-documents";
import { NavSecondary } from "./sidebar-secondary";

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className={`data-[slot=sidebar-menu-button]:!p-1.5`}>
              <a href={DASHBOARD_PAGES.HOME}>
                <Image
                  src="/assets/logo/lightrole-text.svg"
                  width={150}
                  height={200}
                  priority={true}
                  alt="LightRole Logo"
                />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMain />
        <SidebarDocuments />
      </SidebarContent>
      <SidebarFooter>
        <NavSecondary />
        <SidebarUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
