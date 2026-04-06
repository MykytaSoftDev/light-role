import { AppHeader } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
          </div>
        </div>
        {/* <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">{children}</div>
          </div>
        </div> */}
        {/* <OfflineDetector /> */}
      </SidebarInset>
    </SidebarProvider>
  );
}
