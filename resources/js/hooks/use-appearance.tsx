import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

export type Appearance = 'light' | 'dark' | 'system';

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

const applyTheme = (appearance: Appearance) => {
    const isDark = appearance === 'dark' || (appearance === 'system' && prefersDark());

    document.documentElement.classList.toggle('dark', isDark);
};

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

const handleSystemThemeChange = () => {
    const currentAppearance = localStorage.getItem('appearance') as Appearance;
    applyTheme(currentAppearance || 'system');
};

export function initializeTheme() {
    const savedAppearance = (localStorage.getItem('appearance') as Appearance) || 'system';

    applyTheme(savedAppearance);
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    void api<{
        data: {
            theme: Appearance;
            accent_color: string;
            font_size: 'small' | 'medium' | 'large';
        };
    }>('/api/preferences')
        .then(({ data }) => {
            localStorage.setItem('appearance', data.theme);
            applyTheme(data.theme);
            document.documentElement.style.setProperty('--primary', data.accent_color);
            document.documentElement.style.fontSize =
                data.font_size === 'small' ? '14px' : data.font_size === 'large' ? '18px' : '16px';
        })
        .catch((error: unknown) => {
            if (!(error instanceof ApiError && error.status === 401)) {
                window.dispatchEvent(
                    new CustomEvent('preferences:error', {
                        detail: error instanceof Error ? error.message : 'Unable to load preferences.',
                    }),
                );
            }
        });
}

export function useAppearance() {
    const [appearance, setAppearance] = useState<Appearance>('system');
    const [error, setError] = useState('');

    const updateAppearance = (mode: Appearance) => {
        setAppearance(mode);
        localStorage.setItem('appearance', mode);
        applyTheme(mode);

        void api('/api/preferences', {
            method: 'PUT',
            body: JSON.stringify({ theme: mode }),
        })
            .then(() => setError(''))
            .catch((reason: unknown) => {
                const message = reason instanceof Error ? reason.message : 'Unable to save appearance settings.';
                setError(message);
                window.dispatchEvent(new CustomEvent('preferences:error', { detail: message }));
            });
    };

    useEffect(() => {
        const savedAppearance = localStorage.getItem('appearance') as Appearance | null;
        if (savedAppearance) {
            setAppearance(savedAppearance);
            applyTheme(savedAppearance);
        }
    }, []);

    return { appearance, updateAppearance, error };
}
