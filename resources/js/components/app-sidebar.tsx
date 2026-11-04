import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { ApiError, api } from '@/lib/api';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { FolderClosed, KeyRound, LayoutDashboard, LockKeyhole, Settings2, Star } from 'lucide-react';
import { useState } from 'react';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutDashboard,
    },
    {
        title: 'My Vault',
        url: '/vault',
        icon: KeyRound,
    },
    {
        title: 'Folders',
        url: '/vault?folder=all',
        icon: FolderClosed,
    },
    {
        title: 'Favorites',
        url: '/vault?favorites=1',
        icon: Star,
    },
    {
        title: 'Settings',
        url: '/settings/security',
        icon: Settings2,
    },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/vault" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
                <LockVaultAction />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}

function LockVaultAction() {
    const [error, setError] = useState('');

    async function lockVault() {
        setError('');
        window.dispatchEvent(new Event('vault:locking'));
        try {
            await api('/api/vault/lock', { method: 'POST' });
            window.dispatchEvent(new Event('vault:locked'));
        } catch (reason) {
            if (reason instanceof ApiError && reason.status === 423) {
                return;
            }
            const message = reason instanceof Error ? reason.message : 'Unable to lock the vault.';
            setError(message);
            window.dispatchEvent(new CustomEvent('vault:lock-failed', { detail: message }));
        }
    }

    return (
        <div className="px-2">
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => void lockVault()} tooltip="Lock vault">
                        <LockKeyhole />
                        <span>Lock vault</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
            {error && (
                <p role="alert" className="text-destructive px-2 py-1 text-xs">
                    {error}
                </p>
            )}
        </div>
    );
}
