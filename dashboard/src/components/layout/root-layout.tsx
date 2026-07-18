import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import {
  Building2,
  CreditCard,
  Home,
  LayoutDashboard,
  LogOut,
  Network,
  Receipt,
  ScrollText,
  Users,
} from "lucide-react";

import { logout } from "@/core/api/refresh";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

// Routes that render on their own, without the sidebar + header app shell.
const bareRoutes = [
  "/login",
  "/activate",
  "/forgot-password",
  "/reset-password",
];

const navItems = [
  { title: "Home", to: "/", icon: Home, exact: true },
  { title: "Properties", to: "/properties", icon: Building2, exact: false },
  {
    title: "Organizations",
    to: "/organizations",
    icon: Network,
    exact: false,
  },
  { title: "People", to: "/people", icon: Users, exact: false },
  { title: "Leases", to: "/leases", icon: ScrollText, exact: false },
  { title: "Bills", to: "/bills", icon: Receipt, exact: false },
  { title: "Payments", to: "/payments", icon: CreditCard, exact: false },
] as const;

export function RootLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const activeItem = navItems.find((item) =>
    item.exact ? pathname === item.to : pathname.startsWith(item.to),
  );

  async function handleLogout() {
    await logout();
    await navigate({ to: "/login" });
  }

  // The unauthenticated pages (login, activate) own their full-screen layout, so
  // render just the routed page without the sidebar shell.
  if (bareRoutes.includes(pathname)) {
    return (
      <>
        <Outlet />
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <LayoutDashboard className="size-4" />
                  </div>
                  <span className="font-semibold">Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.to
                    : pathname.startsWith(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link to={item.to}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip="Sign out">
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-sm font-medium">
            {activeItem?.title ?? "Dashboard"}
          </h1>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </SidebarInset>

      {import.meta.env.DEV && <TanStackRouterDevtools position="top-left" />}
    </SidebarProvider>
  );
}
