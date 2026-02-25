import { Link } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import {
    BookOpen,
    CloudCogIcon,
    Droplet,
    Folder,
    LayoutGrid,
    Users,
    Zap,
    Waves,
} from 'lucide-react';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import type { NavItem, Auth } from '@/types';
import AppLogo from './app-logo';

const ADMIN_ROLES = ['root', 'gerencia', 'administracion'] as const;

export function AppSidebar() {
    const { auth } = usePage<{ auth: Auth }>().props;
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
        {
            title: 'Proyectos',
            href: '#',
            icon: Folder,
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
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
