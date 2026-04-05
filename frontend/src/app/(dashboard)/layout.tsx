import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar variant="sidebar" />
      <SidebarInset>
        <Header />
        {/* <div className="flex flex-1 flex-col"> */}
        <main className="@container/main flex min-w-0 flex-1 flex-col gap-2 px-4 md:px-6">
          {children}
          {/* <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">{children}</div> */}
        </main>
        {/* </div> */}
        {/* <OfflineDetector /> */}
      </SidebarInset>
    </SidebarProvider>
    // <div className="flex min-h-screen bg-background">
    //   <AppSidebar />
    //   <div className="flex flex-1 flex-col min-w-0">
    //     <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 xl:px-6">
    //       {/* Mobile hamburger — triggers the AppSidebar drawer */}
    //       <HamburgerButton />

    //       {/* Breadcrumb */}
    //       <DynamicBreadcrumb />

    //       {/* Spacer */}
    //       <div className="flex-1" />

    //       {/* Right actions */}
    //       <NotificationBell />
    //       <ThemeSwitcher />
    //     </header>
    //     <main className="flex-1 overflow-auto p-4 xl:p-6">{children}</main>
    //   </div>
    //
    // </div>
  );
}
