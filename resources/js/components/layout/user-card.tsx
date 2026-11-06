import type { User } from '@/types';
import { Link } from '@inertiajs/react';
import { LogOut, MoreHorizontal } from 'lucide-react';

function initials(name: string): string {
    return (
        name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('') || '?'
    );
}

export default function UserCard({ user, status = 'Vault unlocked' }: { user: User; status?: string }) {
    return (
        <div className="bg-lockr-navy-active/50 m-3 rounded-xl p-3">
            <div className="flex min-w-0 items-center gap-3">
                <span className="bg-lockr-accent flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {initials(user.name)}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{user.name}</span>
                    <span className="block truncate text-xs text-slate-300">{status}</span>
                </span>
                <Link
                    href="/settings/profile"
                    aria-label="Profile settings"
                    className="rounded p-1.5 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
                >
                    <MoreHorizontal className="size-5" aria-hidden="true" />
                </Link>
            </div>
            <Link
                href="/logout"
                method="post"
                as="button"
                className="mt-3 flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white"
            >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
            </Link>
        </div>
    );
}
