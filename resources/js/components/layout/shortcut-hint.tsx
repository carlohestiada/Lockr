import { useEffect, useState } from 'react';

type ShortcutKey = 'K' | 'L';

export default function ShortcutHint({ shortcut }: { shortcut: ShortcutKey }) {
    const [isMac, setIsMac] = useState(false);

    useEffect(() => {
        setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    }, []);

    return (
        <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">{isMac ? `⌘${shortcut}` : `Ctrl+${shortcut}`}</kbd>
    );
}
