import PageContainer from '@/components/layout/page-container';
import PageHeader from '@/components/layout/page-header';
import VaultShell from '@/components/layout/vault-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { Link } from '@inertiajs/react';
import { ArrowRight, CalendarDays, FolderClosed, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Folder = {
    id: number;
    name: string;
    credentials_count: number;
    created_at: string;
    updated_at: string;
};

type VaultStatus = {
    locked: boolean;
    auto_lock_minutes: number;
};

function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Date unavailable'
        : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export default function FolderManagement() {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [autoLockMinutes, setAutoLockMinutes] = useState<number | null>(null);
    const [vaultUnlocked, setVaultUnlocked] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [folderName, setFolderName] = useState('');
    const [formError, setFormError] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<Folder | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const loadFolders = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await api<Folder[]>('/api/folders');
            setFolders(result);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to load your folders.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        Promise.all([api<Folder[]>('/api/folders'), api<VaultStatus>('/api/vault/status')])
            .then(([folderResult, status]) => {
                if (cancelled) return;
                setFolders(folderResult);
                setAutoLockMinutes(status.auto_lock_minutes);
                setVaultUnlocked(!status.locked);
            })
            .catch((reason: unknown) => {
                if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load folder information.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        const handleLocked = () => setVaultUnlocked(false);
        window.addEventListener('vault:locked', handleLocked);
        return () => {
            cancelled = true;
            window.removeEventListener('vault:locked', handleLocked);
        };
    }, []);

    const organizedCredentials = useMemo(() => folders.reduce((total, folder) => total + folder.credentials_count, 0), [folders]);

    function openCreateDialog() {
        setEditingFolder(null);
        setFolderName('');
        setFormError('');
        setNotice('');
        setDialogOpen(true);
    }

    function openEditDialog(folder: Folder) {
        setEditingFolder(folder);
        setFolderName(folder.name);
        setFormError('');
        setNotice('');
        setDialogOpen(true);
    }

    async function saveFolder(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const name = folderName.trim();
        if (!name) {
            setFormError('Enter a folder name.');
            return;
        }

        setSaving(true);
        setFormError('');
        try {
            if (editingFolder) {
                await api(`/api/folders/${editingFolder.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name }),
                });
                setNotice(`“${name}” was updated.`);
            } else {
                await api('/api/folders', {
                    method: 'POST',
                    body: JSON.stringify({ name }),
                });
                setNotice(`“${name}” was created.`);
            }
            setDialogOpen(false);
            await loadFolders();
        } catch (reason) {
            setFormError(reason instanceof Error ? reason.message : 'Unable to save this folder.');
        } finally {
            setSaving(false);
        }
    }

    async function deleteFolder() {
        if (!deleteTarget) return;

        setDeleting(true);
        setError('');
        try {
            await api(`/api/folders/${deleteTarget.id}`, { method: 'DELETE' });
            setNotice(`“${deleteTarget.name}” was deleted. Its credentials are now unfiled.`);
            setDeleteTarget(null);
            await loadFolders();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to delete this folder.');
        } finally {
            setDeleting(false);
        }
    }

    return (
        <VaultShell
            title="Folders"
            counts={loading ? undefined : { folders: folders.length }}
            autoLockMinutes={autoLockMinutes}
            autoLockActive={vaultUnlocked}
        >
            <PageContainer className="space-y-6">
                <PageHeader
                    title="Folders"
                    description="Organize your credentials into secure, manageable collections."
                    actions={
                        <Button
                            type="button"
                            onClick={openCreateDialog}
                            className="bg-lockr-interactive hover:bg-lockr-navy-active min-h-11 rounded-lg px-4 text-white"
                        >
                            <Plus aria-hidden="true" />
                            Create Folder
                        </Button>
                    }
                />

                {error && (
                    <div
                        role="alert"
                        className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                        <span>{error}</span>
                        <button type="button" className="font-semibold underline" onClick={() => void loadFolders()}>
                            Retry
                        </button>
                    </div>
                )}
                {notice && (
                    <p
                        role="status"
                        aria-live="polite"
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                    >
                        {notice}
                    </p>
                )}

                <section aria-label="Folder overview" className="grid gap-4 sm:grid-cols-2">
                    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(10,38,71,0.5)]">
                        <p className="text-sm font-medium text-slate-500">Total folders</p>
                        <p className="text-lockr-navy mt-2 font-mono text-3xl font-bold">{loading ? '—' : folders.length}</p>
                        <p className="mt-1 text-xs text-slate-500">Collections in your vault</p>
                    </article>
                    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(10,38,71,0.5)]">
                        <p className="text-sm font-medium text-slate-500">Credentials organized</p>
                        <p className="text-lockr-navy mt-2 font-mono text-3xl font-bold">{loading ? '—' : organizedCredentials}</p>
                        <p className="mt-1 text-xs text-slate-500">Credentials assigned to a folder</p>
                    </article>
                </section>

                <section aria-labelledby="folder-list-heading" className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 id="folder-list-heading" className="text-lockr-navy text-lg font-semibold">
                            Your folders
                        </h2>
                        {!loading && <span className="text-xs text-slate-500">{folders.length} total</span>}
                    </div>

                    {loading ? (
                        <div role="status" aria-label="Loading folders" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {Array.from({ length: 3 }, (_, index) => (
                                <div key={index} className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
                            ))}
                        </div>
                    ) : folders.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                            <span className="bg-lockr-input mx-auto flex size-12 items-center justify-center rounded-xl">
                                <FolderClosed className="text-lockr-interactive size-6" aria-hidden="true" />
                            </span>
                            <p className="text-lockr-navy mt-4 font-semibold">
                                No folders yet. Create your first folder to organize your credentials.
                            </p>
                            <Button
                                type="button"
                                onClick={openCreateDialog}
                                className="bg-lockr-interactive hover:bg-lockr-navy-active mt-5 min-h-10 rounded-lg text-white"
                            >
                                <Plus aria-hidden="true" />
                                Create Folder
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {folders.map((folder) => (
                                <article
                                    key={folder.id}
                                    className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(10,38,71,0.5)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                                >
                                    <header className="flex items-start justify-between gap-3">
                                        <span className="bg-lockr-input flex size-11 shrink-0 items-center justify-center rounded-xl">
                                            <FolderClosed className="text-lockr-interactive size-5" aria-hidden="true" />
                                        </span>
                                        <details className="relative">
                                            <summary
                                                aria-label={`More actions for ${folder.name}`}
                                                className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
                                            >
                                                <MoreHorizontal className="size-5" aria-hidden="true" />
                                            </summary>
                                            <div className="absolute top-10 right-0 z-10 min-w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditDialog(folder)}
                                                    className="hover:bg-lockr-input w-full rounded-md px-3 py-2 text-left text-sm text-slate-700"
                                                >
                                                    Rename
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteTarget(folder)}
                                                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="size-4" aria-hidden="true" />
                                                    Delete
                                                </button>
                                            </div>
                                        </details>
                                    </header>

                                    <h3 className="text-lockr-navy mt-4 truncate text-lg font-semibold" title={folder.name}>
                                        {folder.name}
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {folder.credentials_count} {folder.credentials_count === 1 ? 'credential' : 'credentials'}
                                    </p>
                                    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                                        <CalendarDays className="size-3.5" aria-hidden="true" />
                                        Created {formatDate(folder.created_at)}
                                    </p>
                                    <Link
                                        href={`/vault?folder=${folder.id}`}
                                        className="text-lockr-interactive focus-visible:ring-lockr-accent mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold outline-none hover:underline focus-visible:ring-2"
                                    >
                                        Open Folder
                                        <ArrowRight className="size-4" aria-hidden="true" />
                                    </Link>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <p className="text-xs leading-5 text-slate-500">
                    Deleting a folder keeps its credentials in your vault and moves them to Unfiled.{' '}
                    <Link href="/vault?folder=unfiled" className="text-lockr-interactive font-medium hover:underline">
                        View unfiled credentials
                    </Link>
                </p>
            </PageContainer>

            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) setFormError('');
                }}
            >
                <DialogContent className="max-w-md rounded-2xl border-slate-200 bg-white p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lockr-navy">{editingFolder ? 'Rename folder' : 'Create folder'}</DialogTitle>
                        <DialogDescription>
                            {editingFolder
                                ? 'Update the folder name. Credentials inside will remain assigned to it.'
                                : 'Create a folder to organize credentials in your vault.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(event) => void saveFolder(event)} className="space-y-5">
                        <div className="grid gap-2">
                            <Label htmlFor="folder-name">Folder name</Label>
                            <Input
                                id="folder-name"
                                name="name"
                                value={folderName}
                                onChange={(event) => setFolderName(event.target.value)}
                                maxLength={100}
                                required
                                autoFocus
                                placeholder="e.g. Personal"
                                aria-invalid={Boolean(formError)}
                                className="min-h-11 rounded-lg border-slate-200"
                            />
                            {formError && (
                                <p role="alert" className="text-sm text-red-700">
                                    {formError}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={saving} className="bg-lockr-interactive hover:bg-lockr-navy-active min-h-10 text-white">
                                {saving ? 'Saving…' : editingFolder ? 'Save changes' : 'Create Folder'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
                <DialogContent className="max-w-md rounded-2xl border-slate-200 bg-white p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lockr-navy">Delete {deleteTarget?.name}?</DialogTitle>
                        <DialogDescription>
                            This removes the folder only. Its credentials will remain in your vault and become unfiled.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                            Cancel
                        </Button>
                        <Button type="button" variant="destructive" disabled={deleting} onClick={() => void deleteFolder()}>
                            {deleting ? 'Deleting…' : 'Delete Folder'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </VaultShell>
    );
}
