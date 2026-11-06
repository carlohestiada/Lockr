import PageContainer from '@/components/layout/page-container';
import VaultShell from '@/components/layout/vault-shell';
import { api, ApiError } from '@/lib/api';
import { type SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    Copy,
    ExternalLink,
    Eye,
    EyeOff,
    FolderClosed,
    FolderInput,
    Grid2X2,
    KeyRound,
    List,
    LockKeyhole,
    LogOut,
    MoreHorizontal,
    Search,
    Shield,
    ShieldCheck,
    Star,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
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
    created_at?: string;
    updated_at: string;
};

type EditableCredential = Omit<Credential, 'updated_at'> & { notes: string | null };

type CredentialPage = {
    data: Credential[];
    current_page: number;
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
};

type SortOrder = 'updated' | 'title' | 'folder';
type VaultView = 'table' | 'grid';

type CredentialForm = {
    title: string;
    username: string;
    password: string;
    website_url: string;
    notes: string;
    folder_id: string;
    is_favorite: boolean;
};

const emptyForm: CredentialForm = {
    title: '',
    username: '',
    password: '',
    website_url: '',
    notes: '',
    folder_id: '',
    is_favorite: false,
};

function initials(value: string): string {
    return (
        value
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('') || '?'
    );
}

function relativeDate(value: string): string {
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return 'Recently';
    const elapsed = Math.max(0, Date.now() - time);
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(time);
}

function safeWebsiteUrl(value: string | null): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
        return null;
    }
}

