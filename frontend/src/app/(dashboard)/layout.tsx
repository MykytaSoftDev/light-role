import { AppSidebar, HamburgerButton } from "@/components/layout/app-sidebar";
import { DynamicBreadcrumb } from "@/components/layout/dynamic-breadcrumb";
import { NotificationBell } from "@/components/layout/notification-bell";
import { OfflineDetector } from "@/components/shared/offline-detector";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 xl:px-6">
            {/* Mobile hamburger — triggers the AppSidebar drawer */}
            <HamburgerButton />

            {/* Breadcrumb */}
            <DynamicBreadcrumb />

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right actions */}
            <NotificationBell />
            <ThemeSwitcher />
          </header>
          <main className="flex-1 overflow-auto p-4 xl:p-6">{children}</main>
        </div>
        <OfflineDetector />
      </div>
    </QueryProvider>
  );
}
