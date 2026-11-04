import HeadingSmall from '@/components/heading-small';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { api } from '@/lib/api';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';

const timeoutChoices = [0, 1, 5, 10, 15, 30, 60];

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Security settings', href: '/settings/security' }];

export default function SecuritySettings() {
    const [autoLockMinutes, setAutoLockMinutes] = useState(15);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api<{ data: { auto_lock_minutes: number } }>('/api/preferences')
            .then(({ data }) => {
                if (!cancelled) setAutoLockMinutes(data.auto_lock_minutes);
            })
            .catch((reason: unknown) => {
                if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load security settings.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    async function saveSecuritySettings(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSaved(false);
        try {
            await api('/api/preferences', {
                method: 'PUT',
                body: JSON.stringify({ auto_lock_minutes: autoLockMinutes }),
            });
            setSaved(true);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to save security settings.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Security settings" />
            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall title="Security settings" description="Choose when your vault locks after inactivity." />
                    {loading ? (
                        <p className="text-muted-foreground text-sm">Loading security settings…</p>
                    ) : (
                        <form onSubmit={saveSecuritySettings} className="space-y-4">
                            {error && (
                                <p role="alert" className="border-destructive/40 text-destructive rounded-lg border p-3 text-sm">
                                    {error}
                                </p>
                            )}
                            {saved && (
                                <p role="status" className="text-muted-foreground text-sm">
                                    Security settings saved.
                                </p>
                            )}
                            <div className="grid gap-2">
                                <label htmlFor="auto-lock-minutes" className="text-sm font-medium">
                                    Automatically lock after
                                </label>
                                <select
                                    id="auto-lock-minutes"
                                    value={autoLockMinutes}
                                    onChange={(event) => setAutoLockMinutes(Number(event.target.value))}
                                    className="bg-background w-full rounded-lg border px-3 py-2 text-sm sm:max-w-xs"
                                >
                                    {timeoutChoices.map((minutes) => (
                                        <option key={minutes} value={minutes}>
                                            {minutes === 0 ? 'Never (manual lock only)' : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-muted-foreground text-sm">
                                    A zero-minute timeout disables inactivity locking only. You can still lock the vault manually, and it locks when
                                    you first open it.
                                </p>
                            </div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                            >
                                {saving ? 'Saving…' : 'Save security settings'}
                            </button>
                        </form>
                    )}
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
