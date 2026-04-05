import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DynamicBreadcrumb } from "./dynamic-breadcrumb";
import { NotificationBell } from "./notification-bell";
import { ThemeSwitcher } from "./theme-switcher";

export function Header() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      {/* Sidebar trigger */}
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        {/* <h1 className="text-base font-medium"> */}
        {/* Breadcrumb */}
        <DynamicBreadcrumb />
        {/* </h1> */}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

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
