import { Link } from '@inertiajs/react';
import { BookOpen, CloudCogIcon, Droplet, Folder, LayoutGrid, Users, Zap } from 'lucide-react';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Inicio',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Gestión de Personal',
        href: '/users',
        icon: Users,
    },
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
        title: 'Calculo de Agua',
        href: '/agua-calculation',
        icon: Droplet,
    },
    {
        title: 'Projects',
        href: '#',
        icon: Folder,
    }
];

export function AppSidebar() {
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
