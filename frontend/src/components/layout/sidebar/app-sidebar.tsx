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
import Link from "next/link";
import { SidebarDocuments } from "./sidebar-documents";
import { SidebarSecondary } from "./sidebar-secondary";

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href={DASHBOARD_PAGES.HOME} className="">
                <Image
                  src="/assets/logo/lightrole-text.svg"
                  width={150}
                  height={200}
                  priority={true}
                  alt="LightRole Logo"
                />
              </Link>
            </SidebarMenuButton>
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
