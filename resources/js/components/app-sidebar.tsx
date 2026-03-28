import { Link } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import { BookOpen, CloudCogIcon, Droplet, Folder, LayoutGrid, Users, Zap, Waves, PanelsLeftBottomIcon } from 'lucide-react';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { dashboard } from '@/routes';
import type { NavItem, Auth } from '@/types';
import AppLogo from './app-logo';

const ADMIN_ROLES = ['root', 'gerencia', 'administracion'] as const;

export function AppSidebar() {
    const { auth } = usePage<{ auth: Auth }>().props;
    const { isCurrentUrl } = useCurrentUrl();
    const roles: string[] = auth.roles ?? [];
    const canManageUsers = roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r));

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
    ];

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
                        <Link href="/costos" prefetch>Costos</Link>
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        {metradosNavItems.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isCurrentUrl(item.href)}
                                    tooltip={{ children: item.title }}>
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
