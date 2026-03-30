"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Mail,
  PenLine,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  auth_provider: string;
  is_verified: boolean;
}

// ---------------------------------------------------------------------------
// Navigation config
// ---------------------------------------------------------------------------

const NAV_MAIN = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Subscription", href: "/dashboard/subscription", icon: CreditCard, exact: true },
  { label: "Job Tracking", href: "/dashboard/jobs", icon: Briefcase, exact: false },
  { label: "Tailor Resume", href: "/dashboard/resumes/tailor", icon: FileText, exact: false },
  {
    label: "Generate Cover Letter",
    href: "/dashboard/cover-letters/generate",
    icon: PenLine,
    exact: false,
  },
];

const NAV_DOCUMENTS = [
  { label: "Resumes", href: "/dashboard/resumes", icon: FileText, exact: true },
  { label: "Cover Letters", href: "/dashboard/cover-letters", icon: Mail, exact: true },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function getUserInitial(user: User): string {
  if (user.first_name) return user.first_name[0].toUpperCase();
  return user.email[0].toUpperCase();
}

function getUserDisplayName(user: User): string {
  if (user.first_name || user.last_name) {
    return [user.first_name, user.last_name].filter(Boolean).join(" ");
  }
  return user.email;
}

// ---------------------------------------------------------------------------
// NavItem — single nav link with optional tooltip when collapsed
// ---------------------------------------------------------------------------

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}

