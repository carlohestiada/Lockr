import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const page = usePage();
    const currentUrl = new URL(page.url, window.location.origin);

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Lockr</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isNavigationItemActive(item.url, currentUrl)}>
                            <Link href={item.url} prefetch>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}

function isNavigationItemActive(itemUrl: string, currentUrl: URL): boolean {
    const targetUrl = new URL(itemUrl, currentUrl.origin);
    if (targetUrl.pathname === '/vault' && currentUrl.pathname === '/vault') {
        if (targetUrl.searchParams.has('folder')) return currentUrl.searchParams.has('folder');
        if (targetUrl.searchParams.get('favorites') === '1') return currentUrl.searchParams.get('favorites') === '1';
        return !currentUrl.searchParams.has('folder') && currentUrl.searchParams.get('favorites') !== '1';
    }

    return targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search;
}
