import { Info, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { PreferenceTabProps } from './types';

const autoLockOptions = [
    { value: 0, label: 'Manual only', description: 'No inactivity timer' },
    { value: 1, label: '1 minute', description: 'Quick timeout' },
    { value: 5, label: '5 minutes', description: 'Short timeout' },
    { value: 10, label: '10 minutes', description: 'Balanced' },
    { value: 15, label: '15 minutes', description: 'Default' },
    { value: 30, label: '30 minutes', description: 'Longer session' },
    { value: 60, label: '1 hour', description: 'Extended session' },
];

export default function SecurityTab({ value, onChange }: PreferenceTabProps) {
    return (
        <div className="grid gap-5 lg:grid-cols-12">
            <section className="space-y-5 lg:col-span-7">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF4FF] text-[#205295]">
                            <LockKeyhole className="size-5" aria-hidden="true" />
                        </span>
                        <div>
                            <h2 className="font-semibold text-[#0A2647] dark:text-slate-100">Inactivity auto-lock</h2>
                            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                Choose how long the vault can remain unlocked while idle.
                            </p>
                        </div>
                    </div>

                    <fieldset className="mt-5">
                        <legend className="sr-only">Automatically lock vault after</legend>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {autoLockOptions.map((option) => (
                                <label
                                    key={option.value}
                                    className={`relative flex min-h-14 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-[#2C74B3] ${
                                        value.auto_lock_minutes === option.value
                                            ? 'border-[#205295] bg-[#EFF4FF] text-[#0A2647] dark:bg-slate-800 dark:text-slate-100'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="auto-lock"
                                        value={option.value}
                                        checked={value.auto_lock_minutes === option.value}
                                        onChange={() => onChange('auto_lock_minutes', option.value)}
                                        className="size-4 accent-[#205295]"
                                    />
                                    <span className="min-w-0">
                                        <span className="block text-xs font-semibold">{option.label}</span>
                                        <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400">{option.description}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <div className="mt-5 flex gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs leading-5 text-slate-600 dark:border-blue-900 dark:bg-blue-950/40 dark:text-slate-300">
                        <Info className="mt-0.5 size-4 shrink-0 text-[#205295]" aria-hidden="true" />
                        <p>
                            Locking ends the server-side unlocked vault session. The app also clears revealed passwords from its in-memory page state.
                            Manual lock is always available.
                        </p>
                    </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF4FF] text-[#205295]">
                            <KeyRound className="size-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <h2 className="font-semibold text-[#0A2647] dark:text-slate-100">Account password</h2>
                            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                Your account password is also used to unlock the vault in this version of Lockr.
                            </p>
                        </div>
                    </div>
                    <a
                        href="/settings/password"
                        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-[#144272] transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C74B3] dark:border-slate-700 dark:text-blue-200 dark:hover:bg-slate-800"
                    >
                        Change account password
                    </a>
                </article>
            </section>

            <aside className="lg:col-span-5">
                <article className="h-full rounded-2xl bg-[#0A2647] p-5 text-white shadow-sm sm:p-6">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-blue-200">
                        <ShieldCheck className="size-5" aria-hidden="true" />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold">Security at a glance</h2>
                    <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-200/10 px-3 py-1.5 text-xs font-medium text-blue-100">
                        <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                        Server-side encrypted
                    </span>
                    <dl className="mt-5 divide-y divide-white/10 text-sm">
                        <div className="flex items-start justify-between gap-4 py-3">
                            <dt className="text-blue-100/70">Credential storage</dt>
                            <dd className="text-right font-medium">Encrypted attributes</dd>
                        </div>
                        <div className="flex items-start justify-between gap-4 py-3">
                            <dt className="text-blue-100/70">Encryption key</dt>
                            <dd className="text-right font-medium">Application key</dd>
                        </div>
                        <div className="flex items-start justify-between gap-4 py-3">
                            <dt className="text-blue-100/70">Passkeys and 2-step login</dt>
                            <dd className="text-right font-medium">Not available</dd>
                        </div>
                    </dl>
                    <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-blue-100/80">
                        This implementation uses server-side encryption; it is not zero-knowledge or end-to-end encrypted.
                    </p>
                </article>
            </aside>
        </div>
    );
}
