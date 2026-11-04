import AppLayout from '@/layouts/app-layout';
import { api, ApiError } from '@/lib/api';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Eye, EyeOff, Globe2, KeyRound, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Folder = {
    id: number;
    name: string;
    credentials_count?: number;
};

type Credential = {
    id: number;
    title: string;
    username: string | null;
    website_url: string | null;
    folder_id: number | null;
    folder?: Folder | null;
    is_favorite: boolean;
    password?: string;
    notes?: string | null;
};

type CredentialForm = {
    title: string;
    username: string;
    password: string;
    website_url: string;
    notes: string;
    folder_id: string;
    is_favorite: boolean;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'My Vault', href: '/vault' }];

const emptyForm: CredentialForm = {
    title: '',
    username: '',
    password: '',
    website_url: '',
    notes: '',
    folder_id: '',
    is_favorite: false,
};

export default function VaultIndex() {
    const page = usePage<SharedData>();
    const { auth } = page.props;
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [search, setSearch] = useState('');
    const [folderFilter, setFolderFilter] = useState('all');
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<CredentialForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [visiblePasswords, setVisiblePasswords] = useState<Record<number, string>>({});
    const [passwordLoadingId, setPasswordLoadingId] = useState<number | null>(null);
    const [vaultLocked, setVaultLocked] = useState(true);
    const [statusLoading, setStatusLoading] = useState(true);
    const [unlockPassword, setUnlockPassword] = useState('');
    const [showUnlockPassword, setShowUnlockPassword] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    const [autoLockMinutes, setAutoLockMinutes] = useState(15);
    const [showWebsiteIcons, setShowWebsiteIcons] = useState(true);
    const vaultLockedRef = useRef(true);
    const lastActivityRef = useRef(Date.now());
    const lastHeartbeatRef = useRef(0);

    useEffect(() => {
        const query = new URLSearchParams(page.url.split('?')[1] ?? '');
        setFolderFilter(query.get('folder') ?? 'all');
        setFavoritesOnly(query.get('favorites') === '1');
    }, [page.url]);

    useEffect(() => {
        if (vaultLocked) return;

        const query = new URLSearchParams(window.location.search);
        if (query.get('create') !== '1') return;

        setEditingId(null);
        setForm(emptyForm);
        setError('');
        setNotice('');
        setFormOpen(true);
        window.history.replaceState(window.history.state, '', '/vault');
    }, [vaultLocked]);

    const clearSensitiveState = useCallback(() => {
        setCredentials([]);
        setVisiblePasswords({});
        setPasswordLoadingId(null);
        setFormOpen(false);
        setEditingId(null);
        setForm(emptyForm);
        setUnlockPassword('');
    }, []);

    const markVaultLocked = useCallback(() => {
        vaultLockedRef.current = true;
        setVaultLocked(true);
        clearSensitiveState();
    }, [clearSensitiveState]);

    const lockVault = useCallback(async () => {
        markVaultLocked();

        try {
            await api('/api/vault/lock', { method: 'POST', keepalive: true });
            setError('');
        } catch (err) {
            if (!(err instanceof ApiError && err.status === 423)) {
                setError(err instanceof Error ? err.message : 'Unable to lock the vault.');
            }
        }
    }, [markVaultLocked]);

    const loadData = useCallback(async () => {
        if (vaultLockedRef.current) return;

        setLoading(true);
        setError('');

        try {
            const [credentialResult, folderResult] = await Promise.all([
                api<{ data: Credential[] }>('/api/credentials'),
                api<Folder[]>('/api/folders'),
            ]);

            if (!vaultLockedRef.current) {
                setCredentials(credentialResult.data);
                setFolders(folderResult);
            }
        } catch (err) {
            if (!(err instanceof ApiError && err.status === 423)) {
                setError(err instanceof Error ? err.message : 'Unable to load your vault.');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const onLocked = () => markVaultLocked();

        async function checkVaultStatus() {
            setStatusLoading(true);

            try {
                const status = await api<{ locked: boolean; auto_lock_minutes: number }>('/api/vault/status');
                const preferences = await api<{
                    data: { auto_lock_minutes: number; show_website_icons: boolean };
                }>('/api/preferences');

                if (cancelled) return;

                setAutoLockMinutes(preferences.data.auto_lock_minutes ?? status.auto_lock_minutes);
                setShowWebsiteIcons(preferences.data.show_website_icons);

                if (status.locked) {
                    markVaultLocked();
                } else {
                    vaultLockedRef.current = false;
                    setVaultLocked(false);
                    await loadData();
                }
            } catch (err) {
                if (!cancelled && !(err instanceof ApiError && err.status === 423)) {
                    setError(err instanceof Error ? err.message : 'Unable to check vault status.');
                }
            } finally {
                if (!cancelled) setStatusLoading(false);
            }
        }

        window.addEventListener('vault:locked', onLocked);
        window.addEventListener('vault:locking', onLocked);
        void checkVaultStatus();

        return () => {
            cancelled = true;
            window.removeEventListener('vault:locked', onLocked);
            window.removeEventListener('vault:locking', onLocked);
        };
    }, [loadData, markVaultLocked]);

    useEffect(() => {
        const lockOrClearWhenHidden = () => {
            if (document.visibilityState !== 'hidden') return;

            if (vaultLockedRef.current) {
                clearSensitiveState();
            } else {
                void lockVault();
            }
        };

        document.addEventListener('visibilitychange', lockOrClearWhenHidden);
        return () => document.removeEventListener('visibilitychange', lockOrClearWhenHidden);
    }, [clearSensitiveState, lockVault]);

    useEffect(() => {
        if (vaultLocked) return;

        const timeoutMs = autoLockMinutes * 60_000;
        let inactivityTimer: number | undefined;

        const resetInactivityTimer = () => {
            lastActivityRef.current = Date.now();
            if (autoLockMinutes > 0) {
                window.clearTimeout(inactivityTimer);
                inactivityTimer = window.setTimeout(() => void lockVault(), timeoutMs);
            }
        };

        const activityEvents: (keyof WindowEventMap)[] = ['keydown', 'mousedown', 'pointerdown', 'scroll', 'touchstart'];

        activityEvents.forEach((eventName) => {
            window.addEventListener(eventName, resetInactivityTimer, { passive: true });
        });
        if (autoLockMinutes > 0) resetInactivityTimer();

        const heartbeat =
            autoLockMinutes > 0
                ? window.setInterval(() => {
                      const now = Date.now();
                      if (now - lastActivityRef.current >= 30_000 || now - lastHeartbeatRef.current < 30_000) return;

                      lastHeartbeatRef.current = now;
                      void api<{ locked: boolean }>('/api/vault/status')
                          .then((status) => {
                              if (status.locked) markVaultLocked();
                          })
                          .catch((err: unknown) => {
                              if (!(err instanceof ApiError && err.status === 423)) {
                                  setError(err instanceof Error ? err.message : 'Unable to refresh vault status.');
                              }
                          });
                  }, 15_000)
                : undefined;

        return () => {
            if (inactivityTimer !== undefined) window.clearTimeout(inactivityTimer);
            if (heartbeat !== undefined) window.clearInterval(heartbeat);
            activityEvents.forEach((eventName) => {
                window.removeEventListener(eventName, resetInactivityTimer);
            });
        };
    }, [autoLockMinutes, lockVault, markVaultLocked, vaultLocked]);

    const filteredCredentials = useMemo(() => {
        const term = search.trim().toLowerCase();

        return credentials.filter((credential) => {
            const matchesSearch =
                !term ||
                credential.title.toLowerCase().includes(term) ||
                (credential.username ?? '').toLowerCase().includes(term) ||
                (credential.website_url ?? '').toLowerCase().includes(term);

            const matchesFolder =
                folderFilter === 'all' ||
                (folderFilter === 'unfiled' ? credential.folder_id === null : credential.folder_id === Number(folderFilter));

            return matchesSearch && matchesFolder && (!favoritesOnly || credential.is_favorite);
        });
    }, [credentials, search, folderFilter, favoritesOnly]);

    async function unlockVault(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setUnlocking(true);
        setError('');

        try {
            await api('/api/vault/unlock', {
                method: 'POST',
                body: JSON.stringify({ password: unlockPassword }),
            });
            vaultLockedRef.current = false;
            setVaultLocked(false);
            setUnlockPassword('');
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to unlock the vault.');
        } finally {
            setUnlocking(false);
        }
    }

    function openCreateForm() {
        setEditingId(null);
        setForm(emptyForm);
        setError('');
        setNotice('');
        setFormOpen(true);
    }

    async function openEditForm(id: number) {
        setError('');
        setNotice('');

        try {
            const result = await api<{ data: Credential }>(`/api/credentials/${id}`);
            if (vaultLockedRef.current) return;
            const credential = result.data;

            setEditingId(id);
            setForm({
                title: credential.title,
                username: credential.username ?? '',
                password: credential.password ?? '',
                website_url: credential.website_url ?? '',
                notes: credential.notes ?? '',
                folder_id: credential.folder_id === null ? '' : String(credential.folder_id),
                is_favorite: credential.is_favorite,
            });
            setFormOpen(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to open credential.');
        }
    }

    async function togglePassword(id: number) {
        if (visiblePasswords[id] !== undefined) {
            setVisiblePasswords((current) => {
                const next = { ...current };
                delete next[id];
                return next;
            });
            return;
        }

        setPasswordLoadingId(id);

        try {
            const result = await api<{ data: Credential }>(`/api/credentials/${id}`);
            if (vaultLockedRef.current) return;
            setVisiblePasswords((current) => ({
                ...current,
                [id]: result.data.password ?? '',
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to retrieve password.');
        } finally {
            setPasswordLoadingId(null);
        }
    }

    async function copyText(value: string, label: string) {
        try {
            await navigator.clipboard.writeText(value);
            setNotice(`${label} copied to clipboard.`);
            setError('');
        } catch {
            setError('Clipboard access failed. Check browser permissions.');
        }
    }

    async function saveCredential(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setError('');
        setNotice('');

        const payload = {
            title: form.title.trim(),
            username: form.username || null,
            password: form.password,
            website_url: form.website_url || null,
            notes: form.notes || null,
            folder_id: form.folder_id ? Number(form.folder_id) : null,
            is_favorite: form.is_favorite,
        };

        try {
            if (editingId !== null) {
                await api(`/api/credentials/${editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
                setNotice('Credential updated.');
            } else {
                await api('/api/credentials', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                setNotice('Credential added.');
            }

            setFormOpen(false);
            setForm(emptyForm);
            setVisiblePasswords({});
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to save credential.');
        } finally {
            setSaving(false);
        }
    }

    async function createFolder() {
        const input = window.prompt('Enter a folder name:');

        if (input === null) {
            return;
        }

        const name = input.trim();

        if (!name) {
            setError('Folder name cannot be empty.');
            return;
        }

        setError('');
        setNotice('');

        try {
            await api('/api/folders', {
                method: 'POST',
                body: JSON.stringify({ name }),
            });

            await loadData();
            setNotice(`Folder "${name}" created successfully.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to create folder.');
        }
    }

    async function toggleFavorite(credential: Credential) {
        setError('');
        setNotice('');

        try {
            await api(`/api/credentials/${credential.id}`, {
                method: 'PUT',
                body: JSON.stringify({ is_favorite: !credential.is_favorite }),
            });
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to update favorite.');
        }
    }

    async function deleteCredential(credential: Credential) {
        if (!window.confirm(`Delete "${credential.title}"? This cannot be undone.`)) {
            return;
        }

        setError('');
        setNotice('');

        try {
            await api(`/api/credentials/${credential.id}`, { method: 'DELETE' });
            setVisiblePasswords((current) => {
                const next = { ...current };
                delete next[credential.id];
                return next;
            });
            setNotice('Credential deleted.');
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to delete credential.');
        }
    }

    if (statusLoading || vaultLocked) {
        return (
            <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8FAFC] px-4 py-10 text-[#0A2647] sm:px-6">
                <Head title={vaultLocked ? 'Unlock vault' : 'Checking vault'} />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                        backgroundImage:
                            'radial-gradient(circle, rgba(44, 116, 179, 0.14) 1px, transparent 1.5px), radial-gradient(circle, transparent 58%, rgba(44, 116, 179, 0.06) 58.2%, transparent 58.6%), radial-gradient(circle, transparent 72%, rgba(44, 116, 179, 0.05) 72.2%, transparent 72.6%)',
                        backgroundPosition: 'center, center, center',
                        backgroundSize: '28px 28px, min(100vw, 900px) min(100vw, 900px), min(100vw, 1120px) min(100vw, 1120px)',
                        maskImage: 'linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)',
                    }}
                />
                <main className="relative z-10 flex w-full max-w-[30rem] flex-col items-center">
                    <section className="w-full rounded-[1.75rem] border border-[#0A2647]/[0.08] bg-white px-6 py-8 shadow-[0_24px_80px_-36px_rgba(10,38,71,0.28)] sm:px-10 sm:py-10">
                        <header className="mb-8 flex flex-col items-center text-center">
                            <img src="/logo.svg" alt="Lockr" className="mb-7 h-auto w-32" />
                            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0A2647] text-white shadow-lg shadow-[#0A2647]/15">
                                {statusLoading ? (
                                    <ShieldCheck aria-hidden="true" className="h-7 w-7" />
                                ) : (
                                    <LockKeyhole aria-hidden="true" className="h-7 w-7" />
                                )}
                            </div>
                            {statusLoading ? (
                                <>
                                    <h1 className="text-2xl font-semibold tracking-tight text-[#0A2647]">Checking your vault</h1>
                                    <p className="mt-2 text-sm leading-6 text-slate-500">Confirming your secure session…</p>
                                </>
                            ) : (
                                <>
                                    <h1 className="text-2xl font-semibold tracking-tight text-[#0A2647]">Your vault is locked</h1>
                                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                                        Enter your account password to unlock your saved credentials.
                                    </p>
                                </>
                            )}
                        </header>

                        {statusLoading ? (
                            <div role="status" className="flex justify-center py-3">
                                <span className="sr-only">Checking vault status</span>
                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#2C74B3]/25 border-t-[#205295] motion-reduce:animate-none" />
                            </div>
                        ) : (
                            <>
                                {auth.user && (
                                    <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                                        <div
                                            aria-hidden="true"
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#144272] text-sm font-semibold text-white"
                                        >
                                            {auth.user.name
                                                .trim()
                                                .split(/\s+/)
                                                .slice(0, 2)
                                                .map((part) => part.charAt(0).toUpperCase())
                                                .join('')}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-[#0A2647]">{auth.user.name}</p>
                                            <p className="truncate text-xs text-slate-500">{auth.user.email}</p>
                                        </div>
                                        <span className="ml-auto rounded-full bg-[#205295]/[0.08] px-2.5 py-1 text-[0.6875rem] font-medium text-[#144272]">
                                            Account
                                        </span>
                                    </div>
                                )}

                                {error && (
                                    <div
                                        id="vault-unlock-error"
                                        role="alert"
                                        className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800"
                                    >
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={unlockVault} className="space-y-5">
                                    <div>
                                        <label htmlFor="vault-password" className="mb-2 block text-sm font-semibold text-[#0A2647]">
                                            Account password
                                        </label>
                                        <div className="relative">
                                            <KeyRound
                                                aria-hidden="true"
                                                className="pointer-events-none absolute top-1/2 left-3.5 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-[#2C74B3]"
                                            />
                                            <input
                                                id="vault-password"
                                                type={showUnlockPassword ? 'text' : 'password'}
                                                autoComplete="current-password"
                                                autoFocus
                                                required
                                                value={unlockPassword}
                                                onChange={(event) => setUnlockPassword(event.target.value)}
                                                aria-invalid={Boolean(error)}
                                                aria-describedby={error ? 'vault-unlock-error' : undefined}
                                                disabled={unlocking}
                                                className="h-12 w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-12 pl-11 text-sm text-[#0A2647] transition-colors outline-none placeholder:text-slate-400 focus:border-[#2C74B3] focus:ring-4 focus:ring-[#2C74B3]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowUnlockPassword((visible) => !visible)}
                                                aria-label={showUnlockPassword ? 'Hide password' : 'Show password'}
                                                aria-pressed={showUnlockPassword}
                                                className="absolute top-1/2 right-2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-slate-100 hover:text-[#144272] focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-1"
                                            >
                                                {showUnlockPassword ? (
                                                    <EyeOff aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
                                                ) : (
                                                    <Eye aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={unlocking || !unlockPassword}
                                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#205295] px-4 text-sm font-semibold text-white shadow-md shadow-[#205295]/15 transition-colors outline-none hover:bg-[#144272] focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {unlocking ? (
                                            <>
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
                                                Unlocking…
                                            </>
                                        ) : (
                                            <>
                                                <LockKeyhole aria-hidden="true" className="h-4 w-4" />
                                                Unlock vault
                                            </>
                                        )}
                                    </button>
                                </form>

                                <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
                                    <Link
                                        href={route('password.request')}
                                        className="rounded-sm font-medium text-[#2C74B3] outline-none hover:text-[#144272] hover:underline focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-2"
                                    >
                                        Forgot password?
                                    </Link>
                                    <Link
                                        href={route('logout')}
                                        method="post"
                                        as="button"
                                        onClick={clearSensitiveState}
                                        className="inline-flex items-center gap-1.5 rounded-sm font-medium text-slate-500 outline-none hover:text-[#144272] focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-2"
                                    >
                                        <LogOut aria-hidden="true" className="h-4 w-4" />
                                        Log out completely
                                    </Link>
                                </div>

                                <aside className="mt-7 flex gap-3 rounded-xl border border-[#2C74B3]/15 bg-[#2C74B3]/[0.04] p-4">
                                    <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#2C74B3]" />
                                    <p className="text-xs leading-5 text-slate-600">
                                        Vault access is checked by the server. Saved credential passwords and notes are encrypted at rest.
                                    </p>
                                </aside>
                            </>
                        )}
                    </section>
                    <p className="mt-6 text-center text-xs text-slate-500">Private access to your personal vault</p>
                </main>
            </div>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="My Vault" />

            <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">My Vault</h1>
                        <p className="text-muted-foreground mt-1 text-sm">Manage your saved accounts and credentials.</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={createFolder} className="rounded-lg border px-4 py-2.5 text-sm font-medium">
                            + Create folder
                        </button>
                        <button
                            type="button"
                            onClick={openCreateForm}
                            className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90"
                        >
                            + Add credential
                        </button>
                        <button
                            type="button"
                            onClick={() => void lockVault()}
                            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium"
                        >
                            <LockKeyhole className="h-4 w-4" />
                            Lock vault
                        </button>
                    </div>
                </header>

                <section className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border p-4">
                        <p className="text-muted-foreground text-sm">Credentials loaded</p>
                        <p className="mt-1 text-2xl font-semibold">{credentials.length}</p>
                    </div>
                    <div className="rounded-xl border p-4">
                        <p className="text-muted-foreground text-sm">Favorites</p>
                        <p className="mt-1 text-2xl font-semibold">{credentials.filter((item) => item.is_favorite).length}</p>
                    </div>
                    <div className="rounded-xl border p-4">
                        <p className="text-muted-foreground text-sm">Folders</p>
                        <p className="mt-1 text-2xl font-semibold">{folders.length}</p>
                    </div>
                </section>

                {error && (
                    <div role="alert" className="border-destructive/40 bg-destructive/5 rounded-lg border p-3 text-sm">
                        {error}
                    </div>
                )}

                {notice && (
                    <div role="status" className="rounded-lg border p-3 text-sm">
                        {notice}
                    </div>
                )}

                <section className="flex flex-col gap-3 sm:flex-row">
                    <input
                        aria-label="Search credentials"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search title, username, or website..."
                        className="bg-background min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
                    />

                    <select
                        aria-label="Filter by folder"
                        value={folderFilter}
                        onChange={(event) => setFolderFilter(event.target.value)}
                        className="bg-background rounded-lg border px-3 py-2 text-sm"
                    >
                        <option value="all">All folders</option>
                        <option value="unfiled">Unfiled</option>
                        {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                                {folder.name}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        aria-pressed={favoritesOnly}
                        onClick={() => setFavoritesOnly((value) => !value)}
                        className={`rounded-lg border px-3 py-2 text-sm ${favoritesOnly ? 'bg-accent font-medium' : ''}`}
                    >
                        {favoritesOnly ? '★ Favorites only' : '☆ Show favorites'}
                    </button>
                </section>

                <section className="overflow-hidden rounded-xl border">
                    {loading ? (
                        <p className="text-muted-foreground p-8 text-center text-sm">Loading your vault…</p>
                    ) : filteredCredentials.length === 0 ? (
                        <div className="p-10 text-center">
                            <h2 className="font-medium">{credentials.length === 0 ? 'Your vault is empty' : 'No matching credentials'}</h2>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {credentials.length === 0 ? 'Add your first credential to get started.' : 'Try a different search or filter.'}
                            </p>
                            {credentials.length === 0 && (
                                <button
                                    type="button"
                                    onClick={openCreateForm}
                                    className="bg-primary text-primary-foreground mt-4 rounded-lg px-4 py-2 text-sm"
                                >
                                    Add your first credential
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filteredCredentials.map((credential) => (
                                <article key={credential.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="font-medium">{credential.title}</h2>
                                            {credential.is_favorite && (
                                                <span className="text-amber-500" aria-label="Favorite">
                                                    ★
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-muted-foreground mt-1 text-sm break-all">{credential.username || 'No username saved'}</p>

                                        <p className="text-muted-foreground mt-1 text-xs">
                                            {credential.folder?.name ?? 'Unfiled'}
                                            {credential.website_url && (
                                                <span className="ml-2 inline-flex items-center gap-1">
                                                    {showWebsiteIcons && <Globe2 className="h-3 w-3" aria-hidden="true" />}
                                                    {credential.website_url}
                                                </span>
                                            )}
                                        </p>

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <span className="bg-muted rounded-md px-2 py-1 font-mono text-sm">
                                                {visiblePasswords[credential.id] !== undefined
                                                    ? visiblePasswords[credential.id] || '(empty password)'
                                                    : '••••••••••'}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={() => void togglePassword(credential.id)}
                                                disabled={passwordLoadingId === credential.id}
                                                className="text-xs underline disabled:opacity-50"
                                            >
                                                {passwordLoadingId === credential.id
                                                    ? 'Loading…'
                                                    : visiblePasswords[credential.id] !== undefined
                                                      ? 'Hide password'
                                                      : 'Show password'}
                                            </button>

                                            {visiblePasswords[credential.id] !== undefined && (
                                                <button
                                                    type="button"
                                                    onClick={() => void copyText(visiblePasswords[credential.id], 'Password')}
                                                    className="text-xs underline"
                                                >
                                                    Copy password
                                                </button>
                                            )}
                                            {credential.username && (
                                                <button
                                                    type="button"
                                                    onClick={() => void copyText(credential.username!, 'Username')}
                                                    className="text-xs underline"
                                                >
                                                    Copy username
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void toggleFavorite(credential)}
                                            aria-label={credential.is_favorite ? 'Remove favorite' : 'Add favorite'}
                                            className="rounded-md border px-3 py-2 text-sm"
                                        >
                                            {credential.is_favorite ? '★' : '☆'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void openEditForm(credential.id)}
                                            className="rounded-md border px-3 py-2 text-sm"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void deleteCredential(credential)}
                                            className="border-destructive/40 text-destructive rounded-md border px-3 py-2 text-sm"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                {formOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
                        role="presentation"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) setFormOpen(false);
                        }}
                    >
                        <section
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="credential-form-title"
                            className="bg-background my-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl p-5 shadow-xl"
                        >
                            <h2 id="credential-form-title" className="text-lg font-semibold">
                                {editingId === null ? 'Add credential' : 'Edit credential'}
                            </h2>

                            <form onSubmit={saveCredential} className="mt-4 space-y-4">
                                <div>
                                    <label htmlFor="title" className="mb-1 block text-sm font-medium">
                                        Title *
                                    </label>
                                    <input
                                        id="title"
                                        required
                                        maxLength={150}
                                        value={form.title}
                                        onChange={(event) => setForm({ ...form, title: event.target.value })}
                                        className="bg-background w-full rounded-lg border px-3 py-2 text-sm"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="username" className="mb-1 block text-sm font-medium">
                                        Username or email
                                    </label>
                                    <input
                                        id="username"
                                        maxLength={255}
                                        autoComplete="off"
                                        value={form.username}
                                        onChange={(event) => setForm({ ...form, username: event.target.value })}
                                        className="bg-background w-full rounded-lg border px-3 py-2 text-sm"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="password" className="mb-1 block text-sm font-medium">
                                        Password *
                                    </label>
                                    <input
                                        id="password"
                                        required
                                        maxLength={10000}
                                        autoComplete="new-password"
                                        type="password"
                                        value={form.password}
                                        onChange={(event) => setForm({ ...form, password: event.target.value })}
                                        className="bg-background w-full rounded-lg border px-3 py-2 text-sm"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="website_url" className="mb-1 block text-sm font-medium">
                                        Website URL
                                    </label>
                                    <input
                                        id="website_url"
                                        type="url"
                                        maxLength={2048}
                                        placeholder="https://example.com"
                                        value={form.website_url}
                                        onChange={(event) => setForm({ ...form, website_url: event.target.value })}
                                        className="bg-background w-full rounded-lg border px-3 py-2 text-sm"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="folder_id" className="mb-1 block text-sm font-medium">
                                        Folder
                                    </label>
                                    <select
                                        id="folder_id"
                                        value={form.folder_id}
                                        onChange={(event) => setForm({ ...form, folder_id: event.target.value })}
                                        className="bg-background w-full rounded-lg border px-3 py-2 text-sm"
                                    >
                                        <option value="">Unfiled</option>
                                        {folders.map((folder) => (
                                            <option key={folder.id} value={folder.id}>
                                                {folder.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="notes" className="mb-1 block text-sm font-medium">
                                        Notes
                                    </label>
                                    <textarea
                                        id="notes"
                                        rows={3}
                                        maxLength={10000}
                                        value={form.notes}
                                        onChange={(event) => setForm({ ...form, notes: event.target.value })}
                                        className="bg-background w-full rounded-lg border px-3 py-2 text-sm"
                                    />
                                </div>

                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={form.is_favorite}
                                        onChange={(event) => setForm({ ...form, is_favorite: event.target.checked })}
                                    />
                                    Mark as favorite
                                </label>

                                <div className="flex justify-end gap-2 border-t pt-4">
                                    <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border px-4 py-2 text-sm">
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                                    >
                                        {saving ? 'Saving…' : 'Save credential'}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                )}
            </main>
        </AppLayout>
    );
}
