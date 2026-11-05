import AppLayout from '@/layouts/app-layout';
import { api } from '@/lib/api';
import type { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Check, LoaderCircle, LockKeyhole, Palette, ShieldCheck } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UserPreferences } from './types';

const SecurityTab = lazy(() => import('./security-tab'));
const AppearanceTab = lazy(() => import('./appearance-tab'));

type SettingsTab = 'security' | 'appearance';
type PreferenceResponse = { data: UserPreferences };

const defaults: UserPreferences = {
    theme: 'system',
    accent_color: '#2563eb',
    font_size: 'medium',
    show_website_icons: true,
    auto_lock_minutes: 15,
};

const tabs: { id: SettingsTab; label: string; icon: typeof LockKeyhole }[] = [
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'appearance', label: 'Appearance', icon: Palette },
];

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Vault Settings', href: '/settings/security' },
    { title: 'Security & Preferences', href: '/settings/security' },
];

function getTab(search: string): SettingsTab {
    return new URLSearchParams(search).get('tab') === 'appearance' ? 'appearance' : 'security';
}

function applyPreferences(preferences: UserPreferences) {
    const root = document.documentElement;
    root.classList.toggle(
        'dark',
        preferences.theme === 'dark' || (preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
    );
    root.style.setProperty('--primary', preferences.accent_color);
    root.style.fontSize = preferences.font_size === 'small' ? '14px' : preferences.font_size === 'large' ? '18px' : '16px';
    localStorage.setItem('appearance', preferences.theme);
    window.dispatchEvent(new CustomEvent<UserPreferences>('preferences:updated', { detail: preferences }));
}

export default function SecurityPreferences() {
    const page = usePage();
    const [tab, setTab] = useState<SettingsTab>(() => getTab(page.url.split('?')[1] ? `?${page.url.split('?')[1]}` : ''));
    const [savedPreferences, setSavedPreferences] = useState<UserPreferences>(defaults);
    const [draft, setDraft] = useState<UserPreferences>(defaults);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const tabRefs = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({});
    const isDirty = useMemo(() => JSON.stringify(savedPreferences) !== JSON.stringify(draft), [draft, savedPreferences]);

    useEffect(() => {
        let cancelled = false;

        api<PreferenceResponse>('/api/preferences')
            .then(({ data }) => {
                if (cancelled) return;
                setSavedPreferences(data);
                setDraft(data);
                applyPreferences(data);
            })
            .catch((reason: unknown) => {
                if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load preferences.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const handlePopState = () => setTab(getTab(window.location.search));
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        if (!isDirty) return;
        const beforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        window.addEventListener('beforeunload', beforeUnload);
        const removeInertiaGuard = router.on('before', () =>
            window.confirm('You have unsaved preferences. Leave this page and discard your changes?'),
        );
        return () => {
            window.removeEventListener('beforeunload', beforeUnload);
            removeInertiaGuard();
        };
    }, [isDirty]);

    const selectTab = useCallback((nextTab: SettingsTab) => {
        setTab(nextTab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', nextTab);
        window.history.pushState(window.history.state, '', url);
    }, []);

    function handleTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        const currentIndex = tabs.findIndex((item) => item.id === tab);
        let nextIndex = currentIndex;
        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else return;

        event.preventDefault();
        const nextTab = tabs[nextIndex].id;
        selectTab(nextTab);
        tabRefs.current[nextTab]?.focus();
    }

    function updateDraft(field: keyof UserPreferences, value: UserPreferences[keyof UserPreferences]) {
        setDraft((current) => ({ ...current, [field]: value }));
        setNotice('');
    }

    function discardChanges() {
        setDraft(savedPreferences);
        applyPreferences(savedPreferences);
        setError('');
        setNotice('');
    }

    async function savePreferences() {
        if (!isDirty || saving) return;

        setSaving(true);
        setError('');
        setNotice('');
        try {
            const result = await api<PreferenceResponse>('/api/preferences', {
                method: 'PUT',
                body: JSON.stringify(draft),
            });
            setSavedPreferences(result.data);
            setDraft(result.data);
            applyPreferences(result.data);
            setNotice('Preferences saved and applied.');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to save preferences.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Security & Preferences" />
            <div className="min-h-full bg-[#F8FAFC] px-4 py-6 pb-24 sm:px-6 lg:px-8 dark:bg-slate-950">
                <main className="mx-auto max-w-6xl">
                    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                                Lockr Vault / Vault Settings
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <h1 className="text-2xl font-bold tracking-tight text-[#0A2647] sm:text-3xl dark:text-slate-100">
                                    Security &amp; Preferences
                                </h1>
                                <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 text-[11px] font-semibold text-[#205295]">
                                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                                    Server-side encrypted
                                </span>
                            </div>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                                Manage your vault lock timeout and the way Lockr looks on this device.
                            </p>
                        </div>
                        <div className="hidden items-center gap-2 sm:flex">
                            <button
                                type="button"
                                disabled={!isDirty || saving || loading}
                                onClick={discardChanges}
                                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C74B3] disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Discard Changes
                            </button>
                            <button
                                type="button"
                                disabled={!isDirty || saving || loading}
                                onClick={() => void savePreferences()}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#205295] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0A2647] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C74B3] disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                {saving ? (
                                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <Check className="size-4" aria-hidden="true" />
                                )}
                                {saving ? 'Saving…' : 'Save Preferences'}
                            </button>
                        </div>
                    </header>

                    <div className="mt-6 border-b border-slate-200 dark:border-slate-800">
                        <div
                            role="tablist"
                            aria-label="Settings categories"
                            onKeyDown={handleTabKeyDown}
                            className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                            {tabs.map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    ref={(element) => {
                                        tabRefs.current[id] = element;
                                    }}
                                    id={`settings-tab-${id}`}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === id}
                                    aria-controls={`settings-panel-${id}`}
                                    tabIndex={tab === id ? 0 : -1}
                                    onClick={() => selectTab(id)}
                                    className={`flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-t-lg border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2C74B3] ${
                                        tab === id
                                            ? 'border-[#205295] bg-white text-[#0A2647] dark:bg-slate-900 dark:text-slate-100'
                                            : 'border-transparent text-slate-500 hover:bg-white/70 hover:text-[#0A2647] dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                                    }`}
                                >
                                    <Icon className="size-4" aria-hidden="true" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <section
                        id={`settings-panel-${tab}`}
                        role="tabpanel"
                        aria-labelledby={`settings-tab-${tab}`}
                        tabIndex={0}
                        className="mt-5 outline-none"
                    >
                        {error && (
                            <p
                                role="alert"
                                className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                            >
                                {error}
                            </p>
                        )}
                        {notice && (
                            <p
                                role="status"
                                aria-live="polite"
                                className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                            >
                                {notice}
                            </p>
                        )}
                        {loading ? (
                            <div className="grid gap-5 lg:grid-cols-2" role="status" aria-label="Loading preferences">
                                <div className="h-72 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none dark:bg-slate-800" />
                                <div className="h-72 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none dark:bg-slate-800" />
                            </div>
                        ) : (
                            <Suspense
                                fallback={
                                    <div
                                        className="h-72 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none dark:bg-slate-800"
                                        role="status"
                                    >
                                        Loading settings…
                                    </div>
                                }
                            >
                                {tab === 'security' ? (
                                    <SecurityTab value={draft} onChange={updateDraft} />
                                ) : (
                                    <AppearanceTab value={draft} onChange={updateDraft} />
                                )}
                            </Suspense>
                        )}
                    </section>
                </main>
                {isDirty && (
                    <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_-20px_rgba(10,38,71,0.5)] backdrop-blur sm:hidden dark:border-slate-800 dark:bg-slate-950/95">
                        <button
                            type="button"
                            disabled={saving || loading}
                            onClick={discardChanges}
                            className="min-h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 disabled:opacity-45 dark:border-slate-700 dark:text-slate-200"
                        >
                            Discard
                        </button>
                        <button
                            type="button"
                            disabled={saving || loading}
                            onClick={() => void savePreferences()}
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#205295] px-3 text-sm font-semibold text-white disabled:opacity-45"
                        >
                            {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
                            {saving ? 'Saving…' : 'Save Preferences'}
                        </button>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
