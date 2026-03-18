import { AppSidebar, HamburgerButton } from "@/components/layout/app-sidebar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 xl:px-6">
          {/* Mobile hamburger — triggers the AppSidebar drawer */}
          <HamburgerButton />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right actions */}
          <NotificationBell count={0} />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto p-4 xl:p-6">{children}</main>
      </div>
    </div>
  );
}
