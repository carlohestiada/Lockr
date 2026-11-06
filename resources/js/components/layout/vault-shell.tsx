import ShortcutHint from '@/components/layout/shortcut-hint';
import SidebarNav, { type SidebarCounts } from '@/components/layout/sidebar-nav';
import UserCard from '@/components/layout/user-card';
import useAutoLockChip from '@/hooks/use-auto-lock-chip';
import useVaultLock from '@/hooks/use-vault-lock';
import type { SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { KeyRound, LockKeyhole, Menu, Search, X } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

type HeaderSearch = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
};

type VaultShellProps = {
    title?: string;
    breadcrumbs?: ReactNode;
    headerSearch?: HeaderSearch;
    actions?: ReactNode;
    children: ReactNode;
    counts?: SidebarCounts;
    autoLockMinutes?: number | null;
    autoLockActive?: boolean;
    onLock?: () => Promise<boolean | void> | boolean | void;
    onNewCredential?: () => void;
};

function initials(name: string): string {
    return (
        name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('') || '?'
    );
}

export default function VaultShell({
    title,
    breadcrumbs,
    headerSearch,
    actions,
    children,
    counts,
    autoLockMinutes = null,
    autoLockActive = false,
    onLock,
    onNewCredential,
}: VaultShellProps) {
    const page = usePage<SharedData>();
    const { auth } = page.props;
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [uncontrolledSearch, setUncontrolledSearch] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);
    const mobileSearchRef = useRef<HTMLInputElement>(null);
    const drawerRef = useRef<HTMLElement>(null);
    const pathname = new URL(page.url, window.location.origin).pathname;
    const isVaultPage = pathname === '/vault';
    const searchValue = headerSearch?.value ?? uncontrolledSearch;
    const { lockVault: fallbackLock, locking, error: lockError } = useVaultLock();
    const runLock = useCallback(() => (onLock ? onLock() : fallbackLock()), [fallbackLock, onLock]);
    const lockFromShell = useCallback(async () => {
        const result = await runLock();
        const locked = result !== false;
        if (locked && !isVaultPage && !onLock) router.visit('/vault', { replace: true });
        return locked;
    }, [isVaultPage, onLock, runLock]);
    const { minutes, remainingSeconds, statusError } = useAutoLockChip({
        minutes: autoLockMinutes,
        active: autoLockActive,
        onExpire: lockFromShell,
    });

    useEffect(() => {
        const onShortcut = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                if (window.matchMedia('(max-width: 767px)').matches) {
                    setMobileSearchOpen(true);
                    window.setTimeout(() => mobileSearchRef.current?.focus(), 0);
                } else {
                    searchRef.current?.focus();
                }
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
                event.preventDefault();
                void lockFromShell();
            }
        };

        document.addEventListener('keydown', onShortcut);
        return () => document.removeEventListener('keydown', onShortcut);
    }, [lockFromShell]);

    useEffect(() => {
        if (!mobileNavOpen) return;

        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const getFocusable = () =>
            drawerRef.current?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
        getFocusable()?.[0]?.focus();

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setMobileNavOpen(false);
                return;
            }
            if (event.key !== 'Tab') return;

            const focusable = getFocusable();
            if (!focusable?.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            previouslyFocused?.focus();
        };
    }, [mobileNavOpen]);

    function updateSearch(value: string) {
        if (headerSearch) headerSearch.onChange(value);
        else setUncontrolledSearch(value);
    }

    function submitSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (isVaultPage) return;

        const query = searchValue.trim();
        router.visit(query ? `/vault?q=${encodeURIComponent(query)}` : '/vault');
    }

    function openNewCredential() {
        if (onNewCredential) onNewCredential();
        else router.visit('/vault?create=1');
    }

    return (
        <div className="bg-lockr-canvas text-lockr-navy min-h-svh font-sans">
            {title && <Head title={title} />}
            {mobileNavOpen && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    className="bg-lockr-navy-deep/60 fixed inset-0 z-40 lg:hidden"
                    onClick={() => setMobileNavOpen(false)}
                />
            )}
            <aside
                id="lockr-sidebar"
                ref={drawerRef}
                aria-label="Sidebar"
                className={`bg-lockr-navy fixed inset-y-0 left-0 z-50 flex w-64 flex-col text-white shadow-xl transition-transform motion-reduce:transition-none lg:translate-x-0 ${
                    mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
                    <Link href="/dashboard" aria-label="Lockr dashboard" className="flex min-w-0 items-center gap-3">
                        <span className="bg-lockr-navy-active flex size-9 shrink-0 items-center justify-center rounded-lg">
                            <LockKeyhole className="size-5 text-white" aria-hidden="true" />
                        </span>
                        <span className="text-base font-semibold">Lockr</span>
                        <span className="bg-lockr-navy-active rounded-full px-2 py-1 text-[10px] text-blue-100">Personal Vault</span>
                    </Link>
                    <button
                        type="button"
                        aria-label="Close navigation"
                        className="ml-auto flex size-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white lg:hidden"
                        onClick={() => setMobileNavOpen(false)}
                    >
                        <X className="size-4" aria-hidden="true" />
                    </button>
                </div>
                <div className="px-4 py-4">
                    <button
                        type="button"
                        disabled={locking}
                        onClick={() => void lockFromShell()}
                        className="bg-lockr-navy-active/70 hover:bg-lockr-navy-active flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
                    >
                        <span className="flex items-center gap-2">
                            <LockKeyhole className="size-4" aria-hidden="true" />
                            Lock Vault
                        </span>
                        <ShortcutHint shortcut="L" variant="dark" />
                    </button>
                </div>
                <SidebarNav counts={counts} onNavigate={() => setMobileNavOpen(false)} />
                <UserCard user={auth.user} />
            </aside>

            <div className="min-h-svh pt-16 lg:pl-64">
                <header className="fixed top-0 right-0 left-0 z-30 h-16 border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur lg:left-64">
                    <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3">
                        <button
                            type="button"
                            aria-label="Open navigation"
                            aria-expanded={mobileNavOpen}
                            aria-controls="lockr-sidebar"
                            onClick={() => setMobileNavOpen(true)}
                            className="hover:bg-lockr-subtle focus-visible:ring-lockr-accent flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-600 focus-visible:ring-2 lg:hidden"
                        >
                            <Menu className="size-5" aria-hidden="true" />
                        </button>
                        <form onSubmit={submitSearch} role="search" className="relative hidden w-full max-w-md md:block">
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                            <input
                                ref={searchRef}
                                aria-label="Search credentials"
                                value={searchValue}
                                onChange={(event) => updateSearch(event.target.value)}
                                placeholder={headerSearch?.placeholder ?? 'Search vault items...'}
                                className="bg-lockr-subtle focus:ring-lockr-interactive h-10 w-full rounded-lg border-0 pr-16 pl-9 text-sm outline-none focus:bg-white focus:ring-2"
                            />
                            <span className="absolute top-1/2 right-2 -translate-y-1/2">
                                <ShortcutHint shortcut="K" variant="light" />
                            </span>
                        </form>
                        <button
                            type="button"
                            aria-label="Open search"
                            onClick={() => {
                                setMobileSearchOpen((open) => !open);
                                window.setTimeout(() => mobileSearchRef.current?.focus(), 0);
                            }}
                            className="hover:bg-lockr-subtle focus-visible:ring-lockr-accent flex size-10 items-center justify-center rounded-lg text-slate-600 focus-visible:ring-2 md:hidden"
                        >
                            <Search className="size-5" aria-hidden="true" />
                        </button>
                        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
                            {minutes !== null && (
                                <span
                                    className="bg-lockr-input hidden items-center gap-1.5 rounded-full px-3 py-2 text-xs text-slate-600 sm:flex"
                                    aria-label={statusError || undefined}
                                    title={statusError || undefined}
                                >
                                    <span className="bg-lockr-success size-1.5 rounded-full" aria-hidden="true" />
                                    {activeAutoLockText(minutes, remainingSeconds, autoLockActive)}
                                </span>
                            )}
                            <button
                                type="button"
                                aria-label="New Credential"
                                onClick={openNewCredential}
                                className="bg-lockr-interactive hover:bg-lockr-navy-active focus-visible:ring-lockr-accent inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white shadow-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 sm:px-4"
                            >
                                <KeyRound className="size-4" aria-hidden="true" />
                                <span className="hidden sm:inline">New Credential</span>
                            </button>
                            {actions}
                            <button
                                type="button"
                                aria-label="Lock Vault"
                                disabled={locking}
                                onClick={() => void lockFromShell()}
                                className="hover:bg-lockr-subtle hover:text-lockr-navy focus-visible:ring-lockr-accent flex size-10 items-center justify-center rounded-lg text-slate-600 focus-visible:ring-2 disabled:opacity-60"
                            >
                                <LockKeyhole className="size-5" aria-hidden="true" />
                            </button>
                            <Link
                                href="/settings/profile"
                                aria-label={`Profile settings for ${auth.user.name}`}
                                className="bg-lockr-navy-active focus-visible:ring-lockr-accent hidden size-9 items-center justify-center rounded-full text-xs font-semibold text-white focus-visible:ring-2 focus-visible:ring-offset-2 sm:flex"
                            >
                                {initials(auth.user.name)}
                            </Link>
                        </div>
                    </div>
                    {mobileSearchOpen && (
                        <form onSubmit={submitSearch} role="search" className="border-t border-slate-200 bg-white py-2 md:hidden">
                            <div className="relative">
                                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                <input
                                    ref={mobileSearchRef}
                                    aria-label="Search credentials"
                                    value={searchValue}
                                    onChange={(event) => updateSearch(event.target.value)}
                                    placeholder={headerSearch?.placeholder ?? 'Search vault items...'}
                                    className="bg-lockr-subtle focus:ring-lockr-interactive h-11 w-full rounded-lg border-0 px-10 text-sm outline-none focus:ring-2"
                                />
                            </div>
                        </form>
                    )}
                </header>
                {(lockError || statusError) && (
                    <p
                        role="alert"
                        className="border-lockr-danger/30 fixed top-16 right-4 z-40 mt-2 max-w-md rounded-lg border bg-white px-4 py-3 text-sm text-red-700 shadow-lg"
                    >
                        {lockError || statusError}
                    </p>
                )}
                {breadcrumbs && <div className="mx-auto max-w-[1440px] px-4 pt-3 lg:px-8">{breadcrumbs}</div>}
                {children}
            </div>
        </div>
    );
}

function activeAutoLockText(minutes: number, remainingSeconds: number, active: boolean): string {
    if (minutes === 0) return 'Auto-lock off';
    if (!active) return `Auto-lock ${minutes}m`;
    return `Auto-locks in ${Math.floor(remainingSeconds / 60)}m ${String(remainingSeconds % 60).padStart(2, '0')}s`;
}
