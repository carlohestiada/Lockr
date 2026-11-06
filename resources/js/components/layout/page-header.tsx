import type { ReactNode } from 'react';

export default function PageHeader({
    eyebrow,
    title,
    badge,
    actions,
    description,
}: {
    eyebrow?: string;
    title: string;
    badge?: ReactNode;
    actions?: ReactNode;
    description?: string;
}) {
    return (
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
                {eyebrow && <p className="mb-1 text-xs font-medium text-slate-500">{eyebrow}</p>}
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lockr-navy text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                    {badge}
                </div>
                {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
        </section>
    );
}
