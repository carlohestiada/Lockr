import { api } from '@/lib/api';
import { useEffect, useState } from 'react';

type AppearancePreferences = {
    accent_color: string;
    font_size: 'small' | 'medium' | 'large';
    show_website_icons: boolean;
};

const defaults: AppearancePreferences = {
    accent_color: '#2563eb',
    font_size: 'medium',
    show_website_icons: true,
};

export default function AppearancePreferencesForm() {
    const [preferences, setPreferences] = useState(defaults);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        let cancelled = false;

        api<{ data: AppearancePreferences }>('/api/preferences')
            .then(({ data }) => {
                if (cancelled) return;
                setPreferences({
                    accent_color: data.accent_color,
                    font_size: data.font_size,
                    show_website_icons: data.show_website_icons,
                });
                document.documentElement.style.setProperty('--primary', data.accent_color);
                document.documentElement.style.fontSize = data.font_size === 'small' ? '14px' : data.font_size === 'large' ? '18px' : '16px';
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

    async function savePreferences(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSaved(false);

        try {
            const result = await api<{ data: AppearancePreferences }>('/api/preferences', {
                method: 'PUT',
                body: JSON.stringify(preferences),
            });
            setPreferences({
                accent_color: result.data.accent_color,
                font_size: result.data.font_size,
                show_website_icons: result.data.show_website_icons,
            });
            document.documentElement.style.setProperty('--primary', result.data.accent_color);
            document.documentElement.style.fontSize =
                result.data.font_size === 'small' ? '14px' : result.data.font_size === 'large' ? '18px' : '16px';
            setSaved(true);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to save preferences.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <p className="text-muted-foreground text-sm">Loading appearance preferences…</p>;
    }

    return (
        <form onSubmit={savePreferences} className="space-y-5">
            {error && (
                <p role="alert" className="border-destructive/40 text-destructive rounded-lg border p-3 text-sm">
                    {error}
                </p>
            )}
            {saved && (
                <p role="status" className="text-muted-foreground text-sm">
                    Appearance preferences saved.
                </p>
            )}

            <div className="grid gap-2">
                <label htmlFor="accent-color" className="text-sm font-medium">
                    Accent color
                </label>
                <div className="flex items-center gap-3">
                    <input
                        id="accent-color"
                        type="color"
                        value={preferences.accent_color}
                        onChange={(event) => setPreferences({ ...preferences, accent_color: event.target.value })}
                        className="bg-background h-10 w-14 cursor-pointer rounded border p-1"
                    />
                    <span className="text-muted-foreground text-sm">{preferences.accent_color}</span>
                </div>
            </div>

            <div className="grid gap-2">
                <label htmlFor="font-size" className="text-sm font-medium">
                    Text size
                </label>
                <select
                    id="font-size"
                    value={preferences.font_size}
                    onChange={(event) => setPreferences({ ...preferences, font_size: event.target.value as AppearancePreferences['font_size'] })}
                    className="bg-background w-full rounded-lg border px-3 py-2 text-sm sm:max-w-xs"
                >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                </select>
            </div>

            <label className="flex items-center gap-3 text-sm">
                <input
                    type="checkbox"
                    checked={preferences.show_website_icons}
                    onChange={(event) => setPreferences({ ...preferences, show_website_icons: event.target.checked })}
                    className="h-4 w-4 rounded border"
                />
                Show website icons when available
            </label>

            <button
                type="submit"
                disabled={saving}
                className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
                {saving ? 'Saving…' : 'Save appearance'}
            </button>
        </form>
    );
}
