import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';

const sidebarNavItems = [
    {
        title: 'Profile',
        href: '/settings/profile',
    },
    {
        title: 'Password',
        href: '/settings/password',
    },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const currentPath = window.location.pathname;

    return (
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <header className="mb-6">
                <h1 className="text-lockr-navy text-2xl font-bold tracking-tight">Account settings</h1>
                <p className="mt-1 text-sm text-slate-500">Manage your profile and account security.</p>
            </header>

            <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
                <nav aria-label="Account settings" className="flex gap-2 overflow-x-auto lg:flex-col">
                    {sidebarNavItems.map(({ title, href }) => (
                        <Link
                            key={href}
                            href={href}
                            prefetch
                            aria-current={currentPath === href ? 'page' : undefined}
                            className={cn(
                                'flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium transition-colors',
                                currentPath === href
                                    ? 'bg-lockr-input text-lockr-navy'
                                    : 'hover:bg-lockr-input/70 hover:text-lockr-navy text-slate-600',
                            )}
                        >
                            {title}
                        </Link>
                    ))}
                </nav>

                <section className="min-w-0 space-y-8">{children}</section>
            </div>
        </div>
    );
}