export default function VaultIndex() {
    const page = usePage<SharedData>();
    const { auth } = page.props;
    const initialQuery = new URLSearchParams(page.url.split('?')[1] ?? '');
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [search, setSearch] = useState(initialQuery.get('q') ?? '');
    const [folderFilter, setFolderFilter] = useState(initialQuery.get('folder') ?? 'all');
    const [favoritesOnly, setFavoritesOnly] = useState(initialQuery.get('favorites') === '1');
    const [sortOrder, setSortOrder] = useState<SortOrder>(
        initialQuery.get('sort') === 'title' || initialQuery.get('sort') === 'folder' ? (initialQuery.get('sort') as SortOrder) : 'updated',
    );
    const [currentPage, setCurrentPage] = useState(Math.max(1, Number(initialQuery.get('page')) || 1));
    const [lastPage, setLastPage] = useState(1);
    const [vaultCredentialCount, setVaultCredentialCount] = useState(0);
    const [totalCredentials, setTotalCredentials] = useState(0);
    const [favoriteCount, setFavoriteCount] = useState(0);
    const [view, setView] = useState<VaultView>('table');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [bulkFolderId, setBulkFolderId] = useState('');
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
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    const [autoLockMinutes, setAutoLockMinutes] = useState(15);
    const [autoLockSettingLoaded, setAutoLockSettingLoaded] = useState(false);
    const vaultLockedRef = useRef(true);
    const selectAllRef = useRef<HTMLInputElement>(null);
    const revealTimersRef = useRef<Record<number, number>>({});
    const clipboardTimerRef = useRef<number | undefined>(undefined);
    const clipboardValueRef = useRef<string | undefined>(undefined);
    const filtersRef = useRef({ search, folderFilter, favoritesOnly, sortOrder, currentPage });
    filtersRef.current = { search, folderFilter, favoritesOnly, sortOrder, currentPage };

    useEffect(() => {
        const handlePopState = () => {
            const query = new URLSearchParams(window.location.search);
            setSearch(query.get('q') ?? '');
            setFolderFilter(query.get('folder') ?? 'all');
            setFavoritesOnly(query.get('favorites') === '1');
            setSortOrder(query.get('sort') === 'title' || query.get('sort') === 'folder' ? (query.get('sort') as SortOrder) : 'updated');
            setCurrentPage(Math.max(1, Number(query.get('page')) || 1));
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
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

    const clearCopiedClipboard = useCallback(async () => {
        const copiedValue = clipboardValueRef.current;
        clipboardValueRef.current = undefined;
        if (clipboardTimerRef.current !== undefined) window.clearTimeout(clipboardTimerRef.current);
        clipboardTimerRef.current = undefined;
        if (copiedValue === undefined) return;

        try {
            if ((await navigator.clipboard.readText()) === copiedValue) await navigator.clipboard.writeText('');
        } catch {
            setNotice('Clipboard could not be cleared automatically; clear it manually.');
        }
    }, []);

    const clearSensitiveState = useCallback(() => {
        setCredentials([]);
        setSelectedIds([]);
        setVisiblePasswords({});
        setPasswordLoadingId(null);
        Object.values(revealTimersRef.current).forEach(window.clearTimeout);
        revealTimersRef.current = {};
        void clearCopiedClipboard();
        setFormOpen(false);
        setEditingId(null);
        setForm(emptyForm);
        setUnlockPassword('');
    }, [clearCopiedClipboard]);

    const markVaultLocked = useCallback(() => {
        vaultLockedRef.current = true;
        setVaultLocked(true);
        clearSensitiveState();
    }, [clearSensitiveState]);

    const lockVault = useCallback(async (): Promise<boolean> => {
        markVaultLocked();

        try {
            await api('/api/vault/lock', { method: 'POST', keepalive: true });
            setError('');
            return true;
        } catch (err) {
            if (err instanceof ApiError && err.status === 423) return true;
            setError(err instanceof Error ? err.message : 'Unable to lock the vault.');
            return false;
        }
    }, [markVaultLocked]);

    const loadData = useCallback(async () => {
        if (vaultLockedRef.current) return;

        setLoading(true);
        setError('');

        try {
            const filters = filtersRef.current;
            const query = new URLSearchParams({
                page: String(filters.currentPage),
                per_page: '10',
                sort: filters.sortOrder,
            });
            if (filters.search.trim()) query.set('search', filters.search.trim());
            if (filters.favoritesOnly) query.set('favorite', '1');
            if (filters.folderFilter !== 'all') query.set('folder', filters.folderFilter);
            const [credentialResult, folderResult, favoriteResult, allCredentialsResult] = await Promise.all([
                api<CredentialPage>(`/api/credentials?${query.toString()}`),
                api<Folder[]>('/api/folders'),
                api<CredentialPage>('/api/credentials?favorite=1&per_page=1'),
                api<CredentialPage>('/api/credentials?per_page=1'),
            ]);

            if (!vaultLockedRef.current) {
                setCredentials(credentialResult.data);
                setFolders(folderResult);
                setTotalCredentials(credentialResult.total);
                setCurrentPage(credentialResult.current_page);
                setLastPage(credentialResult.last_page);
                setFavoriteCount(favoriteResult.total);
                setVaultCredentialCount(allCredentialsResult.total);
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
        const onPreferencesUpdated = (event: WindowEventMap['preferences:updated']) => {
            setAutoLockMinutes(event.detail.auto_lock_minutes);
        };

        async function checkVaultStatus() {
            setStatusLoading(true);

            try {
                const status = await api<{ locked: boolean; auto_lock_minutes: number }>('/api/vault/status');
                const preferences = await api<{ data: { auto_lock_minutes: number } }>('/api/preferences');

                if (cancelled) return;

                setAutoLockMinutes(preferences.data.auto_lock_minutes ?? status.auto_lock_minutes);
                setAutoLockSettingLoaded(true);

                if (status.locked) {
                    markVaultLocked();
                } else {
                    vaultLockedRef.current = false;
                    setVaultLocked(false);
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
        window.addEventListener('preferences:updated', onPreferencesUpdated);
        void checkVaultStatus();

        return () => {
            cancelled = true;
            window.removeEventListener('vault:locked', onLocked);
            window.removeEventListener('vault:locking', onLocked);
            window.removeEventListener('preferences:updated', onPreferencesUpdated);
        };
    }, [loadData, markVaultLocked]);

    useEffect(() => {
        if (vaultLocked || statusLoading) return;

        const timeout = window.setTimeout(
            () => {
                const query = new URLSearchParams();
                if (search.trim()) query.set('q', search.trim());
                if (folderFilter !== 'all') query.set('folder', folderFilter);
                if (favoritesOnly) query.set('favorites', '1');
                if (sortOrder !== 'updated') query.set('sort', sortOrder);
                if (currentPage > 1) query.set('page', String(currentPage));
                const queryString = query.toString();
                window.history.replaceState(window.history.state, '', `${window.location.pathname}${queryString ? `?${queryString}` : ''}`);
                void loadData();
            },
            search.trim() ? 300 : 0,
        );

        return () => window.clearTimeout(timeout);
    }, [currentPage, favoritesOnly, folderFilter, loadData, search, sortOrder, statusLoading, vaultLocked]);

    useEffect(() => {
        setSelectedIds([]);
    }, [currentPage, favoritesOnly, folderFilter, search, sortOrder]);

    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = selectedIds.length > 0 && selectedIds.length < credentials.length;
        }
    }, [credentials.length, selectedIds]);

    useEffect(() => {
        const clearOnHidden = () => {
            if (document.visibilityState === 'hidden') clearSensitiveState();
        };
        document.addEventListener('visibilitychange', clearOnHidden);
        return () => document.removeEventListener('visibilitychange', clearOnHidden);
    }, [clearSensitiveState]);

    useEffect(
        () => () => {
            Object.values(revealTimersRef.current).forEach(window.clearTimeout);
            if (clipboardTimerRef.current !== undefined) window.clearTimeout(clipboardTimerRef.current);
            clipboardValueRef.current = undefined;
        },
        [],
    );

    useEffect(() => {
        if (!formOpen) return;
        const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-labelledby="credential-form-title"]');
        const focusable = () =>
            dialog?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        focusable()?.[0]?.focus();

        const handleDialogKeys = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setFormOpen(false);
            }
            if (event.key !== 'Tab') return;
            const nodes = focusable();
            if (!nodes?.length) return;
            if (event.shiftKey && document.activeElement === nodes[0]) {
                event.preventDefault();
                nodes[nodes.length - 1].focus();
            } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
                event.preventDefault();
                nodes[0].focus();
            }
        };
        document.addEventListener('keydown', handleDialogKeys);
        return () => {
            document.removeEventListener('keydown', handleDialogKeys);
            previousFocus?.focus();
        };
    }, [formOpen]);

    const filteredCredentials = useMemo(() => credentials, [credentials]);

    async function unlockVault(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (unlocking || !unlockPassword.trim()) return;

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
            setUnlockPassword('');
            setShowUnlockPassword(false);
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
            const result = await api<{ data: EditableCredential }>(`/api/credentials/${id}/edit`);
            if (vaultLockedRef.current) return;
            const credential = result.data;

            setEditingId(id);
            setForm({
                title: credential.title,
                username: credential.username ?? '',
                password: '',
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
            if (revealTimersRef.current[id] !== undefined) window.clearTimeout(revealTimersRef.current[id]);
            delete revealTimersRef.current[id];
            setVisiblePasswords((current) => {
                const next = { ...current };
                delete next[id];
                return next;
            });
            return;
        }

        setPasswordLoadingId(id);

        try {
            const result = await api<{ password: string }>(`/api/credentials/${id}/reveal`, { method: 'POST' });
            if (vaultLockedRef.current) return;
            setVisiblePasswords((current) => ({
                ...current,
                [id]: result.password ?? '',
            }));
            revealTimersRef.current[id] = window.setTimeout(() => {
                setVisiblePasswords((current) => {
                    const next = { ...current };
                    delete next[id];
                    return next;
                });
                delete revealTimersRef.current[id];
            }, 10_000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to retrieve password.');
        } finally {
            setPasswordLoadingId(null);
        }
    }

    async function copyText(value: string, label: string) {
        try {
            await navigator.clipboard.writeText(value);
            clipboardValueRef.current = value;
            setNotice(`${label} copied to clipboard.`);
            setError('');
            if (clipboardTimerRef.current !== undefined) window.clearTimeout(clipboardTimerRef.current);
            clipboardTimerRef.current = window.setTimeout(async () => {
                try {
                    if (clipboardValueRef.current === value && (await navigator.clipboard.readText()) === value) {
                        await navigator.clipboard.writeText('');
                    }
                } catch {
                    setNotice('Clipboard could not be cleared automatically; clear it manually.');
                } finally {
                    if (clipboardValueRef.current === value) clipboardValueRef.current = undefined;
                }
            }, 30_000);
        } catch {
            setError('Clipboard access failed. Check browser permissions.');
        }
    }

    async function copyCredentialPassword(id: number) {
        setError('');
        try {
            const result = await api<{ password: string }>(`/api/credentials/${id}/reveal`, { method: 'POST' });
            if (!vaultLockedRef.current) await copyText(result.password, 'Password');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to copy the password.');
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
            ...(editingId === null || form.password ? { password: form.password } : {}),
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

    async function performBulkAction(action: 'move' | 'favorite' | 'delete') {
        if (selectedIds.length === 0) return;
        if (action === 'move' && !bulkFolderId) {
            setError('Choose a destination folder before moving credentials.');
            return;
        }
        if (action === 'delete' && !window.confirm(`Permanently delete ${selectedIds.length} selected credentials?`)) return;

        setError('');
        setNotice('');
        try {
            await api('/api/credentials/bulk', {
                method: 'POST',
                body: JSON.stringify({
                    action,
                    ids: selectedIds,
                    ...(action === 'move' ? { folder_id: bulkFolderId === 'unfiled' ? null : Number(bulkFolderId) } : {}),
                }),
            });
            setSelectedIds([]);
            setBulkFolderId('');
            setNotice(
                action === 'delete'
                    ? 'Selected credentials deleted.'
                    : action === 'favorite'
                      ? 'Selected credentials added to favorites.'
                      : 'Selected credentials moved.',
            );
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to apply the bulk action.');
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
            <div className="lockr-login-background lockr-login-font relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10 text-[#0A2647] sm:px-6">
                <Head title={vaultLocked ? 'Unlock vault' : 'Checking vault'} />
                <div aria-hidden="true" className="lockr-vault-orbit lockr-vault-orbit-outer" />
                <div aria-hidden="true" className="lockr-vault-orbit lockr-vault-orbit-inner" />
                <div aria-hidden="true" className="lockr-vault-grid pointer-events-none absolute inset-0" />

                <main className="relative z-10 flex w-full max-w-[30rem] flex-col items-center">
                    <section className="w-full rounded-[1.75rem] border border-[#0A2647]/[0.08] bg-white/95 px-5 py-7 shadow-[0_24px_80px_-36px_rgba(10,38,71,0.3)] backdrop-blur-sm sm:px-9 sm:py-9">
                        <header className="mb-7 flex flex-col items-center text-center">
                            <Link
                                href={route('vault.index')}
                                className="mb-6 flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-4"
                            >
                                <span className="lockr-vault-logo-glow relative flex size-11 items-center justify-center rounded-xl bg-[#0A2647] text-white">
                                    <Shield className="size-7" strokeWidth={2} aria-hidden="true" />
                                    <LockKeyhole className="absolute top-[15px] left-[15px] size-[11px]" strokeWidth={2.2} aria-hidden="true" />
                                </span>
                                <span className="text-left">
                                    <span className="block text-xl leading-5 font-bold tracking-tight text-[#0A2647]">Lockr</span>
                                    <span className="mt-1 block text-[9px] font-medium tracking-[0.13em] text-slate-500 uppercase">
                                        Institutional Vault Engine
                                    </span>
                                </span>
                            </Link>

                            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#205295]/15 bg-[#205295]/[0.06] px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-[#205295] uppercase">
                                <ShieldCheck className="size-3.5" aria-hidden="true" />
                                Session protected
                            </span>
                            <div className="relative mb-4">
                                <span aria-hidden="true" className="absolute -inset-2 rounded-[1.25rem] bg-[#2C74B3]/10 blur-md" />
                                <span className="relative flex size-14 items-center justify-center rounded-2xl bg-[#0A2647] text-white shadow-lg shadow-[#0A2647]/15">
                                    {statusLoading ? (
                                        <ShieldCheck className="size-7" aria-hidden="true" />
                                    ) : (
                                        <LockKeyhole className="size-7" aria-hidden="true" />
                                    )}
                                </span>
                            </div>
                            {statusLoading ? (
                                <>
                                    <h1 className="text-2xl font-semibold tracking-tight text-[#0A2647]">Checking your vault</h1>
                                    <p className="mt-2 text-sm leading-6 text-slate-500">Confirming your secure session…</p>
                                </>
                            ) : (
                                <>
                                    <h1 className="text-2xl font-semibold tracking-tight text-[#0A2647]">Your Vault is Locked</h1>
                                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                                        Your vault is currently locked. Enter your Master Password to securely unlock your stored credentials.
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
                                    <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-3">
                                        <div
                                            aria-hidden="true"
                                            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#144272] text-sm font-semibold text-white"
                                        >
                                            {auth.user.name
                                                .trim()
                                                .split(/\s+/)
                                                .slice(0, 2)
                                                .map((part) => part.charAt(0).toUpperCase())
                                                .join('') || <UserRound className="size-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-[#0A2647]">{auth.user.name}</p>
                                            <p className="truncate text-xs text-slate-500">{auth.user.email}</p>
                                        </div>
                                        <span className="ml-auto rounded-full bg-[#205295]/[0.08] px-2.5 py-1 text-[10px] font-medium text-[#144272]">
                                            Account
                                        </span>
                                    </div>
                                )}

                                {autoLockSettingLoaded && (
                                    <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#2C74B3]/15 bg-[#2C74B3]/[0.04] px-3.5 py-3">
                                        <LockKeyhole className="mt-0.5 size-4 shrink-0 text-[#2C74B3]" aria-hidden="true" />
                                        <p className="text-xs leading-5 text-slate-600">
                                            {autoLockMinutes > 0
                                                ? `Your vault automatically locks after ${autoLockMinutes} ${autoLockMinutes === 1 ? 'minute' : 'minutes'} of inactivity.`
                                                : 'Automatic inactivity locking is disabled. You can still lock your vault manually.'}
                                        </p>
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

                                <form
                                    onSubmit={unlockVault}
                                    className="space-y-5"
                                    onKeyDown={(event) => {
                                        if (event.target instanceof HTMLInputElement && event.target.id === 'vault-password') {
                                            setCapsLockOn(event.getModifierState('CapsLock'));
                                        }
                                    }}
                                    onKeyUp={(event) => {
                                        if (event.target instanceof HTMLInputElement && event.target.id === 'vault-password') {
                                            setCapsLockOn(event.getModifierState('CapsLock'));
                                        }
                                    }}
                                >
                                    <div>
                                        <div className="mb-2 flex items-center justify-between">
                                            <label htmlFor="vault-password" className="block text-sm font-semibold text-[#0A2647]">
                                                Master Password
                                            </label>
                                            <span className="font-mono text-[10px] tracking-wide text-slate-400">ACCOUNT CREDENTIAL</span>
                                        </div>
                                        <div className="relative">
                                            <KeyRound
                                                aria-hidden="true"
                                                className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[#2C74B3]"
                                            />
                                            <input
                                                id="vault-password"
                                                type={showUnlockPassword ? 'text' : 'password'}
                                                autoComplete="current-password"
                                                autoFocus
                                                required
                                                value={unlockPassword}
                                                onChange={(event) => setUnlockPassword(event.target.value)}
                                                onBlur={() => setCapsLockOn(false)}
                                                aria-invalid={Boolean(error)}
                                                aria-describedby={
                                                    [error ? 'vault-unlock-error' : '', capsLockOn ? 'vault-caps-lock' : '']
                                                        .filter(Boolean)
                                                        .join(' ') || undefined
                                                }
                                                disabled={unlocking}
                                                className="h-[50px] w-full rounded-xl border border-slate-200 bg-[#EFF4FF] py-2.5 pr-12 pl-11 text-sm text-[#0A2647] transition-colors outline-none placeholder:text-slate-400 focus:border-[#2C74B3] focus:ring-4 focus:ring-[#2C74B3]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowUnlockPassword((visible) => !visible)}
                                                aria-label={showUnlockPassword ? 'Hide Master Password' : 'Show Master Password'}
                                                aria-pressed={showUnlockPassword}
                                                disabled={unlocking}
                                                className="absolute top-1/2 right-2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-white hover:text-[#144272] focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-1 disabled:opacity-50"
                                            >
                                                {showUnlockPassword ? (
                                                    <EyeOff aria-hidden="true" className="size-[18px]" />
                                                ) : (
                                                    <Eye aria-hidden="true" className="size-[18px]" />
                                                )}
                                            </button>
                                        </div>
                                        {capsLockOn && (
                                            <p id="vault-caps-lock" role="status" className="mt-2 text-xs font-medium text-amber-700">
                                                Caps Lock is on
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={unlocking || !unlockPassword.trim()}
                                        className="inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#003A78] px-4 text-sm font-semibold text-white shadow-md shadow-[#003A78]/15 transition-colors outline-none hover:bg-[#205295] focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {unlocking ? (
                                            <>
                                                <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
                                                Verifying and unlocking…
                                            </>
                                        ) : (
                                            <>
                                                <LockKeyhole aria-hidden="true" className="size-[18px]" />
                                                Unlock Vault
                                            </>
                                        )}
                                    </button>
                                </form>

                                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center">
                                    <p className="text-xs font-medium text-slate-700">Passkey / Touch ID unlock</p>
                                    <p className="mt-1 text-[11px] text-slate-500">Not available yet</p>
                                </div>

                                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
                                    <Link
                                        href={route('password.request')}
                                        className="rounded-sm font-medium text-[#205295] outline-none hover:text-[#003A78] hover:underline focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-2"
                                    >
                                        Forgot Master Password?
                                    </Link>
                                    <Link
                                        href={route('logout')}
                                        method="post"
                                        as="button"
                                        onClick={clearSensitiveState}
                                        className="rounded-sm font-medium text-slate-500 outline-none hover:text-[#144272] focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-2"
                                    >
                                        Switch account
                                    </Link>
                                    <Link
                                        href={route('logout')}
                                        method="post"
                                        as="button"
                                        onClick={clearSensitiveState}
                                        className="inline-flex items-center gap-1.5 rounded-sm font-medium text-slate-500 outline-none hover:text-[#144272] focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-2"
                                    >
                                        <LogOut aria-hidden="true" className="size-4" />
                                        Log out completely
                                    </Link>
                                </div>

                                <aside className="mt-6 flex gap-3 rounded-xl border border-[#2C74B3]/15 bg-[#2C74B3]/[0.04] p-4">
                                    <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#2C74B3]" />
                                    <p className="text-xs leading-5 text-slate-600">
                                        Unlocking is verified by the server using your account password. Saved credential passwords and notes are
                                        encrypted at rest with the application key; this is not client-side encryption.
                                    </p>
                                </aside>
                            </>
                        )}
                    </section>
                    <p className="mt-5 text-center text-xs text-slate-500">Private access to your personal vault</p>
                </main>
            </div>
        );
    }

    return (
        <VaultShell
            title="My Vault"
            headerSearch={{
                value: search,
                onChange: (value) => {
                    setSearch(value);
                    setCurrentPage(1);
                },
            }}
            counts={loading ? undefined : { credentials: vaultCredentialCount, folders: folders.length, favorites: favoriteCount }}
            autoLockMinutes={autoLockSettingLoaded ? autoLockMinutes : null}
            autoLockActive={!vaultLocked && !statusLoading}
            onLock={lockVault}
            onNewCredential={openCreateForm}
        >
            <PageContainer className="flex flex-col gap-5 pb-24">
                <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lockr-navy text-2xl font-semibold tracking-tight sm:text-3xl">My Vault</h1>
                            <span className="bg-lockr-input text-lockr-navy-active rounded-full px-2.5 py-1 font-mono text-xs">
                                {totalCredentials} {totalCredentials === 1 ? 'credential' : 'credentials'}
                            </span>
                            <span className="border-lockr-success/20 inline-flex items-center gap-1.5 rounded-full border bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-800">
                                <ShieldCheck className="size-3.5" aria-hidden="true" />
                                Vault unlocked
                            </span>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-500">Manage your saved accounts and credentials.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={createFolder}
                            className="hover:bg-lockr-subtle min-h-11 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700"
                        >
                            <FolderClosed className="mr-1.5 inline size-4" />
                            Create Folder
                        </button>
                    </div>
                </section>

                <section className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs text-slate-500">Credentials in this view</p>
                        <p className="mt-1 font-mono text-2xl font-semibold">{loading ? '—' : totalCredentials}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs text-slate-500">Starred favorites</p>
                        <p className="mt-1 font-mono text-2xl font-semibold">{loading ? '—' : favoriteCount}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs text-slate-500">Password health report</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">Not available</p>
                        <p className="mt-1 text-xs text-slate-500">Passwords are not analyzed for reuse or breaches.</p>
                    </div>
                </section>

                {error && (
                    <div
                        role="alert"
                        className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                    >
                        <span>{error}</span>
                        <button type="button" aria-label="Dismiss error" onClick={() => setError('')} className="rounded p-1 hover:bg-red-100">
                            <X className="size-4" />
                        </button>
                    </div>
                )}
                {notice && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                    >
                        <span>{notice}</span>
                        <button
                            type="button"
                            aria-label="Dismiss notification"
                            onClick={() => setNotice('')}
                            className="rounded p-1 hover:bg-emerald-100"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                )}

                <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
                    <div className="relative min-w-0 flex-1">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <label htmlFor="vault-search" className="sr-only">
                            Search vault items
                        </label>
                        <input
                            id="vault-search"
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search title, username, or website..."
                            className="bg-lockr-subtle focus:ring-lockr-interactive h-11 w-full rounded-lg border-0 pr-3 pl-9 text-sm outline-none focus:ring-2"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor="vault-folder-filter" className="sr-only">
                            Filter by folder
                        </label>
                        <select
                            id="vault-folder-filter"
                            value={folderFilter}
                            onChange={(event) => {
                                setFolderFilter(event.target.value);
                                setCurrentPage(1);
                            }}
                            className="focus:ring-lockr-interactive min-h-11 min-w-32 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2"
                        >
                            <option value="all">All Folders ({folders.length})</option>
                            <option value="unfiled">Unfiled</option>
                            {folders.map((folder) => (
                                <option key={folder.id} value={folder.id}>
                                    {folder.name} ({folder.credentials_count ?? 0})
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            aria-pressed={favoritesOnly}
                            onClick={() => {
                                setFavoritesOnly((value) => !value);
                                setCurrentPage(1);
                            }}
                            className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
                                favoritesOnly
                                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                                    : 'hover:bg-lockr-subtle border-slate-200 bg-white text-slate-600'
                            }`}
                        >
                            <Star className={`size-4 ${favoritesOnly ? 'fill-current' : ''}`} aria-hidden="true" />
                            Favorites
                        </button>
                        <label htmlFor="vault-sort" className="sr-only">
                            Sort credentials
                        </label>
                        <select
                            id="vault-sort"
                            value={sortOrder}
                            onChange={(event) => {
                                setSortOrder(event.target.value as SortOrder);
                                setCurrentPage(1);
                            }}
                            className="focus:ring-lockr-interactive min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2"
                        >
                            <option value="updated">Recently Updated</option>
                            <option value="title">Title A–Z</option>
                            <option value="folder">Folder</option>
                        </select>
                        <div className="hidden rounded-lg border border-slate-200 p-1 md:flex" aria-label="Credential layout">
                            <button
                                type="button"
                                aria-label="Table view"
                                aria-pressed={view === 'table'}
                                onClick={() => setView('table')}
                                className={`rounded p-1.5 ${view === 'table' ? 'bg-lockr-input text-lockr-navy' : 'text-slate-500'}`}
                            >
                                <List className="size-4" />
                            </button>
                            <button
                                type="button"
                                aria-label="Grid view"
                                aria-pressed={view === 'grid'}
                                onClick={() => setView('grid')}
                                className={`rounded p-1.5 ${view === 'grid' ? 'bg-lockr-input text-lockr-navy' : 'text-slate-500'}`}
                            >
                                <Grid2X2 className="size-4" />
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={openCreateForm}
                            className="bg-lockr-interactive hover:bg-lockr-navy-active inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white sm:hidden"
                        >
                            <KeyRound className="size-4" />
                            Add
                        </button>
                    </div>
                </section>

                {(search || folderFilter !== 'all' || favoritesOnly) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-500">Active filters:</span>
                        {search && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch('');
                                    setCurrentPage(1);
                                }}
                                className="bg-lockr-input text-lockr-navy-active rounded-full px-2.5 py-1"
                            >
                                Search: {search} <X className="ml-1 inline size-3" />
                            </button>
                        )}
                        {folderFilter !== 'all' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setFolderFilter('all');
                                    setCurrentPage(1);
                                }}
                                className="bg-lockr-input text-lockr-navy-active rounded-full px-2.5 py-1"
                            >
                                Folder: {folderFilter === 'unfiled' ? 'Unfiled' : folders.find((item) => String(item.id) === folderFilter)?.name}{' '}
                                <X className="ml-1 inline size-3" />
                            </button>
                        )}
                        {favoritesOnly && (
                            <button
                                type="button"
                                onClick={() => {
                                    setFavoritesOnly(false);
                                    setCurrentPage(1);
                                }}
                                className="bg-lockr-input text-lockr-navy-active rounded-full px-2.5 py-1"
                            >
                                Favorites <X className="ml-1 inline size-3" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('');
                                setFolderFilter('all');
                                setFavoritesOnly(false);
                                setCurrentPage(1);
                            }}
                            className="text-lockr-interactive font-semibold hover:underline"
                        >
                            Clear all
                        </button>
                    </div>
                )}

                {selectedIds.length > 0 && (
                    <section
                        className="bg-lockr-navy sticky bottom-2 z-20 flex flex-wrap items-center gap-2 rounded-xl p-3 text-white shadow-xl"
                        aria-live="polite"
                    >
                        <span className="bg-lockr-interactive mr-2 rounded-md px-2 py-1 font-mono text-xs">{selectedIds.length}</span>
                        <span className="mr-auto text-sm font-medium">credentials selected</span>
                        <div className="flex flex-wrap items-center gap-2">
                            <label htmlFor="bulk-folder" className="sr-only">
                                Move selected credentials to folder
                            </label>
                            <select
                                id="bulk-folder"
                                value={bulkFolderId}
                                onChange={(event) => setBulkFolderId(event.target.value)}
                                className="text-lockr-navy min-h-10 max-w-36 rounded-md bg-white px-2 text-xs"
                            >
                                <option value="">Move to folder…</option>
                                <option value="unfiled">Unfiled</option>
                                {folders.map((folder) => (
                                    <option key={folder.id} value={folder.id}>
                                        {folder.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => void performBulkAction('move')}
                                className="bg-lockr-navy-active hover:bg-lockr-interactive inline-flex min-h-10 items-center gap-1 rounded-md px-3 text-xs"
                            >
                                <FolderInput className="size-4" />
                                Move
                            </button>
                            <button
                                type="button"
                                onClick={() => void performBulkAction('favorite')}
                                className="bg-lockr-navy-active hover:bg-lockr-interactive inline-flex min-h-10 items-center gap-1 rounded-md px-3 text-xs"
                            >
                                <Star className="size-4" />
                                Favorite
                            </button>
                            <button
                                type="button"
                                onClick={() => void performBulkAction('delete')}
                                className="inline-flex min-h-10 items-center gap-1 rounded-md bg-red-700 px-3 text-xs hover:bg-red-600"
                            >
                                <Trash2 className="size-4" />
                                Delete
                            </button>
                            <button
                                type="button"
                                aria-label="Clear selection"
                                onClick={() => setSelectedIds([])}
                                className="flex size-10 items-center justify-center rounded-md text-slate-300 hover:bg-white/10"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                    </section>
                )}

                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {loading ? (
                        <div className="space-y-3 p-5" aria-label="Loading credentials" role="status">
                            {[0, 1, 2, 3].map((row) => (
                                <div key={row} className="bg-lockr-subtle h-16 animate-pulse rounded-lg" />
                            ))}
                            <span className="sr-only">Loading your vault</span>
                        </div>
                    ) : filteredCredentials.length === 0 ? (
                        <div className="px-5 py-16 text-center">
                            <span className="bg-lockr-input text-lockr-interactive mx-auto flex size-12 items-center justify-center rounded-2xl">
                                <KeyRound className="size-6" />
                            </span>
                            <h2 className="text-lockr-navy mt-4 font-semibold">
                                {vaultCredentialCount === 0 ? 'Your vault is empty' : 'No matching credentials'}
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {vaultCredentialCount === 0 ? 'Add your first credential to get started.' : 'Try another search or filter.'}
                            </p>
                            {vaultCredentialCount === 0 && (
                                <button
                                    type="button"
                                    onClick={openCreateForm}
                                    className="bg-lockr-primary hover:bg-lockr-interactive mt-4 min-h-10 rounded-lg px-4 text-sm font-semibold text-white"
                                >
                                    Add your first credential
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className={`${view === 'table' ? 'hidden md:block' : 'hidden'} overflow-x-auto`}>
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-lockr-input text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                                        <tr>
                                            <th scope="col" className="w-12 py-3 pl-4 text-center">
                                                <input
                                                    ref={selectAllRef}
                                                    type="checkbox"
                                                    aria-label="Select all credentials on this page"
                                                    checked={credentials.length > 0 && selectedIds.length === credentials.length}
                                                    onChange={(event) =>
                                                        setSelectedIds(event.target.checked ? credentials.map((item) => item.id) : [])
                                                    }
                                                    className="accent-lockr-interactive size-4 rounded"
                                                />
                                            </th>
                                            <th scope="col" className="min-w-56 px-4 py-3">
                                                Title &amp; Website
                                            </th>
                                            <th scope="col" className="min-w-44 px-4 py-3">
                                                Username / Email
                                            </th>
                                            <th scope="col" className="min-w-52 px-4 py-3">
                                                Password
                                            </th>
                                            <th scope="col" className="hidden min-w-32 px-4 py-3 lg:table-cell">
                                                Folder
                                            </th>
                                            <th scope="col" className="w-14 px-3 py-3 text-center">
                                                Fav
                                            </th>
                                            <th scope="col" className="hidden min-w-24 px-4 py-3 xl:table-cell">
                                                Modified
                                            </th>
                                            <th scope="col" className="w-24 px-3 py-3 text-right">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {filteredCredentials.map((credential) => {
                                            const website = safeWebsiteUrl(credential.website_url);
                                            const selected = selectedIds.includes(credential.id);
                                            return (
                                                <tr key={credential.id} className="group hover:bg-lockr-canvas transition-colors">
                                                    <td className="py-3 pl-4 text-center">
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`Select ${credential.title}`}
                                                            checked={selected}
                                                            onChange={(event) =>
                                                                setSelectedIds((ids) =>
                                                                    event.target.checked
                                                                        ? [...ids, credential.id]
                                                                        : ids.filter((id) => id !== credential.id),
                                                                )
                                                            }
                                                            className="accent-lockr-interactive size-4 rounded"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <span className="bg-lockr-navy flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold text-white">
                                                                {initials(credential.title)}
                                                            </span>
                                                            <span className="min-w-0">
                                                                <span className="text-lockr-navy block truncate font-semibold">
                                                                    {credential.title}
                                                                </span>
                                                                {website ? (
                                                                    <a
                                                                        href={website}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="hover:text-lockr-accent inline-flex max-w-full items-center gap-1 truncate text-xs text-slate-500"
                                                                    >
                                                                        {new URL(website).hostname}
                                                                        <ExternalLink className="size-3 shrink-0" />
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-xs text-slate-400">No website</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                                                        <span className="flex max-w-52 items-center justify-between gap-2">
                                                            <span className="truncate">{credential.username || '—'}</span>
                                                            {credential.username && (
                                                                <button
                                                                    type="button"
                                                                    aria-label={`Copy ${credential.title} username`}
                                                                    onClick={() => void copyText(credential.username!, 'Username')}
                                                                    className="hover:bg-lockr-input hover:text-lockr-interactive flex size-9 shrink-0 items-center justify-center rounded text-slate-400"
                                                                >
                                                                    <Copy className="size-4" />
                                                                </button>
                                                            )}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5 font-mono text-xs">
                                                            <span className="max-w-36 truncate text-slate-600">
                                                                {visiblePasswords[credential.id] ?? '••••••••••••••••'}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                aria-label={
                                                                    visiblePasswords[credential.id] !== undefined
                                                                        ? `Hide ${credential.title} password`
                                                                        : `Reveal ${credential.title} password`
                                                                }
                                                                onClick={() => void togglePassword(credential.id)}
                                                                disabled={passwordLoadingId === credential.id}
                                                                className="hover:bg-lockr-input hover:text-lockr-navy flex size-9 items-center justify-center rounded text-slate-400 disabled:opacity-50"
                                                            >
                                                                {passwordLoadingId === credential.id ? (
                                                                    <span className="border-t-lockr-interactive size-4 animate-spin rounded-full border-2 border-slate-300" />
                                                                ) : visiblePasswords[credential.id] !== undefined ? (
                                                                    <EyeOff className="size-4" />
                                                                ) : (
                                                                    <Eye className="size-4" />
                                                                )}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                aria-label={`Copy ${credential.title} password`}
                                                                onClick={() => void copyCredentialPassword(credential.id)}
                                                                className="hover:bg-lockr-input hover:text-lockr-interactive flex size-9 items-center justify-center rounded text-slate-400"
                                                            >
                                                                <KeyRound className="size-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="hidden px-4 py-3 lg:table-cell">
                                                        <span className="bg-lockr-input text-lockr-navy-active rounded-md px-2.5 py-1 text-xs font-medium">
                                                            {credential.folder?.name ?? 'Unfiled'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            aria-label={
                                                                credential.is_favorite
                                                                    ? `Remove ${credential.title} from favorites`
                                                                    : `Add ${credential.title} to favorites`
                                                            }
                                                            aria-pressed={credential.is_favorite}
                                                            onClick={() => void toggleFavorite(credential)}
                                                            className={`flex size-9 items-center justify-center rounded-lg ${credential.is_favorite ? 'text-lockr-warning' : 'hover:text-lockr-warning text-slate-300'}`}
                                                        >
                                                            <Star className={`size-5 ${credential.is_favorite ? 'fill-current' : ''}`} />
                                                        </button>
                                                    </td>
                                                    <td className="hidden px-4 py-3 text-xs text-slate-500 xl:table-cell">
                                                        {relativeDate(credential.updated_at)}
                                                    </td>
                                                    <td className="px-3 py-3 text-right">
                                                        <details className="relative inline-block text-left">
                                                            <summary
                                                                aria-label={`Actions for ${credential.title}`}
                                                                className="hover:bg-lockr-input flex size-9 cursor-pointer list-none items-center justify-center rounded-lg text-slate-500 [&::-webkit-details-marker]:hidden"
                                                            >
                                                                <MoreHorizontal className="size-5" />
                                                            </summary>
                                                            <div className="absolute right-0 z-20 mt-1 min-w-32 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-lg">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void openEditForm(credential.id)}
                                                                    className="hover:bg-lockr-subtle block w-full rounded px-3 py-2 text-xs"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void deleteCredential(credential)}
                                                                    className="block w-full rounded px-3 py-2 text-left text-xs text-red-700 hover:bg-red-50"
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </details>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className={`${view === 'grid' ? 'md:grid md:grid-cols-2 xl:grid-cols-3' : 'md:hidden'} divide-y divide-slate-100`}>
                                {filteredCredentials.map((credential) => {
                                    const website = safeWebsiteUrl(credential.website_url);
                                    return (
                                        <article key={`card-${credential.id}`} className="min-w-0 p-4">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Select ${credential.title}`}
                                                    checked={selectedIds.includes(credential.id)}
                                                    onChange={(event) =>
                                                        setSelectedIds((ids) =>
                                                            event.target.checked ? [...ids, credential.id] : ids.filter((id) => id !== credential.id),
                                                        )
                                                    }
                                                    className="accent-lockr-interactive mt-2 size-5 shrink-0 rounded"
                                                />
                                                <span className="bg-lockr-navy flex size-10 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold text-white">
                                                    {initials(credential.title)}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <h2 className="truncate text-sm font-semibold">{credential.title}</h2>
                                                            {website ? (
                                                                <a
                                                                    href={website}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-slate-500"
                                                                >
                                                                    {new URL(website).hostname}
                                                                    <ExternalLink className="size-3" />
                                                                </a>
                                                            ) : (
                                                                <span className="text-xs text-slate-400">No website</span>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            aria-label={
                                                                credential.is_favorite
                                                                    ? `Remove ${credential.title} from favorites`
                                                                    : `Add ${credential.title} to favorites`
                                                            }
                                                            aria-pressed={credential.is_favorite}
                                                            onClick={() => void toggleFavorite(credential)}
                                                            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${credential.is_favorite ? 'text-lockr-warning' : 'text-slate-300'}`}
                                                        >
                                                            <Star className={`size-5 ${credential.is_favorite ? 'fill-current' : ''}`} />
                                                        </button>
                                                    </div>
                                                    <p className="mt-2 truncate font-mono text-xs text-slate-500">
                                                        {credential.username || 'No username saved'}
                                                    </p>
                                                    <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                                        <span className="bg-lockr-input text-lockr-navy-active rounded px-2 py-1">
                                                            {credential.folder?.name ?? 'Unfiled'}
                                                        </span>
                                                        <span>{relativeDate(credential.updated_at)}</span>
                                                    </p>
                                                    <div className="mt-3 flex min-w-0 items-center gap-2">
                                                        <span className="bg-lockr-subtle min-w-0 flex-1 truncate rounded-lg px-3 py-2 font-mono text-xs">
                                                            {visiblePasswords[credential.id] ?? '••••••••••••••••'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            aria-label={
                                                                visiblePasswords[credential.id] !== undefined
                                                                    ? `Hide ${credential.title} password`
                                                                    : `Reveal ${credential.title} password`
                                                            }
                                                            onClick={() => void togglePassword(credential.id)}
                                                            className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
                                                        >
                                                            {visiblePasswords[credential.id] !== undefined ? (
                                                                <EyeOff className="size-4" />
                                                            ) : (
                                                                <Eye className="size-4" />
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            aria-label={`Copy ${credential.title} password`}
                                                            onClick={() => void copyCredentialPassword(credential.id)}
                                                            className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
                                                        >
                                                            <Copy className="size-4" />
                                                        </button>
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {credential.username && (
                                                            <button
                                                                type="button"
                                                                onClick={() => void copyText(credential.username!, 'Username')}
                                                                className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-medium"
                                                            >
                                                                Copy username
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => void openEditForm(credential.id)}
                                                            className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-medium"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => void deleteCredential(credential)}
                                                            className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-700"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </>
                    )}
                    {!loading && totalCredentials > 0 && (
                        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
                            <span>
                                Showing {credentials.length ? (currentPage - 1) * 10 + 1 : 0}–{Math.min(currentPage * 10, totalCredentials)} of{' '}
                                {totalCredentials}
                            </span>
                            <div className="flex items-center gap-2">
                                <label htmlFor="vault-page-size" className="sr-only">
                                    Rows per page
                                </label>
                                <select
                                    id="vault-page-size"
                                    value={10}
                                    disabled
                                    aria-label="Rows per page"
                                    className="hidden rounded border border-slate-200 bg-white px-2 py-1 sm:block"
                                >
                                    <option value="10">10 / page</option>
                                </select>
                                <button
                                    type="button"
                                    aria-label="Previous page"
                                    disabled={currentPage <= 1}
                                    onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                                    className="flex size-10 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
                                >
                                    <ChevronLeft className="size-4" />
                                </button>
                                <span className="font-mono">
                                    {currentPage} / {lastPage}
                                </span>
                                <button
                                    type="button"
                                    aria-label="Next page"
                                    disabled={currentPage >= lastPage}
                                    onClick={() => setCurrentPage((value) => Math.min(lastPage, value + 1))}
                                    className="flex size-10 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
                                >
                                    <ChevronRight className="size-4" />
                                </button>
                            </div>
                        </footer>
                    )}
                </section>

                <aside className="border-lockr-accent/15 bg-lockr-input/60 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start">
                    <ShieldCheck className="text-lockr-accent mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <div>
                        <h2 className="text-lockr-navy text-sm font-semibold">Vault protection</h2>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                            Credential passwords and notes are encrypted at rest by the Laravel application key. This is server-side encryption, not
                            zero-knowledge or end-to-end encryption. Password health and breach checks are not currently available.
                        </p>
                    </div>
                    <Link href="/settings/security" className="text-lockr-interactive shrink-0 text-xs font-semibold hover:underline sm:ml-auto">
                        Security settings
                    </Link>
                </aside>
            </PageContainer>

            {formOpen && (
                <div
                    className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setFormOpen(false);
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="credential-form-title"
                        className="my-auto max-h-[95svh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-h-[90vh] sm:rounded-2xl sm:p-6"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 id="credential-form-title" className="text-lockr-navy text-lg font-semibold">
                                    {editingId === null ? 'Add credential' : 'Edit credential'}
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">Credential data is encrypted when saved.</p>
                            </div>
                            <button
                                type="button"
                                aria-label="Close dialog"
                                onClick={() => setFormOpen(false)}
                                className="hover:bg-lockr-subtle flex size-10 items-center justify-center rounded-lg text-slate-500"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <form onSubmit={saveCredential} className="mt-5 space-y-4">
                            <div>
                                <label htmlFor="title" className="mb-1.5 block text-sm font-medium">
                                    Title *
                                </label>
                                <input
                                    id="title"
                                    required
                                    maxLength={150}
                                    value={form.title}
                                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                                    className="focus:border-lockr-accent focus:ring-lockr-accent/20 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2"
                                />
                            </div>
                            <div>
                                <label htmlFor="username" className="mb-1.5 block text-sm font-medium">
                                    Username or email
                                </label>
                                <input
                                    id="username"
                                    maxLength={255}
                                    autoComplete="off"
                                    value={form.username}
                                    onChange={(event) => setForm({ ...form, username: event.target.value })}
                                    className="focus:border-lockr-accent focus:ring-lockr-accent/20 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2"
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                                    Password {editingId === null ? '*' : ''}
                                </label>
                                <input
                                    id="password"
                                    required={editingId === null}
                                    maxLength={10000}
                                    autoComplete="new-password"
                                    type="password"
                                    value={form.password}
                                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                                    className="focus:border-lockr-accent focus:ring-lockr-accent/20 h-11 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm outline-none focus:ring-2"
                                />
                                {editingId !== null && <p className="mt-1 text-xs text-slate-500">Leave blank to keep the current password.</p>}
                            </div>
                            <div>
                                <label htmlFor="website_url" className="mb-1.5 block text-sm font-medium">
                                    Website URL
                                </label>
                                <input
                                    id="website_url"
                                    type="url"
                                    maxLength={2048}
                                    placeholder="https://example.com"
                                    value={form.website_url}
                                    onChange={(event) => setForm({ ...form, website_url: event.target.value })}
                                    className="focus:border-lockr-accent focus:ring-lockr-accent/20 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2"
                                />
                            </div>
                            <div>
                                <label htmlFor="folder_id" className="mb-1.5 block text-sm font-medium">
                                    Folder
                                </label>
                                <select
                                    id="folder_id"
                                    value={form.folder_id}
                                    onChange={(event) => setForm({ ...form, folder_id: event.target.value })}
                                    className="focus:ring-lockr-accent/20 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2"
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
                                <label htmlFor="notes" className="mb-1.5 block text-sm font-medium">
                                    Secure note
                                </label>
                                <textarea
                                    id="notes"
                                    rows={3}
                                    maxLength={10000}
                                    value={form.notes}
                                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                                    className="focus:ring-lockr-accent/20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2"
                                />
                            </div>
                            <label className="flex min-h-11 items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.is_favorite}
                                    onChange={(event) => setForm({ ...form, is_favorite: event.target.checked })}
                                    className="accent-lockr-interactive size-4 rounded"
                                />
                                Mark as favorite
                            </label>
                            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setFormOpen(false)}
                                    className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-lockr-primary min-h-11 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    {saving ? 'Saving…' : 'Save credential'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </VaultShell>
    );
}
