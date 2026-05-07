import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DynamicBreadcrumb } from "./dynamic-breadcrumb";
import { NotificationBell } from "./notification-bell";
import { ThemeSwitcher } from "./theme-switcher";

export function AppHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2">
      {/*
        `min-w-0 flex-1` on the breadcrumb wrapper lets it shrink when the
        breadcrumb is wider than the available space — without it the wrapper
        keeps its content's natural width and pushes the entire header past
        the viewport on mobile (the per-item truncate cap inside
        DynamicBreadcrumb only fires once the wrapper is allowed to shrink).
        Replaces the previous trailing `flex-1` spacer.
      */}
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1 shrink-0" />
        {/* Breadcrumbs (and their leading separator) are mobile-noise: on
            narrow screens the truncated trail collides with the action
            buttons on the right. Hide below `md`; the sidebar trigger keeps
            navigation reachable. */}
        <Separator
          orientation="vertical"
          className="mr-2 hidden shrink-0 data-[orientation=vertical]:h-4 md:block"
        />
        <div className="hidden min-w-0 md:flex">
          <DynamicBreadcrumb />
        </div>
      </div>

      {/* Right actions */}
      <NotificationBell />
      <ThemeSwitcher />
    </header>
  );
}

// {
/* <header className="flex h-16 shrink-0 items-center gap-2">
  <div className="flex items-center gap-2 px-4">
    <SidebarTrigger className="-ml-1" />
    <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
    {/* <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href="#">Build Your Application</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem>
          <BreadcrumbPage>Data Fetching</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb> */
// }
// </div>
// </header>; */}
// {
/* <header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
  <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
    <SidebarTrigger className="-ml-1" />
    <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
    <h1 className="text-base font-medium">{title}</h1>
  </div>
  <div className="mr-6">
    <ModeToggle />
  </div>
</header>; */
// }
