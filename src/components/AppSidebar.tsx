import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileSignature, ScrollText, FolderOpen, Shield } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const itens = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Gerador de Peças", url: "/pecas", icon: FileSignature },
  { title: "Relatório do Sindicante", url: "/relatorio", icon: ScrollText },
  { title: "Autos e Documentos", url: "/documentos", icon: FolderOpen },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-3 py-4">
          <Shield className="size-6 shrink-0 text-primary" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">SIGES — Sindicâncias</p>
              <p className="rotulo truncate">Exército Brasileiro</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {itens.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && (
          <div className="mt-auto px-3 pb-4 text-[11px] leading-relaxed text-muted-foreground">
            Portaria C Ex nr 2.394/2024 (EB10-IG-09.001) · Redação oficial EB10-IG-01.001
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
