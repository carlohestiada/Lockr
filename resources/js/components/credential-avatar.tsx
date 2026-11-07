import { cn } from '@/lib/utils';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';

type CredentialAvatarProps = {
    title: string;
    websiteUrl: string | null;
    className?: string;
};

function faviconUrl(value: string | null): string | null {
    if (!value) return null;

    try {
        const normalized = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
        const url = new URL(normalized);
        if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname.includes('.')) return null;

        const domain = url.hostname
            .toLowerCase()
            .replace(/\.$/, '')
            .replace(/^www\./, '');
        if (!domain || domain === 'localhost') return null;

        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
    } catch {
        return null;
    }
}

export default function CredentialAvatar({ title, websiteUrl, className = '' }: CredentialAvatarProps) {
    const src = faviconUrl(websiteUrl);
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const initial = title.trim().charAt(0).toUpperCase();

    return (
        <span
            className={cn(
                'bg-lockr-navy flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg font-mono text-xs font-bold text-white',
                className,
            )}
            aria-hidden="true"
        >
            {src && failedSrc !== src ? (
                <img
                    key={src}
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="size-full bg-white object-contain p-1"
                    onError={() => setFailedSrc(src)}
                />
            ) : initial ? (
                initial
            ) : (
                <KeyRound className="size-[18px]" />
            )}
        </span>
    );
}
