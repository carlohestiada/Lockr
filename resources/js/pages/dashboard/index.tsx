import PasswordGenerator from '@/components/password-generator';
import { ApiError, api } from '@/lib/api';
import { type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Check,
    ChevronDown,
    Clock3,
    Copy,
    Eye,
    EyeOff,
    FolderClosed,
    Heart,
    KeyRound,
    LayoutDashboard,
    LockKeyhole,
    LogOut,
    Menu,
    MoreHorizontal,
    Search,
    Settings2,
    ShieldCheck,
    Star,
    UserRound,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Credential = {
    id: number;
    title: string;
    username: string | null;
    website_url: string | null;
    folder_id: number | null;
    folder?: { id: number; name: string } | null;
    is_favorite: boolean;
    updated_at: string;
};

type PaginatedCredentials = {
    data: Credential[];
    total: number;
};

type Folder = {
    id: number;
    name: string;
    credentials_count: number;
};

type FeedFilter = 'all' | 'favorites';

const navigation = [
    { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { title: 'My Vault', href: '/vault', icon: KeyRound },
    { title: 'Folders', href: '/vault?folder=all', icon: FolderClosed },
    { title: 'Favorites', href: '/vault?favorites=1', icon: Star },
    { title: 'Settings', href: '/settings/security', icon: Settings2 },
] satisfies { title: string; href: string; icon: LucideIcon }[];

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

function formatUpdatedAt(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Recently updated'
        : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function lockCountdown(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export default function Dashboard() {
    const { auth } = usePage<SharedData>().props;
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [credentialTotal, setCredentialTotal] = useState(0);
    const [favoriteTotal, setFavoriteTotal] = useState(0);
    const [feedTotal, setFeedTotal] = useState(0);
    const [autoLockMinutes, setAutoLockMinutes] = useState<number | null>(null);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FeedFilter>('all');
    const [folderFilter, setFolderFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [feedLoading, setFeedLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [unlocked, setUnlocked] = useState(false);
    const [locking, setLocking] = useState(false);
    const [lockFailed, setLockFailed] = useState(false);
    const [favoriteSaving, setFavoriteSaving] = useState<number | null>(null);
    const [passwordLoading, setPasswordLoading] = useState<number | null>(null);
    const [revealedPasswords, setRevealedPasswords] = useState<Record<number, string>>({});
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [feedVersion, setFeedVersion] = useState(0);
    const searchRef = useRef<HTMLInputElement>(null);
    const unlockedRef = useRef(false);
    const lockRequestRef = useRef(false);
    const lastActivityRef = useRef(Date.now());
    const lastHeartbeatRef = useRef(0);

    const clearSensitiveState = useCallback(() => {
        setCredentials([]);
        setRevealedPasswords({});
        setPasswordLoading(null);
    }, []);

    const lockVault = useCallback(async () => {
        if (lockRequestRef.current) return;
        lockRequestRef.current = true;
        unlockedRef.current = false;
        setUnlocked(false);
        setLocking(true);
        setLockFailed(false);
        setError('');
        clearSensitiveState();

        try {
            await api('/api/vault/lock', { method: 'POST' });
            window.dispatchEvent(new Event('vault:locked'));
            router.visit('/vault', { replace: true });
        } catch (reason) {
            if (reason instanceof ApiError && reason.status === 423) {
                router.visit('/vault', { replace: true });
                return;
            }
            lockRequestRef.current = false;
            setLocking(false);
            setLockFailed(true);
            setError(reason instanceof Error ? reason.message : 'Unable to confirm that the vault is locked.');
        }
    }, [clearSensitiveState]);

    useEffect(() => {
        let cancelled = false;

        async function loadDashboard() {
            setLoading(true);
            setError('');
            try {
                const status = await api<{ locked: boolean; auto_lock_minutes: number }>('/api/vault/status');
                if (cancelled) return;
                setAutoLockMinutes(status.auto_lock_minutes);
                setRemainingSeconds(status.auto_lock_minutes * 60);

                if (status.locked) {
                    router.visit('/vault', { replace: true });
                    return;
                }

                unlockedRef.current = true;
                setUnlocked(true);
                const [allCredentials, favorites, folderResult] = await Promise.all([
                    api<PaginatedCredentials>('/api/credentials?per_page=1'),
                    api<PaginatedCredentials>('/api/credentials?favorite=1&per_page=1'),
                    api<Folder[]>('/api/folders'),
                ]);
                if (cancelled || !unlockedRef.current) return;
                setCredentialTotal(allCredentials.total);
                setFavoriteTotal(favorites.total);
                setFolders(folderResult);
            } catch (reason) {
                if (cancelled || (reason instanceof ApiError && reason.status === 423)) return;
                setError(reason instanceof Error ? reason.message : 'Unable to load your dashboard.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        const handleLocked = () => {
            unlockedRef.current = false;
            lockRequestRef.current = false;
            clearSensitiveState();
            setUnlocked(false);
            setLocking(false);
            router.visit('/vault', { replace: true });
        };
        const handleLocking = () => {
            unlockedRef.current = false;
            setUnlocked(false);
            setLocking(true);
            clearSensitiveState();
        };
        const focusSearch = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                searchRef.current?.focus();
            }
        };

        window.addEventListener('vault:locked', handleLocked);
        window.addEventListener('vault:locking', handleLocking);
        document.addEventListener('keydown', focusSearch);
        void loadDashboard();

        return () => {
            cancelled = true;
            window.removeEventListener('vault:locked', handleLocked);
            window.removeEventListener('vault:locking', handleLocking);
            document.removeEventListener('keydown', focusSearch);
        };
    }, [clearSensitiveState]);

    useEffect(() => {
        if (!unlocked || loading || !unlockedRef.current) return;

        let cancelled = false;
        const timeout = window.setTimeout(
            async () => {
                const query = new URLSearchParams({ per_page: '5' });
                if (search.trim()) query.set('search', search.trim());
                if (filter === 'favorites') query.set('favorite', '1');
                if (folderFilter) query.set('folder_id', folderFilter);

                setFeedLoading(true);
                try {
                    const response = await api<PaginatedCredentials>(`/api/credentials?${query.toString()}`);
                    if (!cancelled && unlockedRef.current) {
                        setCredentials(response.data);
                        setFeedTotal(response.total);
                    }
                } catch (reason) {
                    if (!cancelled && !(reason instanceof ApiError && reason.status === 423)) {
                        setError(reason instanceof Error ? reason.message : 'Unable to load credentials.');
                    }
                } finally {
                    if (!cancelled) setFeedLoading(false);
                }
            },
            search.trim() ? 250 : 0,
        );

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [feedVersion, filter, folderFilter, loading, search, unlocked]);

    useEffect(() => {
        if (!unlocked || loading) return;

        const activityEvents: (keyof WindowEventMap)[] = ['keydown', 'mousedown', 'pointerdown', 'scroll', 'touchstart'];
        let ticker: number | undefined;
        const timeoutMs = (autoLockMinutes ?? 0) * 60_000;
        let expiresAt = Date.now() + timeoutMs;

        const resetCountdown = () => {
            if (autoLockMinutes === null || autoLockMinutes <= 0) return;
            lastActivityRef.current = Date.now();
            expiresAt = lastActivityRef.current + timeoutMs;
            setRemainingSeconds(autoLockMinutes * 60);
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') void lockVault();
        };

        if (autoLockMinutes !== null && autoLockMinutes > 0) {
            ticker = window.setInterval(() => {
                const now = Date.now();
                const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
                setRemainingSeconds(remaining);

                if (remaining === 0) {
                    void lockVault();
                    return;
                }

                if (now - lastActivityRef.current < 30_000 && now - lastHeartbeatRef.current >= 30_000) {
                    lastHeartbeatRef.current = now;
                    void api<{ locked: boolean }>('/api/vault/status')
                        .then((status) => {
                            if (status.locked) window.dispatchEvent(new Event('vault:locked'));
                        })
                        .catch((reason: unknown) => {
                            if (!(reason instanceof ApiError && reason.status === 423)) {
                                setError(reason instanceof Error ? reason.message : 'Unable to refresh vault status.');
                            }
                        });
                }
            }, 1000);
        }

        activityEvents.forEach((event) => window.addEventListener(event, resetCountdown, { passive: true }));
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            if (ticker !== undefined) window.clearInterval(ticker);
            activityEvents.forEach((event) => window.removeEventListener(event, resetCountdown));
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [autoLockMinutes, loading, lockVault, unlocked]);

    const folderCredentialTotal = useMemo(() => folders.reduce((total, folder) => total + folder.credentials_count, 0), [folders]);
    const unfiledTotal = Math.max(0, credentialTotal - folderCredentialTotal);
    const maxFolderCount = Math.max(1, ...folders.map((folder) => folder.credentials_count));

    const fetchCredentialPassword = useCallback(async (credentialId: number) => {
        const response = await api<{ password: string }>(`/api/credentials/${credentialId}/reveal`, { method: 'POST' });
        if (!unlockedRef.current) throw new Error('The vault was locked before the password could be retrieved.');
        return response.password;
    }, []);

    async function togglePassword(credential: Credential) {
        if (revealedPasswords[credential.id] !== undefined) {
            setRevealedPasswords((current) => {
                const next = { ...current };
                delete next[credential.id];
                return next;
            });
            return;
        }

        setPasswordLoading(credential.id);
        setError('');
        try {
            const password = await fetchCredentialPassword(credential.id);
            setRevealedPasswords((current) => ({ ...current, [credential.id]: password }));
        } catch (reason) {
            if (!(reason instanceof ApiError && reason.status === 423)) {
                setError(reason instanceof Error ? reason.message : 'Unable to reveal this password.');
            }
        } finally {
            setPasswordLoading(null);
        }
    }

    async function copyText(value: string, successMessage: string) {
        setError('');
        setNotice('');
        try {
            await navigator.clipboard.writeText(value);
            setNotice(successMessage);
        } catch {
            setError('Clipboard access failed. Check your browser permissions and try again.');
        }
    }

    async function copyCredentialPassword(credential: Credential) {
        setPasswordLoading(credential.id);
        try {
            const password = revealedPasswords[credential.id] ?? (await fetchCredentialPassword(credential.id));
            await copyText(password, 'Password copied to clipboard.');
        } catch (reason) {
            if (!(reason instanceof ApiError && reason.status === 423)) {
                setError(reason instanceof Error ? reason.message : 'Unable to copy this password.');
            }
        } finally {
            setPasswordLoading(null);
        }
    }

    async function toggleFavorite(credential: Credential) {
        setFavoriteSaving(credential.id);
        setError('');
        setNotice('');
        const isFavorite = !credential.is_favorite;

        try {
            await api(`/api/credentials/${credential.id}`, {
                method: 'PUT',
                body: JSON.stringify({ is_favorite: isFavorite }),
            });
            setCredentials((items) =>
                filter === 'favorites' && !isFavorite
                    ? items.filter((item) => item.id !== credential.id)
                    : items.map((item) => (item.id === credential.id ? { ...item, is_favorite: isFavorite } : item)),
            );
            const favoriteResponse = await api<PaginatedCredentials>('/api/credentials?favorite=1&per_page=1');
            setFavoriteTotal(favoriteResponse.total);
            setNotice(isFavorite ? 'Added to favorites.' : 'Removed from favorites.');
            setFeedVersion((version) => version + 1);
        } catch (reason) {
            if (!(reason instanceof ApiError && reason.status === 423)) {
                setError(reason instanceof Error ? reason.message : 'Unable to update favorite.');
            }
        } finally {
            setFavoriteSaving(null);
        }
    }

    if ((loading || !unlocked) && !lockFailed && !locking) {
        return (
            <div className="flex min-h-svh items-center justify-center bg-[#F8FAFC] text-[#0A2647]" role="status">
                <Head title="Loading dashboard" />
                {error ? (
                    <div className="max-w-sm px-5 text-center" role="alert">
                        <p className="font-medium">Dashboard unavailable</p>
                        <p className="mt-2 text-sm text-slate-600">{error}</p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="mt-4 text-sm font-semibold text-[#205295] hover:underline"
                        >
                            Try again
                        </button>
                    </div>
                ) : (
                    <>
                        <span className="size-6 animate-spin rounded-full border-2 border-[#2C74B3]/25 border-t-[#205295]" />
                        <span className="sr-only">Checking vault status</span>
                    </>
                )}
            </div>
        );
    }

    if (locking || lockFailed) {
        return (
            <div className="flex min-h-svh items-center justify-center bg-[#F8FAFC] p-5 text-[#0A2647]">
                <Head title="Locking vault" />
                <section className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-lg">
                    <LockKeyhole className="mx-auto size-9 text-[#205295]" aria-hidden="true" />
                    <h1 className="text-xl font-semibold">{lockFailed ? 'Vault lock not confirmed' : 'Locking your vault'}</h1>
                    <p className="text-sm leading-6 text-slate-600">
                        {lockFailed
                            ? 'Dashboard data has been cleared. Retry the lock request before continuing.'
                            : 'Clearing dashboard data and confirming the lock with the server.'}
                    </p>
                    {error && (
                        <p role="alert" className="text-sm text-red-700">
                            {error}
                        </p>
                    )}
                    {lockFailed && (
                        <button
                            type="button"
                            onClick={() => void lockVault()}
                            className="rounded-lg bg-[#003A78] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#205295]"
                        >
                            Retry lock
                        </button>
                    )}
                </section>
            </div>
        );
    }

    return (
        <div className="min-h-svh bg-[#F8FAFC] text-[#0A2647]">
            <Head title="Dashboard" />

            {mobileNavOpen && (
                <button
                    type="button"
                    aria-label="Close navigation menu"
                    className="fixed inset-0 z-40 bg-[#06182c]/55 lg:hidden"
                    onClick={() => setMobileNavOpen(false)}
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col bg-[#0A2647] text-white shadow-xl transition-transform duration-200 lg:translate-x-0 ${
                    mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-6">
                    <Link href="/dashboard" className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-[#205295] text-white">
                            <img src="/logo.svg" alt="" className="size-6 object-contain" />
                        </span>
                        <span>
                            <span className="block text-lg leading-5 font-bold tracking-tight">Lockr</span>
                            <span className="mt-1 block text-[10px] tracking-[0.16em] text-blue-200 uppercase">Personal Vault</span>
                        </span>
                    </Link>
                    <button
                        type="button"
                        aria-label="Close navigation menu"
                        className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden"
                        onClick={() => setMobileNavOpen(false)}
                    >
                        <X className="size-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="px-4 pt-5">
                    <button
                        type="button"
                        onClick={() => void lockVault()}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-3 text-sm font-semibold transition-colors hover:bg-white/[0.14] focus-visible:ring-2 focus-visible:ring-white"
                    >
                        <LockKeyhole className="size-4" aria-hidden="true" />
                        Lock Vault
                    </button>
                </div>

                <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3 py-6">
                    <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.16em] text-blue-200/70 uppercase">Workspace</p>
                    {navigation.map(({ title, href, icon: Icon }) => {
                        const active = title === 'Dashboard';
                        return (
                            <Link
                                key={title}
                                href={href}
                                data-sidebar="menu-button"
                                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white ${
                                    active ? 'bg-[#205295] text-white shadow-sm' : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
                                }`}
                                onClick={() => setMobileNavOpen(false)}
                                aria-current={active ? 'page' : undefined}
                            >
                                <Icon className="size-[18px]" aria-hidden="true" />
                                {title}
                            </Link>
                        );
                    })}
                </nav>

                <div className="border-t border-white/10 p-4">
                    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-white/[0.06] p-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#2C74B3] text-sm font-semibold">
                            {initials(auth.user.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{auth.user.name}</span>
                            <span className="block truncate text-xs text-slate-300">{auth.user.email}</span>
                        </span>
                        <Link
                            href="/settings/profile"
                            aria-label="Open profile settings"
                            className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
                        >
                            <MoreHorizontal className="size-5" aria-hidden="true" />
                        </Link>
                    </div>
                    <Link
                        href="/logout"
                        method="post"
                        as="button"
                        className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/[0.08] hover:text-white"
                    >
                        <LogOut className="size-4" aria-hidden="true" />
                        Sign out
                    </Link>
                </div>
            </aside>

            <div className="min-h-svh lg:pl-[17rem]">
                <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
                    <div className="mx-auto flex min-h-[76px] max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
                        <button
                            type="button"
                            aria-label="Open navigation menu"
                            aria-expanded={mobileNavOpen}
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-[#144272] hover:bg-slate-50 lg:hidden"
                            onClick={() => setMobileNavOpen(true)}
                        >
                            <Menu className="size-5" aria-hidden="true" />
                        </button>

                        <div className="relative min-w-[180px] flex-1">
                            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                            <label htmlFor="dashboard-search" className="sr-only">
                                Search credentials
                            </label>
                            <input
                                ref={searchRef}
                                id="dashboard-search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search credentials..."
                                className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] pr-16 pl-10 text-sm transition outline-none focus:border-[#2C74B3] focus:ring-4 focus:ring-[#2C74B3]/10"
                            />
                            <kbd className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500">
                                Ctrl K
                            </kbd>
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <div
                                className="hidden items-center gap-2 rounded-xl bg-[#EFF4FF] px-3 py-2 text-xs font-medium text-[#144272] sm:flex"
                                aria-label={
                                    autoLockMinutes === 0 ? 'Automatic lock is disabled' : `Vault auto-locks in ${lockCountdown(remainingSeconds)}`
                                }
                            >
                                <Clock3 className="size-4 text-[#2C74B3]" aria-hidden="true" />
                                <span>{autoLockMinutes === 0 ? 'Auto-lock off' : `Locks in ${lockCountdown(remainingSeconds)}`}</span>
                            </div>
                            <Link
                                href="/vault?create=1"
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#003A78] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#205295] focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-2 sm:px-4"
                            >
                                <KeyRound className="size-4" aria-hidden="true" />
                                <span className="hidden sm:inline">New Credential</span>
                                <span className="sm:hidden">New</span>
                            </Link>
                            <button
                                type="button"
                                onClick={() => void lockVault()}
                                className="hidden size-10 items-center justify-center rounded-xl border border-slate-200 text-[#144272] transition hover:bg-slate-50 sm:flex"
                                aria-label="Lock Vault"
                                title="Lock Vault"
                            >
                                <LockKeyhole className="size-4" aria-hidden="true" />
                            </button>
                            <span
                                className="hidden size-10 items-center justify-center rounded-full bg-[#144272] text-xs font-semibold text-white md:flex"
                                aria-label={auth.user.name}
                                title={auth.user.name}
                            >
                                {initials(auth.user.name)}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs sm:hidden">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                            <Clock3 className="size-3.5 text-[#2C74B3]" aria-hidden="true" />
                            {autoLockMinutes === 0 ? 'Auto-lock off' : `Locks in ${lockCountdown(remainingSeconds)}`}
                        </span>
                        <button type="button" onClick={() => void lockVault()} className="font-semibold text-[#205295]">
                            Lock Vault
                        </button>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
                    <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                        <div>
                            <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
                                <ShieldCheck className="size-3.5" aria-hidden="true" />
                                Vault session active
                            </p>
                            <p className="mt-4 text-sm font-medium text-[#205295]">Welcome back, {auth.user.name}</p>
                            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0A2647] sm:text-3xl">Your dashboard</h1>
                            <p className="mt-1 text-sm leading-6 text-slate-500">A clear overview of your personal vault.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <a
                                href="#quick-generator"
                                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#144272] transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#2C74B3]"
                            >
                                <KeyRound className="size-4" aria-hidden="true" />
                                Password Generator
                            </a>
                            <Link
                                href="/vault?create=1"
                                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#003A78] px-3.5 text-sm font-semibold text-white transition hover:bg-[#205295] focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-2"
                            >
                                <KeyRound className="size-4" aria-hidden="true" />
                                Add Credential
                            </Link>
                        </div>
                    </section>

                    {error && (
                        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            {error}
                        </p>
                    )}
                    {notice && (
                        <p
                            role="status"
                            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                        >
                            <Check className="size-4 shrink-0" aria-hidden="true" />
                            {notice}
                        </p>
                    )}

                    <section aria-label="Vault overview" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                        <MetricCard
                            title="Total Credentials"
                            value={credentialTotal}
                            icon={KeyRound}
                            detail="Stored in your vault"
                            href="/vault"
                            loading={loading}
                        />
                        <MetricCard
                            title="Organized Folders"
                            value={folders.length}
                            icon={FolderClosed}
                            detail={folders.length ? `${folderCredentialTotal} credentials organized` : 'Create a folder in My Vault'}
                            href="/vault?folder=all"
                            loading={loading}
                        />
                        <MetricCard
                            title="Starred Favorites"
                            value={favoriteTotal}
                            icon={Heart}
                            detail="Quick access to important items"
                            href="/vault?favorites=1"
                            loading={loading}
                        />
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(10,38,71,0.5)]">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Auto-lock</p>
                                    <p className="mt-2 text-xl font-bold tracking-tight text-[#0A2647]">
                                        {autoLockMinutes === null ? '—' : autoLockMinutes === 0 ? 'Disabled' : `${autoLockMinutes} min`}
                                    </p>
                                </div>
                                <span className="flex size-10 items-center justify-center rounded-xl bg-[#EFF4FF] text-[#205295]">
                                    <ShieldCheck className="size-5" aria-hidden="true" />
                                </span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                {autoLockMinutes === null
                                    ? 'Loading your security preference.'
                                    : autoLockMinutes === 0
                                      ? 'Manual locking remains available.'
                                      : `Locks after ${autoLockMinutes} ${autoLockMinutes === 1 ? 'minute' : 'minutes'} of inactivity.`}
                            </p>
                            <Link
                                href="/settings/security"
                                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#205295] hover:text-[#003A78] hover:underline"
                            >
                                Change setting
                                <ChevronDown className="size-3 -rotate-90" aria-hidden="true" />
                            </Link>
                        </div>
                    </section>

                    <section className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1.7fr)_minmax(310px,0.85fr)]">
                        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_-20px_rgba(10,38,71,0.5)]">
                            <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <div>
                                    <h2 className="text-lg font-bold tracking-tight text-[#0A2647]">Recently used &amp; updated</h2>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                        Passwords stay hidden until you choose to reveal or copy them.
                                    </p>
                                </div>
                                <Link
                                    href="/vault"
                                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-[#144272] transition hover:bg-slate-50"
                                >
                                    View All
                                </Link>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3 sm:px-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilter('all');
                                        setFolderFilter('');
                                    }}
                                    aria-pressed={filter === 'all' && !folderFilter}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === 'all' && !folderFilter ? 'bg-[#EFF4FF] text-[#144272]' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    All credentials
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilter('favorites');
                                        setFolderFilter('');
                                    }}
                                    aria-pressed={filter === 'favorites'}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === 'favorites' ? 'bg-[#EFF4FF] text-[#144272]' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    Favorites
                                </button>
                                <label htmlFor="folder-filter" className="sr-only">
                                    Filter by folder
                                </label>
                                <select
                                    id="folder-filter"
                                    value={folderFilter}
                                    onChange={(event) => {
                                        setFolderFilter(event.target.value);
                                        setFilter('all');
                                    }}
                                    className="ml-auto min-h-9 max-w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-[#2C74B3] focus:ring-2 focus:ring-[#2C74B3]/15"
                                >
                                    <option value="">All folders</option>
                                    {folders.map((folder) => (
                                        <option key={folder.id} value={folder.id}>
                                            {folder.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="divide-y divide-slate-100 px-5 sm:px-6" aria-live="polite">
                                {feedLoading ? (
                                    <div className="space-y-3 py-6" role="status">
                                        <span className="sr-only">Loading credentials</span>
                                        {[0, 1, 2].map((item) => (
                                            <div key={item} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />
                                        ))}
                                    </div>
                                ) : credentials.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#EFF4FF] text-[#205295]">
                                            {search.trim() ? (
                                                <Search className="size-5" aria-hidden="true" />
                                            ) : (
                                                <KeyRound className="size-5" aria-hidden="true" />
                                            )}
                                        </span>
                                        <h3 className="mt-4 text-sm font-semibold text-[#0A2647]">
                                            {search.trim() ? 'No matching credentials' : 'Your vault is ready'}
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {search.trim() ? 'Try another search term or filter.' : 'Add a credential to see recent items here.'}
                                        </p>
                                        {!search.trim() && (
                                            <Link
                                                href="/vault?create=1"
                                                className="mt-4 inline-flex text-xs font-semibold text-[#205295] hover:underline"
                                            >
                                                Add your first credential
                                            </Link>
                                        )}
                                    </div>
                                ) : (
                                    credentials.map((credential) => (
                                        <article key={credential.id} className="min-w-0 py-4">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF4FF] text-[#205295]">
                                                    <KeyRound className="size-[18px]" aria-hidden="true" />
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                        <h3 className="max-w-full truncate text-sm font-semibold text-[#0A2647]">
                                                            {credential.title}
                                                        </h3>
                                                        {credential.folder && (
                                                            <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                                                {credential.folder.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 truncate text-xs text-slate-500">
                                                        {credential.username || credential.website_url || 'No username provided'}
                                                    </p>
                                                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                                                        {credential.website_url && (
                                                            <a
                                                                href={credential.website_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="max-w-[180px] truncate text-[#205295] hover:underline"
                                                            >
                                                                {credential.website_url}
                                                            </a>
                                                        )}
                                                        <span className="inline-flex items-center gap-1">
                                                            <Clock3 className="size-3" aria-hidden="true" />
                                                            Updated {formatUpdatedAt(credential.updated_at)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    aria-label={
                                                        credential.is_favorite
                                                            ? `Remove ${credential.title} from favorites`
                                                            : `Add ${credential.title} to favorites`
                                                    }
                                                    disabled={favoriteSaving === credential.id}
                                                    onClick={() => void toggleFavorite(credential)}
                                                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-[#2C74B3] disabled:opacity-50 ${
                                                        credential.is_favorite ? 'text-amber-500' : 'text-slate-400'
                                                    }`}
                                                >
                                                    <Star
                                                        className={`size-[18px] ${credential.is_favorite ? 'fill-current' : ''}`}
                                                        aria-hidden="true"
                                                    />
                                                </button>
                                            </div>

                                            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 pl-[52px]">
                                                <span className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-500">
                                                    {revealedPasswords[credential.id] ?? '••••••••••••'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => void togglePassword(credential)}
                                                    disabled={passwordLoading === credential.id}
                                                    aria-label={
                                                        revealedPasswords[credential.id]
                                                            ? `Hide ${credential.title} password`
                                                            : `Show ${credential.title} password`
                                                    }
                                                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#2C74B3] disabled:opacity-50"
                                                >
                                                    {revealedPasswords[credential.id] ? (
                                                        <EyeOff className="size-4" aria-hidden="true" />
                                                    ) : (
                                                        <Eye className="size-4" aria-hidden="true" />
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void copyCredentialPassword(credential)}
                                                    disabled={passwordLoading === credential.id}
                                                    aria-label={`Copy ${credential.title} password`}
                                                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#2C74B3] disabled:opacity-50"
                                                >
                                                    <Copy className="size-4" aria-hidden="true" />
                                                </button>
                                                {credential.username && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void copyText(credential.username!, 'Username copied to clipboard.')}
                                                        aria-label={`Copy ${credential.title} username`}
                                                        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#2C74B3]"
                                                    >
                                                        <UserRound className="size-4" aria-hidden="true" />
                                                    </button>
                                                )}
                                                <details className="relative">
                                                    <summary
                                                        aria-label={`More actions for ${credential.title}`}
                                                        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
                                                    >
                                                        <MoreHorizontal className="size-4" aria-hidden="true" />
                                                    </summary>
                                                    <div className="absolute right-0 z-10 mt-1 min-w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                                                        <Link
                                                            href="/vault"
                                                            className="block rounded-md px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                                        >
                                                            Open in My Vault
                                                        </Link>
                                                        {credential.website_url && (
                                                            <a
                                                                href={credential.website_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="block rounded-md px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                                                            >
                                                                Open website
                                                            </a>
                                                        )}
                                                    </div>
                                                </details>
                                            </div>
                                        </article>
                                    ))
                                )}
                            </div>
                            {!feedLoading && feedTotal > credentials.length && (
                                <div className="border-t border-slate-100 px-5 py-3 text-center sm:px-6">
                                    <Link href="/vault" className="text-xs font-semibold text-[#205295] hover:text-[#003A78] hover:underline">
                                        View all {feedTotal} credentials
                                    </Link>
                                </div>
                            )}
                        </div>

                        <div className="grid min-w-0 gap-6 sm:grid-cols-2 2xl:grid-cols-1">
                            <div id="quick-generator" className="min-w-0">
                                <PasswordGenerator />
                            </div>

                            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(10,38,71,0.5)] sm:col-span-2 2xl:col-span-1">
                                <header className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-base font-bold text-[#0A2647]">Folders breakdown</h2>
                                        <p className="mt-1 text-xs text-slate-500">Your credentials by collection</p>
                                    </div>
                                    <Link href="/vault?folder=all" className="text-xs font-semibold text-[#205295] hover:underline">
                                        Manage
                                    </Link>
                                </header>
                                {loading ? (
                                    <div className="mt-5 h-24 animate-pulse rounded-xl bg-slate-100" role="status">
                                        <span className="sr-only">Loading folders</span>
                                    </div>
                                ) : folders.length === 0 && unfiledTotal === 0 ? (
                                    <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                                        No folders or credentials yet.
                                    </p>
                                ) : (
                                    <div className="mt-4 space-y-4">
                                        {folders.slice(0, 6).map((folder) => (
                                            <Link
                                                key={folder.id}
                                                href={`/vault?folder=${folder.id}`}
                                                className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#2C74B3]"
                                            >
                                                <span className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                                                    <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700 group-hover:text-[#205295]">
                                                        <FolderClosed className="size-4 shrink-0 text-[#2C74B3]" aria-hidden="true" />
                                                        <span className="truncate">{folder.name}</span>
                                                    </span>
                                                    <span className="shrink-0 font-mono text-[11px] text-slate-500">{folder.credentials_count}</span>
                                                </span>
                                                <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                    <span
                                                        className="block h-full rounded-full bg-[#2C74B3] transition-[width]"
                                                        style={{ width: `${Math.max(3, (folder.credentials_count / maxFolderCount) * 100)}%` }}
                                                    />
                                                </span>
                                            </Link>
                                        ))}
                                        {unfiledTotal > 0 && (
                                            <Link
                                                href="/vault?folder=unfiled"
                                                className="flex items-center justify-between text-xs text-slate-600 hover:text-[#205295]"
                                            >
                                                <span>Unfiled</span>
                                                <span className="font-mono">{unfiledTotal}</span>
                                            </Link>
                                        )}
                                        {folders.length > 6 && (
                                            <Link
                                                href="/vault?folder=all"
                                                className="block text-center text-xs font-medium text-[#205295] hover:underline"
                                            >
                                                View all {folders.length} folders
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </section>

                            <aside className="rounded-2xl border border-[#2C74B3]/15 bg-[#EFF4FF]/70 p-5 sm:col-span-2 2xl:col-span-1">
                                <div className="flex items-start gap-3">
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#205295] shadow-sm">
                                        <ShieldCheck className="size-[18px]" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-bold text-[#0A2647]">Security information</h2>
                                        <p className="mt-1 text-xs leading-5 text-slate-600">
                                            {autoLockMinutes === null
                                                ? 'Loading your auto-lock preference.'
                                                : autoLockMinutes === 0
                                                  ? 'Automatic inactivity locking is disabled. You can still lock the vault manually.'
                                                  : `Your vault automatically locks after ${autoLockMinutes} ${autoLockMinutes === 1 ? 'minute' : 'minutes'} of inactivity.`}
                                        </p>
                                        <p className="mt-2 text-[11px] leading-5 text-slate-500">
                                            Credential passwords and notes use Laravel encrypted attribute casts with the application key. This is not
                                            client-side encryption.
                                        </p>
                                        <Link
                                            href="/settings/security"
                                            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#205295] hover:underline"
                                        >
                                            Security settings
                                            <ChevronDown className="size-3 -rotate-90" aria-hidden="true" />
                                        </Link>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}

function MetricCard({
    title,
    value,
    icon: Icon,
    detail,
    href,
    loading,
}: {
    title: string;
    value: number;
    icon: LucideIcon;
    detail: string;
    href: string;
    loading: boolean;
}) {
    return (
        <Link
            href={href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(10,38,71,0.5)] transition hover:-translate-y-0.5 hover:border-[#2C74B3]/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#2C74B3]"
        >
            <span className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-slate-500">{title}</span>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#EFF4FF] text-[#205295] transition group-hover:bg-[#205295] group-hover:text-white">
                    <Icon className="size-5" aria-hidden="true" />
                </span>
            </span>
            <span className="mt-3 block font-mono text-3xl font-semibold tracking-tight text-[#0A2647]">
                {loading ? <span className="inline-block h-9 w-12 animate-pulse rounded-md bg-slate-100" /> : value}
            </span>
            <span className="mt-2 block truncate text-xs text-slate-500">{detail}</span>
        </Link>
    );
}
