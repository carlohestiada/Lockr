import PageContainer from '@/components/layout/page-container';
import VaultShell from '@/components/layout/vault-shell';
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
    LockKeyhole,
    MoreHorizontal,
    Search,
    ShieldCheck,
    Star,
    UserRound,
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

function formatUpdatedAt(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Recently updated'
        : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export default function Dashboard() {
    const { auth } = usePage<SharedData>().props;
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [credentialTotal, setCredentialTotal] = useState(0);
    const [favoriteTotal, setFavoriteTotal] = useState(0);
    const [feedTotal, setFeedTotal] = useState(0);
    const [autoLockMinutes, setAutoLockMinutes] = useState<number | null>(null);
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
    const [feedVersion, setFeedVersion] = useState(0);
    const unlockedRef = useRef(false);
    const lockRequestRef = useRef(false);

    const clearSensitiveState = useCallback(() => {
        setCredentials([]);
        setRevealedPasswords({});
        setPasswordLoading(null);
    }, []);

    const lockVault = useCallback(async (): Promise<boolean> => {
        if (lockRequestRef.current) return false;
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
            return true;
        } catch (reason) {
            if (reason instanceof ApiError && reason.status === 423) {
                router.visit('/vault', { replace: true });
                return true;
            }
            lockRequestRef.current = false;
            setLocking(false);
            setLockFailed(true);
            setError(reason instanceof Error ? reason.message : 'Unable to confirm that the vault is locked.');
            return false;
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
        const handlePreferencesUpdated = (event: WindowEventMap['preferences:updated']) => {
            setAutoLockMinutes(event.detail.auto_lock_minutes);
        };

        window.addEventListener('vault:locked', handleLocked);
        window.addEventListener('vault:locking', handleLocking);
        window.addEventListener('preferences:updated', handlePreferencesUpdated);
        void loadDashboard();

        return () => {
            cancelled = true;
            window.removeEventListener('vault:locked', handleLocked);
            window.removeEventListener('vault:locking', handleLocking);
            window.removeEventListener('preferences:updated', handlePreferencesUpdated);
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
            <div className="bg-lockr-canvas text-lockr-navy flex min-h-svh items-center justify-center" role="status">
                <Head title="Loading dashboard" />
                {error ? (
                    <div className="max-w-sm px-5 text-center" role="alert">
                        <p className="font-medium">Dashboard unavailable</p>
                        <p className="mt-2 text-sm text-slate-600">{error}</p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="text-lockr-interactive mt-4 text-sm font-semibold hover:underline"
                        >
                            Try again
                        </button>
                    </div>
                ) : (
                    <>
                        <span className="border-lockr-accent/25 border-t-lockr-interactive size-6 animate-spin rounded-full border-2" />
                        <span className="sr-only">Checking vault status</span>
                    </>
                )}
            </div>
        );
    }

    if (locking || lockFailed) {
        return (
            <div className="bg-lockr-canvas text-lockr-navy flex min-h-svh items-center justify-center p-5">
                <Head title="Locking vault" />
                <section className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-lg">
                    <LockKeyhole className="text-lockr-interactive mx-auto size-9" aria-hidden="true" />
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
                            className="bg-lockr-primary hover:bg-lockr-interactive rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
                        >
                            Retry lock
                        </button>
                    )}
                </section>
            </div>
        );
    }

    return (
        <VaultShell
            title="Dashboard"
            headerSearch={{ value: search, onChange: setSearch, placeholder: 'Search credentials...' }}
            counts={loading ? undefined : { credentials: credentialTotal, folders: folders.length, favorites: favoriteTotal }}
            autoLockMinutes={autoLockMinutes}
            autoLockActive={!loading && unlocked}
            onLock={lockVault}
        >
            <PageContainer className="space-y-6">
                <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                    <div>
                        <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
                            <ShieldCheck className="size-3.5" aria-hidden="true" />
                            Vault session active
                        </p>
                        <p className="text-lockr-interactive mt-4 text-sm font-medium">Welcome back, {auth.user.name}</p>
                        <h1 className="text-lockr-navy mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Your dashboard</h1>
                        <p className="mt-1 text-sm leading-6 text-slate-500">A clear overview of your personal vault.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <a
                            href="#quick-generator"
                            className="text-lockr-navy-active focus-visible:ring-lockr-accent inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold transition hover:bg-slate-50 focus-visible:ring-2"
                        >
                            <KeyRound className="size-4" aria-hidden="true" />
                            Password Generator
                        </a>
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
                                <p className="text-lockr-navy mt-2 text-xl font-bold tracking-tight">
                                    {autoLockMinutes === null ? '—' : autoLockMinutes === 0 ? 'Disabled' : `${autoLockMinutes} min`}
                                </p>
                            </div>
                            <span className="bg-lockr-input text-lockr-interactive flex size-10 items-center justify-center rounded-xl">
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
                            className="text-lockr-interactive hover:text-lockr-primary mt-3 inline-flex items-center gap-1 text-xs font-semibold hover:underline"
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
                                <h2 className="text-lockr-navy text-lg font-bold tracking-tight">Recently used &amp; updated</h2>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    Passwords stay hidden until you choose to reveal or copy them.
                                </p>
                            </div>
                            <Link
                                href="/vault"
                                className="text-lockr-navy-active inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold transition hover:bg-slate-50"
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
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === 'all' && !folderFilter ? 'bg-lockr-input text-lockr-navy-active' : 'text-slate-500 hover:bg-slate-50'}`}
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
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === 'favorites' ? 'bg-lockr-input text-lockr-navy-active' : 'text-slate-500 hover:bg-slate-50'}`}
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
                                className="focus:border-lockr-accent focus:ring-lockr-accent/15 ml-auto min-h-9 max-w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:ring-2"
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
                                    <span className="bg-lockr-input text-lockr-interactive mx-auto flex size-12 items-center justify-center rounded-2xl">
                                        {search.trim() ? (
                                            <Search className="size-5" aria-hidden="true" />
                                        ) : (
                                            <KeyRound className="size-5" aria-hidden="true" />
                                        )}
                                    </span>
                                    <h3 className="text-lockr-navy mt-4 text-sm font-semibold">
                                        {search.trim() ? 'No matching credentials' : 'Your vault is ready'}
                                    </h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {search.trim() ? 'Try another search term or filter.' : 'Add a credential to see recent items here.'}
                                    </p>
                                    {!search.trim() && (
                                        <Link
                                            href="/vault?create=1"
                                            className="text-lockr-interactive mt-4 inline-flex text-xs font-semibold hover:underline"
                                        >
                                            Add your first credential
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                credentials.map((credential) => (
                                    <article key={credential.id} className="min-w-0 py-4">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <span className="bg-lockr-input text-lockr-interactive flex size-10 shrink-0 items-center justify-center rounded-xl">
                                                <KeyRound className="size-[18px]" aria-hidden="true" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                    <h3 className="text-lockr-navy max-w-full truncate text-sm font-semibold">{credential.title}</h3>
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
                                                            className="text-lockr-interactive max-w-[180px] truncate hover:underline"
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
                                                className={`focus-visible:ring-lockr-accent flex size-9 shrink-0 items-center justify-center rounded-lg transition hover:bg-amber-50 focus-visible:ring-2 disabled:opacity-50 ${
                                                    credential.is_favorite ? 'text-amber-500' : 'text-slate-400'
                                                }`}
                                            >
                                                <Star className={`size-[18px] ${credential.is_favorite ? 'fill-current' : ''}`} aria-hidden="true" />
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
                                                className="focus-visible:ring-lockr-accent flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:ring-2 disabled:opacity-50"
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
                                                className="focus-visible:ring-lockr-accent flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:ring-2 disabled:opacity-50"
                                            >
                                                <Copy className="size-4" aria-hidden="true" />
                                            </button>
                                            {credential.username && (
                                                <button
                                                    type="button"
                                                    onClick={() => void copyText(credential.username!, 'Username copied to clipboard.')}
                                                    aria-label={`Copy ${credential.title} username`}
                                                    className="focus-visible:ring-lockr-accent flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:ring-2"
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
                                <Link href="/vault" className="text-lockr-interactive hover:text-lockr-primary text-xs font-semibold hover:underline">
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
                                    <h2 className="text-lockr-navy text-base font-bold">Folders breakdown</h2>
                                    <p className="mt-1 text-xs text-slate-500">Your credentials by collection</p>
                                </div>
                                <Link href="/vault?folder=all" className="text-lockr-interactive text-xs font-semibold hover:underline">
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
                                            className="group focus-visible:ring-lockr-accent block rounded-lg outline-none focus-visible:ring-2"
                                        >
                                            <span className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                                                <span className="group-hover:text-lockr-interactive flex min-w-0 items-center gap-2 font-medium text-slate-700">
                                                    <FolderClosed className="text-lockr-accent size-4 shrink-0" aria-hidden="true" />
                                                    <span className="truncate">{folder.name}</span>
                                                </span>
                                                <span className="shrink-0 font-mono text-[11px] text-slate-500">{folder.credentials_count}</span>
                                            </span>
                                            <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                <span
                                                    className="bg-lockr-accent block h-full rounded-full transition-[width]"
                                                    style={{ width: `${Math.max(3, (folder.credentials_count / maxFolderCount) * 100)}%` }}
                                                />
                                            </span>
                                        </Link>
                                    ))}
                                    {unfiledTotal > 0 && (
                                        <Link
                                            href="/vault?folder=unfiled"
                                            className="hover:text-lockr-interactive flex items-center justify-between text-xs text-slate-600"
                                        >
                                            <span>Unfiled</span>
                                            <span className="font-mono">{unfiledTotal}</span>
                                        </Link>
                                    )}
                                    {folders.length > 6 && (
                                        <Link
                                            href="/vault?folder=all"
                                            className="text-lockr-interactive block text-center text-xs font-medium hover:underline"
                                        >
                                            View all {folders.length} folders
                                        </Link>
                                    )}
                                </div>
                            )}
                        </section>

                        <aside className="border-lockr-accent/15 bg-lockr-input/70 rounded-2xl border p-5 sm:col-span-2 2xl:col-span-1">
                            <div className="flex items-start gap-3">
                                <span className="text-lockr-interactive flex size-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                                    <ShieldCheck className="size-[18px]" aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                    <h2 className="text-lockr-navy text-sm font-bold">Security information</h2>
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
                                        className="text-lockr-interactive mt-3 inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                                    >
                                        Security settings
                                        <ChevronDown className="size-3 -rotate-90" aria-hidden="true" />
                                    </Link>
                                </div>
                            </div>
                        </aside>
                    </div>
                </section>
            </PageContainer>
        </VaultShell>
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
            className="group hover:border-lockr-accent/30 focus-visible:ring-lockr-accent rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(10,38,71,0.5)] transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2"
        >
            <span className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-slate-500">{title}</span>
                <span className="bg-lockr-input text-lockr-interactive group-hover:bg-lockr-interactive flex size-10 items-center justify-center rounded-xl transition group-hover:text-white">
                    <Icon className="size-5" aria-hidden="true" />
                </span>
            </span>
            <span className="text-lockr-navy mt-3 block font-mono text-3xl font-semibold tracking-tight">
                {loading ? <span className="inline-block h-9 w-12 animate-pulse rounded-md bg-slate-100" /> : value}
            </span>
            <span className="mt-2 block truncate text-xs text-slate-500">{detail}</span>
        </Link>
    );
}
