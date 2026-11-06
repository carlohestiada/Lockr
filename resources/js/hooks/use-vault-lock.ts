import { ApiError, api } from '@/lib/api';
import { useCallback, useRef, useState } from 'react';

declare global {
    interface WindowEventMap {
        'vault:locking': Event;
        'vault:locked': Event;
        'vault:lock-failed': CustomEvent<string>;
    }
}

export default function useVaultLock() {
    const requestInProgress = useRef(false);
    const [locking, setLocking] = useState(false);
    const [error, setError] = useState('');

    const lockVault = useCallback(async (): Promise<boolean> => {
        if (requestInProgress.current) return false;

        requestInProgress.current = true;
        setLocking(true);
        setError('');
        window.dispatchEvent(new Event('vault:locking'));

        try {
            await api('/api/vault/lock', { method: 'POST', keepalive: true });
            window.dispatchEvent(new Event('vault:locked'));
            return true;
        } catch (reason) {
            if (reason instanceof ApiError && reason.status === 423) {
                return true;
            }

            const message = reason instanceof Error ? reason.message : 'Unable to confirm that the vault is locked.';
            setError(message);
            window.dispatchEvent(new CustomEvent('vault:lock-failed', { detail: message }));
            return false;
        } finally {
            requestInProgress.current = false;
            setLocking(false);
        }
    }, []);

    return { lockVault, locking, error };
}
