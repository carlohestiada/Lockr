import PasswordGenerator from '@/components/password-generator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/layouts/app-layout';
import { ApiError, api } from '@/lib/api';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Clock3, FolderClosed, Heart, KeyRound, LockKeyhole, Search, ShieldCheck, Star, type LucideIcon } from 'lucide-react';
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

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

function formatUpdatedAt(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Recently updated' : date.toLocaleDateString();
}

export default function Dashboard() {
    const { auth } = usePage<SharedData>().props;
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [searchResults, setSearchResults] = useState<Credential[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [credentialTotal, setCredentialTotal] = useState(0);
    const [favoriteTotal, setFavoriteTotal] = useState(0);
    const [autoLockMinutes, setAutoLockMinutes] = useState(15);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [locking, setLocking] = useState(false);
    const [lockFailed, setLockFailed] = useState(false);
    const [favoriteSaving, setFavoriteSaving] = useState<number | null>(null);
    const [notice, setNotice] = useState('');
    const lockedRef = useRef(true);

    const clearDashboard = useCallback(() => {
        setCredentials([]);
        setSearchResults([]);
        setFolders([]);
        setCredentialTotal(0);
        setFavoriteTotal(0);
        setSearch('');
    }, []);

    const lockVault = useCallback(async () => {
        setError('');
        lockedRef.current = true;
        setLocking(true);
        setLockFailed(false);
        clearDashboard();
        try {
            await api('/api/vault/lock', { method: 'POST' });
            window.dispatchEvent(new Event('vault:locked'));
        } catch (reason) {
            if (reason instanceof ApiError && reason.status === 423) {
                return;
            }
            setError(reason instanceof Error ? reason.message : 'Unable to lock the vault.');
            setLocking(false);
            setLockFailed(true);
        }
    }, [clearDashboard]);

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
                    lockedRef.current = true;
                    router.visit('/vault', { replace: true });
                    return;
                }

                lockedRef.current = false;
                const [credentialResponse, favoriteResponse, folderResponse] = await Promise.all([
                    api<PaginatedCredentials>('/api/credentials?per_page=5'),
                    api<PaginatedCredentials>('/api/credentials?favorite=1&per_page=1'),
                    api<Folder[]>('/api/folders'),
                ]);

                if (cancelled || lockedRef.current) return;
                setCredentials(credentialResponse.data);
                setCredentialTotal(credentialResponse.total);
                setFavoriteTotal(favoriteResponse.total);
                setFolders(folderResponse);
            } catch (reason) {
                if (cancelled || (reason instanceof ApiError && reason.status === 423)) return;
                setError(reason instanceof Error ? reason.message : 'Unable to load your dashboard.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        const onLocked = () => {
            lockedRef.current = true;
            clearDashboard();
            setLocking(false);
            router.visit('/vault', { replace: true });
        };

        const onLockRequested = () => {
            lockedRef.current = true;
            setLocking(true);
            setLockFailed(false);
            clearDashboard();
        };
        const onLockFailed = (event: Event) => {
            setLocking(false);
            setLockFailed(true);
            setError(event instanceof CustomEvent && typeof event.detail === 'string' ? event.detail : 'Unable to lock the vault.');
        };

        window.addEventListener('vault:locked', onLocked);
        window.addEventListener('vault:locking', onLockRequested);
        window.addEventListener('vault:lock-failed', onLockFailed);
        void loadDashboard();

        return () => {
            cancelled = true;
            window.removeEventListener('vault:locked', onLocked);
            window.removeEventListener('vault:locking', onLockRequested);
            window.removeEventListener('vault:lock-failed', onLockFailed);
        };
    }, [clearDashboard]);

    useEffect(() => {
        if (loading || lockedRef.current) return;

        const activityEvents: (keyof WindowEventMap)[] = ['keydown', 'mousedown', 'pointerdown', 'scroll', 'touchstart'];
        let timer: number | undefined;

        const resetTimer = () => {
            if (autoLockMinutes <= 0) return;
            window.clearTimeout(timer);
            timer = window.setTimeout(() => void lockVault(), autoLockMinutes * 60_000);
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') void lockVault();
        };

        activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
        document.addEventListener('visibilitychange', onVisibilityChange);
        resetTimer();

        return () => {
            if (timer !== undefined) window.clearTimeout(timer);
            activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [autoLockMinutes, loading, lockVault]);

    useEffect(() => {
        const term = search.trim();
        if (!term) {
            setSearchResults([]);
            return;
        }

        let cancelled = false;
        const timeout = window.setTimeout(() => {
            api<PaginatedCredentials>(`/api/credentials?search=${encodeURIComponent(term)}&per_page=5`)
                .then((response) => {
                    if (!cancelled && !lockedRef.current) setSearchResults(response.data);
                })
                .catch((reason: unknown) => {
                    if (!cancelled && !(reason instanceof ApiError && reason.status === 423)) {
                        setError(reason instanceof Error ? reason.message : 'Unable to search credentials.');
                    }
                });
        }, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [search]);

    const visibleCredentials = useMemo(() => (search.trim() ? searchResults : credentials), [credentials, search, searchResults]);
    const folderCredentialTotal = useMemo(() => folders.reduce((total, folder) => total + folder.credentials_count, 0), [folders]);
    const unfiledTotal = Math.max(0, credentialTotal - folderCredentialTotal);

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
            const updateFavorite = (items: Credential[]) =>
                items.map((item) => (item.id === credential.id ? { ...item, is_favorite: isFavorite } : item));
            setCredentials(updateFavorite);
            setSearchResults(updateFavorite);
            const favoriteResponse = await api<PaginatedCredentials>('/api/credentials?favorite=1&per_page=1');
            setFavoriteTotal(favoriteResponse.total);
            setNotice(isFavorite ? 'Added to favorites.' : 'Removed from favorites.');
        } catch (reason) {
            if (!(reason instanceof ApiError && reason.status === 423)) {
                setError(reason instanceof Error ? reason.message : 'Unable to update favorite.');
            }
        } finally {
            setFavoriteSaving(null);
        }
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
                {locking || lockFailed ? (
                    <section className="bg-card mx-auto max-w-lg space-y-4 rounded-xl border p-6 text-center shadow-sm" aria-live="polite">
                        <LockKeyhole className="mx-auto size-8 text-[#205295]" aria-hidden="true" />
                        <h1 className="text-xl font-semibold text-[#0A2647]">{locking ? 'Locking your vault' : 'Vault lock not confirmed'}</h1>
                        <p className="text-muted-foreground text-sm">
                            {locking
                                ? 'Clearing dashboard data and confirming the lock with the server.'
                                : 'Dashboard data has been cleared. Retry the lock request before continuing.'}
                        </p>
                        {error && (
                            <p role="alert" className="text-destructive text-sm">
                                {error}
                            </p>
                        )}
                        {lockFailed && (
                            <Button type="button" onClick={() => void lockVault()} className="bg-[#144272] hover:bg-[#0A2647]">
                                Retry lock
                            </Button>
                        )}
                    </section>
                ) : (
                    <>
                        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <p className="text-sm font-medium text-[#205295]">Welcome back, {auth.user.name}</p>
                                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0A2647] sm:text-3xl">Your dashboard</h1>
                                <p className="text-muted-foreground mt-1 text-sm">A clear overview of your personal vault.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button asChild className="bg-[#144272] hover:bg-[#0A2647]">
                                    <Link href="/vault?create=1">
                                        <KeyRound />
                                        Add credential
                                    </Link>
                                </Button>
                                <Button type="button" variant="outline" onClick={() => void lockVault()}>
                                    <LockKeyhole />
                                    Lock vault
                                </Button>
                            </div>
                        </section>

                        {error && (
                            <p role="alert" className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
                                {error}
                            </p>
                        )}
                        {notice && (
                            <p role="status" className="text-muted-foreground text-sm">
                                {notice}
                            </p>
                        )}

                        <section aria-label="Vault overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <OverviewCard
                                title="Total credentials"
                                value={loading ? null : credentialTotal}
                                icon={KeyRound}
                                href="/vault"
                                detail="Stored in your vault"
                            />
                            <OverviewCard
                                title="Organized folders"
                                value={loading ? null : folders.length}
                                icon={FolderClosed}
                                href="/vault?folder=all"
                                detail="Your private collections"
                            />
                            <OverviewCard
                                title="Starred favorites"
                                value={loading ? null : favoriteTotal}
                                icon={Heart}
                                href="/vault?favorites=1"
                                detail="Quick access to important items"
                            />
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                    <CardTitle className="text-muted-foreground text-sm font-medium">Vault security</CardTitle>
                                    <ShieldCheck className="size-5 text-[#205295]" aria-hidden="true" />
                                </CardHeader>
                                <CardContent>
                                    <p className="text-lg font-semibold text-[#0A2647]">Encrypted at rest</p>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        {autoLockMinutes === 0
                                            ? 'Auto-lock is off; manual lock remains available.'
                                            : `Auto-lock after ${autoLockMinutes} ${autoLockMinutes === 1 ? 'minute' : 'minutes'} of inactivity.`}
                                    </p>
                                    <Link
                                        href="/settings/security"
                                        className="mt-3 inline-block text-xs font-medium text-[#205295] underline-offset-4 hover:underline"
                                    >
                                        Security settings
                                    </Link>
                                </CardContent>
                            </Card>
                        </section>

                        <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.9fr)]">
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <CardTitle className="text-lg text-[#0A2647]">Recently updated</CardTitle>
                                        <p className="text-muted-foreground mt-1 text-sm">Credential details stay masked until you open the vault.</p>
                                    </div>
                                    <Button asChild variant="outline" size="sm">
                                        <Link href="/vault">Open my vault</Link>
                                    </Button>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="relative">
                                        <Search
                                            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
                                            aria-hidden="true"
                                        />
                                        <label htmlFor="dashboard-search" className="sr-only">
                                            Search credentials
                                        </label>
                                        <Input
                                            id="dashboard-search"
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            placeholder="Search names, usernames, or websites"
                                            className="pl-9"
                                        />
                                    </div>

                                    {loading ? (
                                        <div className="space-y-3" aria-label="Loading credentials">
                                            {[0, 1, 2].map((item) => (
                                                <Skeleton key={item} className="h-16 w-full" />
                                            ))}
                                        </div>
                                    ) : visibleCredentials.length === 0 ? (
                                        <div className="rounded-lg border border-dashed p-8 text-center">
                                            <p className="font-medium text-[#0A2647]">
                                                {search.trim() ? 'No matching credentials' : 'Your vault is ready'}
                                            </p>
                                            <p className="text-muted-foreground mt-1 text-sm">
                                                {search.trim() ? 'Try another search term.' : 'Add a credential to see recent items here.'}
                                            </p>
                                            {!search.trim() && (
                                                <Button asChild variant="link" className="mt-2 text-[#205295]">
                                                    <Link href="/vault?create=1">Add your first credential</Link>
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="divide-y">
                                            {visibleCredentials.map((credential) => (
                                                <article key={credential.id} className="flex min-w-0 items-center gap-3 py-4 first:pt-0 last:pb-0">
                                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#205295]">
                                                        <KeyRound className="size-5" aria-hidden="true" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h2 className="truncate font-medium text-[#0A2647]">{credential.title}</h2>
                                                        <p className="text-muted-foreground truncate text-sm">
                                                            {credential.username || credential.website_url || 'No username provided'}
                                                        </p>
                                                        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                                                            {credential.folder?.name && <Badge variant="secondary">{credential.folder.name}</Badge>}
                                                            <span className="inline-flex items-center gap-1">
                                                                <Clock3 className="size-3" aria-hidden="true" />
                                                                {formatUpdatedAt(credential.updated_at)}
                                                            </span>
                                                        </p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={
                                                            credential.is_favorite
                                                                ? `Remove ${credential.title} from favorites`
                                                                : `Add ${credential.title} to favorites`
                                                        }
                                                        disabled={favoriteSaving === credential.id}
                                                        onClick={() => void toggleFavorite(credential)}
                                                        className={credential.is_favorite ? 'text-amber-600' : 'text-muted-foreground'}
                                                    >
                                                        <Star className={credential.is_favorite ? 'fill-current' : ''} />
                                                    </Button>
                                                </article>
                                            ))}
                                        </div>
                                    )}
                                    {search.trim() && (
                                        <p className="text-muted-foreground text-xs">
                                            Showing up to 5 search matches. Open the vault for full results.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>

                            <div className="space-y-6">
                                <PasswordGenerator />
                                <Card id="dashboard-folders" className="border-slate-200 shadow-sm">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle className="text-base text-[#0A2647]">Folders</CardTitle>
                                        <Button asChild variant="link" size="sm" className="text-[#205295]">
                                            <Link href="/vault?folder=all">View in vault</Link>
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {loading ? (
                                            <Skeleton className="h-20 w-full" />
                                        ) : folders.length === 0 ? (
                                            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                                                No folders yet. Create one from your vault.
                                            </p>
                                        ) : (
                                            folders.slice(0, 5).map((folder) => (
                                                <Link
                                                    key={folder.id}
                                                    href={`/vault?folder=${folder.id}`}
                                                    className="hover:bg-muted focus-visible:ring-ring flex items-center justify-between rounded-lg px-3 py-2 text-sm focus-visible:ring-2"
                                                >
                                                    <span className="flex min-w-0 items-center gap-2 truncate">
                                                        <FolderClosed className="size-4 shrink-0 text-[#205295]" aria-hidden="true" />
                                                        <span className="truncate">{folder.name}</span>
                                                    </span>
                                                    <span className="text-muted-foreground ml-3">{folder.credentials_count}</span>
                                                </Link>
                                            ))
                                        )}
                                        {!loading && unfiledTotal > 0 && (
                                            <Link
                                                href="/vault?folder=unfiled"
                                                className="hover:bg-muted flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                                            >
                                                <span>Unfiled</span>
                                                <span className="text-muted-foreground">{unfiledTotal}</span>
                                            </Link>
                                        )}
                                        {folders.length > 5 && (
                                            <p className="text-muted-foreground pt-1 text-xs">Showing 5 of {folders.length} folders.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </section>
                    </>
                )}
            </main>
        </AppLayout>
    );
}

function OverviewCard({
    title,
    value,
    icon: Icon,
    href,
    detail,
}: {
    title: string;
    value: number | null;
    icon: LucideIcon;
    href: string;
    detail: string;
}) {
    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
                <Icon className="size-5 text-[#205295]" aria-hidden="true" />
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-semibold text-[#0A2647]">{value === null ? <span className="sr-only">Loading</span> : value}</p>
                <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
                <Link href={href} className="mt-3 inline-block text-xs font-medium text-[#205295] underline-offset-4 hover:underline">
                    View
                </Link>
            </CardContent>
        </Card>
    );
}