function NavItem({ href, icon: Icon, label, active, collapsed, onClick }: NavItemProps) {
  const item = (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
        collapsed && "justify-center px-2"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return item;
}

// ---------------------------------------------------------------------------
// SidebarContent — the actual sidebar tree rendered in both desktop + drawer
// ---------------------------------------------------------------------------

interface SidebarContentProps {
  collapsed: boolean;
  user: User | null;
  plan: string | null;
  pathname: string;
  onCollapse: () => void;
  onNavClick?: () => void;
}

function SidebarContent({
  collapsed,
  user,
  plan,
  pathname,
  onCollapse,
  onNavClick,
}: SidebarContentProps) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await api.post("/api/v1/auth/logout");
    } catch {
      // ignore errors — redirect regardless
    }
    router.push("/auth/login");
  }

  const userInitial = user ? getUserInitial(user) : "?";
  const userDisplayName = user ? getUserDisplayName(user) : "Loading…";
  const userEmail = user?.email ?? "";

  return (
    <div className="flex h-full flex-col">
      {/* Logo area */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-sidebar-border px-3",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-sidebar-foreground">Light Role</span>
            <Link
              href={plan === "pro" ? "/dashboard/subscription" : "/dashboard/checkout"}
              className="transition-opacity hover:opacity-80"
              aria-label={plan === "pro" ? "Manage subscription" : "Upgrade to Pro"}
            >
              {plan === "pro" ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Pro
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Free
                </span>
              )}
            </Link>
          </div>
        )}
        {collapsed ? (
          <TooltipProvider delayDuration={300}>
            <div className="flex flex-col items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={plan === "pro" ? "/dashboard/subscription" : "/dashboard/checkout"}
                    aria-label={plan === "pro" ? "Pro plan — manage subscription" : "Free plan — upgrade to Pro"}
                    className="flex items-center justify-center transition-opacity hover:opacity-80"
                  >
                    {plan === "pro" ? (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        Pro
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Free
                      </span>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {plan === "pro" ? "Pro plan — manage subscription" : "Free plan — upgrade to Pro"}
                </TooltipContent>
              </Tooltip>
              <button
                onClick={onCollapse}
                className="hidden xl:flex items-center justify-center rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                aria-label="Expand sidebar"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </TooltipProvider>
        ) : (
          <button
            onClick={onCollapse}
            className="hidden xl:flex items-center justify-center rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <TooltipProvider delayDuration={300}>
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {/* Main nav */}
          <ul className="space-y-0.5" role="list">
            {NAV_MAIN.map((item) => (
              <li key={item.href}>
                <NavItem
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={isActive(pathname, item.href, item.exact)}
                  collapsed={collapsed}
                  onClick={onNavClick}
                />
              </li>
            ))}
          </ul>

          {/* Documents section */}
          <div className="mt-6">
            {!collapsed && (
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                Documents
              </p>
            )}
            {collapsed && (
              <Separator className="mx-auto my-3 w-8 bg-sidebar-border" />
            )}
            <ul className="space-y-0.5" role="list">
              {NAV_DOCUMENTS.map((item) => (
                <li key={item.href}>
                  <NavItem
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    active={isActive(pathname, item.href, item.exact)}
                    collapsed={collapsed}
                    onClick={onNavClick}
                  />
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </TooltipProvider>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-2 py-3">
        {/* Support / Feedback */}
        <TooltipProvider delayDuration={300}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="mailto:support@lightrole.com"
                  className="flex items-center justify-center rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                  aria-label="Support & Feedback"
                >
                  <HelpCircle className="size-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Support & Feedback
              </TooltipContent>
            </Tooltip>
          ) : (
            <a
              href="mailto:support@lightrole.com"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <HelpCircle className="size-4 shrink-0" />
              <span>Support & Feedback</span>
            </a>
          )}
        </TooltipProvider>

        {/* User profile with dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
                collapsed && "justify-center px-2"
              )}
              aria-label="User menu"
            >
              <Avatar className="size-8 shrink-0">
                <AvatarImage src={undefined} alt={userDisplayName} />
                <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium leading-tight">{userDisplayName}</p>
                  {userEmail && (
                    <p className="truncate text-xs text-sidebar-foreground/60">{userEmail}</p>
                  )}
                </div>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="min-w-56"
          >
            {/* User info header */}
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-popover-foreground">{userDisplayName}</p>
              {userEmail && (
                <p className="text-xs text-muted-foreground">{userEmail}</p>
              )}
            </div>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/account">Account</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/billing">Billing</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/notifications">Notifications</Link>
            </DropdownMenuItem>

            {plan === "pro" ? (
              <DropdownMenuItem asChild>
                <Link href="/dashboard/subscription">
                  <CreditCard className="size-4" />
                  Manage Subscription
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild className="gap-2 font-medium text-primary focus:text-primary">
                <Link href="/dashboard/checkout">
                  <Star className="size-4" />
                  Upgrade to Pro
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={handleLogout}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppSidebar — main exported component
// ---------------------------------------------------------------------------

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Read persisted state after mount
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("sidebarCollapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  // Fetch current user
  useEffect(() => {
    api
      .get("/api/v1/users/me")
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data: User | null) => {
        if (data) setUser(data);
      })
      .catch(() => {
        // non-critical — sidebar still renders without user data
      });
  }, []);

  // Fetch current plan
  useEffect(() => {
    api
      .get("/api/v1/subscriptions/current")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.plan_slug) setPlan(data.plan_slug);
      })
      .catch(() => {});
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  }, []);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => !prev);
  }, []);

  const sidebarWidth = collapsed ? "w-16" : "w-64";

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden xl:flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
          mounted ? sidebarWidth : "w-64"
        )}
        aria-label="Main navigation"
      >
        <SidebarContent
          collapsed={mounted ? collapsed : false}
          user={user}
          plan={plan}
          pathname={pathname}
          onCollapse={toggleCollapse}
        />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 xl:hidden"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar xl:hidden",
          "transition-transform duration-200",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Main navigation"
        aria-hidden={!drawerOpen}
      >
        {/* Close button for drawer */}
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute right-3 top-3 flex items-center justify-center rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors xl:hidden"
          aria-label="Close navigation"
        >
          <X className="size-4" />
        </button>
        <SidebarContent
          collapsed={false}
          user={user}
          plan={plan}
          pathname={pathname}
          onCollapse={() => {}}
          onNavClick={() => setDrawerOpen(false)}
        />
      </aside>

      {/* Expose drawer toggle for the layout header */}
      <MobileMenuButtonSync onToggle={toggleDrawer} />
    </>
  );
}

// ---------------------------------------------------------------------------
// MobileMenuButton — rendered inside the layout header on mobile
// Syncs with the AppSidebar drawer state via a shared module-level callback
// ---------------------------------------------------------------------------

type ToggleFn = () => void;
let _mobileToggle: ToggleFn | null = null;

/** Internal sync component — mounts inside AppSidebar to register the toggle fn */
function MobileMenuButtonSync({ onToggle }: { onToggle: ToggleFn }) {
  useEffect(() => {
    _mobileToggle = onToggle;
    return () => {
      _mobileToggle = null;
    };
  }, [onToggle]);
  return null;
}

/** Call this from the layout header hamburger button */
export function triggerMobileMenu() {
  _mobileToggle?.();
}

// ---------------------------------------------------------------------------
// HamburgerButton — place in the dashboard layout header
// ---------------------------------------------------------------------------

export function HamburgerButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => triggerMobileMenu()}
      className={cn(
        "flex xl:hidden items-center justify-center rounded-md p-2 text-foreground/70 hover:bg-accent hover:text-accent-foreground transition-colors",
        className
      )}
      aria-label="Open navigation menu"
    >
      <svg
        className="size-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
