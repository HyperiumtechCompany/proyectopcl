import { Link } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import {
    BookOpen,
    Boxes,
    Building2,
    CloudCogIcon,
    DatabaseBackup,
    Droplet,
    Inbox,
    LayoutGrid,
    Users,
    Zap,
    Waves,
    Lightbulb,
    PanelsLeftBottomIcon,
    ChartBar,
} from 'lucide-react';
import { index as dialuxV2Index } from '@/actions/App/Http/Controllers/Dialux/V2/ProjectController';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { toUrl } from '@/lib/utils';
import { dashboard } from '@/routes';
import type { NavItem, Auth } from '@/types';
import AppLogo from './app-logo';

const ADMIN_ROLES = ['root', 'gerencia', 'administracion'] as const;

export function AppSidebar() {
    const { auth } = usePage<{ auth: Auth }>().props;
    const { currentUrl, isCurrentUrl } = useCurrentUrl();
    const roles: string[] = auth.roles ?? [];
    const canManageUsers = roles.some((r) =>
        (ADMIN_ROLES as readonly string[]).includes(r),
    );

    const mainNavItems: NavItem[] = [
        {
            title: 'Inicio',
            href: dashboard(),
            icon: LayoutGrid,
        },
        ...(canManageUsers
            ? [
                  {
                      title: 'Gestión de Personal',
                      href: '/users' as const,
                      icon: Users,
                  },
                  {
                      title: 'Organizaciones',
                      href: '/organizations' as const,
                      icon: Building2,
                  },
                  {
                      title: 'Solicitudes',
                      href: '/solicitudes' as const,
                      icon: Inbox,
                  },
                  {
                      title: 'Copias de Seguridad',
                      href: '/backups' as const,
                      icon: DatabaseBackup,
                  },
              ]
            : []),
        {
            title: 'Caída de Tensión',
            href: '/caida-tension',
            icon: Zap,
        },
        {
            title: 'Aire Acondicionado',
            href: '/ac-calculation',
            icon: CloudCogIcon,
        },
        {
            title: 'SPAT y Pararrayos',
            href: '/spatt-pararrayos',
            icon: BookOpen,
        },
        {
            title: 'Cálculo de Agua',
            href: '/agua-calculation',
            icon: Droplet,
        },
        {
            title: 'Cálculo de Desagüe',
            href: '/desague-calculation',
            icon: Waves,
        },
    ];

    // items specific to the "metrados" section; additional modules can be added here
    const metradosNavItems: NavItem[] = [
        {
            title: 'Costos',
            href: '/costos',
            icon: PanelsLeftBottomIcon,
        },
        {
            title: 'DIALux V1',
            href: '/dialux',
            icon: Lightbulb,
        },
        {
            title: 'DIALux V2',
            href: dialuxV2Index(),
            icon: Boxes,
        },
    ];

    const gestorProyectos: NavItem[] = [
        {
            title: 'Gestor Proyectos',
            href: '/gestor-proyectos',
            icon: ChartBar,
        },
    ];

    const isNavItemActive = (item: NavItem): boolean => {
        const itemUrl = toUrl(item.href);

        return isCurrentUrl(item.href) || currentUrl.startsWith(`${itemUrl}/`);
    };

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />

                {/* metrado section */}
                <SidebarGroup className="px-2 py-0">
                    <SidebarGroupLabel asChild>
                        <Link href="/costos" prefetch>
                            Costos
                        </Link>
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        {metradosNavItems.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isNavItemActive(item)}
                                    tooltip={{ children: item.title }}
                                >
                                    <Link href={item.href} prefetch>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>

                {/* Gestion de proyectos */}
                <SidebarGroup className="px-2 py-0">
                    <SidebarGroupLabel asChild>
                        <Link href="/gestor-proyectos" prefetch>
                            Gestor Proyectos
                        </Link>
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        {gestorProyectos.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isNavItemActive(item)}
                                    tooltip={{ children: item.title }}
                                >
                                    <Link href={item.href} prefetch>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
