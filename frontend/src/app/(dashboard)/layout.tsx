import { AppHeader } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        {/*
          Impersonation banner sits ABOVE the app header so it occupies the
          very top of the viewport during admin impersonation sessions. It
          renders `null` for normal sessions, so there is no layout cost
          outside the admin debugging flow (SPEC §5.7).
        */}
        <ImpersonationBanner />
        <AppHeader />
        {/*
          `min-w-0` on every nested flex-col container is required because
          flex items default to `min-width: auto`, which lets a wide
          descendant (e.g. the resume document's 794px un-scaled layout box)
          cascade up and stretch the whole inset past the viewport. Without
          this, on mobile the page horizontally overflows and the html
          background bleeds through as a white strip on the right.
        */}
        <div className="flex flex-1 flex-col min-w-0">
          <div className="@container/main flex flex-1 flex-col gap-2 min-w-0">
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0 min-w-0">{children}</div>
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
