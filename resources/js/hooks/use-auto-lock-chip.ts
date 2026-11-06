import { ApiError, api } from '@/lib/api';
import type { UserPreferences } from '@/pages/settings/preferences/types';
import { useEffect, useRef, useState } from 'react';

type AutoLockChipOptions = {
    minutes: number | null;
    active: boolean;
    onExpire: () => Promise<boolean>;
};

export default function useAutoLockChip({ minutes: initialMinutes, active, onExpire }: AutoLockChipOptions) {
    const [minutes, setMinutes] = useState(initialMinutes);
    const [remainingSeconds, setRemainingSeconds] = useState((initialMinutes ?? 0) * 60);
    const [statusError, setStatusError] = useState('');
    const lastActivity = useRef(Date.now());
    const lastHeartbeat = useRef(0);

    useEffect(() => {
        setMinutes(initialMinutes);
        setRemainingSeconds((initialMinutes ?? 0) * 60);
    }, [initialMinutes]);

    useEffect(() => {
        const handlePreferencesUpdated = (event: WindowEventMap['preferences:updated']) => {
            setMinutes(event.detail.auto_lock_minutes);
            setRemainingSeconds(event.detail.auto_lock_minutes * 60);
        };

        window.addEventListener('preferences:updated', handlePreferencesUpdated);
        return () => window.removeEventListener('preferences:updated', handlePreferencesUpdated);
    }, []);

    useEffect(() => {
        if (!active || minutes === null) {
            setRemainingSeconds((minutes ?? 0) * 60);
            return;
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') void onExpire();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        if (minutes <= 0) {
            setRemainingSeconds(0);
            return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
        }

        const timeoutMs = minutes * 60_000;
        let expiresAt = Date.now() + timeoutMs;
        let expiryRequested = false;

        const resetCountdown = () => {
            lastActivity.current = Date.now();
            expiresAt = lastActivity.current + timeoutMs;
            expiryRequested = false;
            setRemainingSeconds(minutes * 60);
            setStatusError('');
        };

        const timer = window.setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
            setRemainingSeconds(remaining);

            if (remaining === 0 && !expiryRequested) {
                expiryRequested = true;
                void onExpire();
                return;
            }

            if (now - lastActivity.current < 30_000 && now - lastHeartbeat.current >= 30_000) {
                lastHeartbeat.current = now;
                void api<{ locked: boolean }>('/api/vault/status')
                    .then((status) => {
                        if (status.locked) window.dispatchEvent(new Event('vault:locked'));
                    })
                    .catch((reason: unknown) => {
                        if (!(reason instanceof ApiError && reason.status === 423)) {
                            setStatusError(reason instanceof Error ? reason.message : 'Unable to refresh vault status.');
                        }
                    });
            }
        }, 1000);
        const activityEvents: (keyof WindowEventMap)[] = ['keydown', 'mousedown', 'pointerdown', 'scroll', 'touchstart'];
        activityEvents.forEach((event) => window.addEventListener(event, resetCountdown, { passive: true }));
        return () => {
            window.clearInterval(timer);
            activityEvents.forEach((event) => window.removeEventListener(event, resetCountdown));
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [active, minutes, onExpire]);

    return { minutes, remainingSeconds, statusError };
}

declare global {
    interface WindowEventMap {
        'preferences:updated': CustomEvent<UserPreferences>;
    }
}
