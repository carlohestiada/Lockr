import type { SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { FolderClosed, LayoutDashboard, Settings2, ShieldCheck, Star } from 'lucide-react';

export type SidebarCounts = {
    credentials?: number | null;
    folders?: number | null;
    favorites?: number | null;
};

type NavigationItem = {
    title: string;
    href: string;
    icon: typeof LayoutDashboard;
    countKey?: keyof SidebarCounts;
};

const navigation: NavigationItem[] = [
    { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { title: 'My Vault', href: '/vault', icon: ShieldCheck, countKey: 'credentials' },
    { title: 'Folders', href: '/vault?folder=all', icon: FolderClosed, countKey: 'folders' },
    { title: 'Favorites', href: '/vault?favorites=1', icon: Star, countKey: 'favorites' },
    { title: 'Settings', href: '/settings/security', icon: Settings2 },
];

function currentSection(url: string): string {
    const parsed = new URL(url, 'http://lockr.local');
    if (parsed.pathname === '/dashboard') return 'Dashboard';
    if (parsed.pathname === '/vault') {
        if (parsed.searchParams.get('favorites') === '1') return 'Favorites';
        if (parsed.searchParams.has('folder')) return 'Folders';
        return 'My Vault';
    }
    if (parsed.pathname.startsWith('/settings')) return 'Settings';
    return '';
}

export default function SidebarNav({ counts, onNavigate }: { counts?: SidebarCounts; onNavigate?: () => void }) {
    const { url } = usePage<SharedData>();
    const activeTitle = currentSection(url);

    return (
        <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3">
            {navigation.map(({ title, href, icon: Icon, countKey }) => {
                const active = title === activeTitle;
                const count = countKey ? counts?.[countKey] : null;

                return (
                    <Link
                        key={title}
                        href={href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-white ${
                            active ? 'bg-lockr-navy-active font-medium text-white' : 'hover:bg-lockr-navy-active/70 text-slate-300 hover:text-white'
                        }`}
                    >
                        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                        <span className="flex-1">{title}</span>
                        {typeof count === 'number' && <span className="font-mono text-xs text-blue-100">{count}</span>}
                    </Link>
                );
            })}
        </nav>
    );
}
