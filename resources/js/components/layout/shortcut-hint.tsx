import { useEffect, useState } from 'react';

type ShortcutKey = 'K' | 'L';

export default function ShortcutHint({ shortcut, variant = 'light' }: { shortcut: ShortcutKey; variant?: 'light' | 'dark' }) {
    const [isMac, setIsMac] = useState(false);

    useEffect(() => {
        setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    }, []);

    return (
        <kbd
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                variant === 'dark' ? 'bg-white/10 text-slate-300' : 'bg-lockr-subtle border border-slate-200 text-slate-500'
            }`}
        >
            {isMac ? `⌘${shortcut}` : `Ctrl+${shortcut}`}
        </kbd>
    );
}
