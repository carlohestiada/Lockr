import type { FormDataConvertible } from '@inertiajs/core';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Cloud, KeyRound, LoaderCircle, LockKeyhole, Mail, Shield, ShieldAlert } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type RecoveryMethod = 'emergency-kit' | 'cloud-archive';

interface RecoveryForm extends Record<string, FormDataConvertible> {
    email: string;
}

export default function ForgotPassword({ status }: { status?: string }) {
    const [activeMethod, setActiveMethod] = useState<RecoveryMethod>('emergency-kit');
    const { data, setData, post, processing, errors } = useForm<RecoveryForm>({
        email: '',
    });

    const submit: FormEventHandler = (event) => {
        event.preventDefault();
        if (processing) return;

        post(route('password.email'));
    };

    return (
        <main className="lockr-login-background lockr-login-font flex min-h-svh items-center justify-center px-4 py-8 text-[#0A2647] sm:px-6 sm:py-12">
            <Head title="Recover your vault">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700|jetbrains-mono:400,500" rel="stylesheet" />
            </Head>

            <section className="w-full max-w-[560px]">
                <header className="mb-6 text-center sm:mb-7">
                    <Link
                        href={route('login')}
                        className="mx-auto mb-4 inline-flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-4"
                        aria-label="Return to Lockr sign in"
                    >
                        <span className="relative flex size-11 items-center justify-center rounded-xl bg-[#0A2647] text-white shadow-lg shadow-[#0A2647]/15">
                            <Shield className="size-7" strokeWidth={2} aria-hidden="true" />
                            <LockKeyhole className="absolute top-[15px] left-[15px] size-[11px]" strokeWidth={2.2} aria-hidden="true" />
                        </span>
                        <span className="text-2xl font-bold tracking-tight text-[#0A2647]">Lockr</span>
                    </Link>
                    <p className="mb-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#205295]/15 bg-white/80 px-3 py-1 text-[10px] font-medium tracking-[0.12em] text-[#205295] uppercase">
                            <KeyRound className="size-3.5" aria-hidden="true" />
                            Recovery Portal
                        </span>
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight text-[#0A2647] sm:text-[28px]">Recover Your Vault</h1>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                        Recovery requires access to your registered email and a valid password reset link.
                    </p>
                </header>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-32px_rgba(10,38,71,0.32)] sm:p-8">
                    <aside className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
                        <div>
                            <h2 className="text-sm font-semibold text-[#0A2647]">Important Cryptographic Notice</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                                Emergency Recovery Kit and Cloud Archive recovery are not implemented. Lockr cannot verify a recovery key or
                                reconstruct a lost password. The supported option is an email password reset; encrypted credentials remain dependent
                                on the application encryption key.
                            </p>
                        </div>
                    </aside>

                    <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Recovery methods">
                        <button
                            id="emergency-kit-tab"
                            type="button"
                            role="tab"
                            aria-selected={activeMethod === 'emergency-kit'}
                            aria-controls="emergency-kit-panel"
                            onClick={() => setActiveMethod('emergency-kit')}
                            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:outline-none sm:text-sm ${
                                activeMethod === 'emergency-kit' ? 'bg-white text-[#003A78] shadow-sm' : 'text-slate-500 hover:text-[#0A2647]'
                            }`}
                        >
                            <KeyRound className="size-4" aria-hidden="true" />
                            Emergency Kit
                        </button>
                        <button
                            id="cloud-archive-tab"
                            type="button"
                            role="tab"
                            aria-selected={activeMethod === 'cloud-archive'}
                            aria-controls="cloud-archive-panel"
                            onClick={() => setActiveMethod('cloud-archive')}
                            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:outline-none sm:text-sm ${
                                activeMethod === 'cloud-archive' ? 'bg-white text-[#003A78] shadow-sm' : 'text-slate-500 hover:text-[#0A2647]'
                            }`}
                        >
                            <Cloud className="size-4" aria-hidden="true" />
                            Cloud Archive
                        </button>
                    </div>

                    <section id="emergency-kit-panel" role="tabpanel" aria-labelledby="emergency-kit-tab" hidden={activeMethod !== 'emergency-kit'}>
                        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h2 className="text-sm font-semibold text-[#0A2647]">Emergency Kit recovery is not available</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                                This application has no issued recovery kit, supported key format, or cryptographic key verifier. Recovery key and
                                file upload are intentionally unavailable.
                            </p>
                        </div>

                        <div className="mb-4">
                            <h2 className="text-sm font-semibold text-[#0A2647]">Reset your sign-in password by email</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                                We’ll send a time-limited password reset link if the address belongs to an account. This uses Lockr’s existing Laravel
                                password reset flow.
                            </p>
                        </div>

                        {status && (
                            <div
                                role="status"
                                className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
                            >
                                {status}
                            </div>
                        )}

                        <form className="space-y-4" onSubmit={submit}>
                            <div className="space-y-2">
                                <label htmlFor="email" className="block text-sm font-semibold text-[#0A2647]">
                                    Registered Vault Email
                                </label>
                                <div className="relative">
                                    <Mail
                                        aria-hidden="true"
                                        className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[#2C74B3]"
                                    />
                                    <Input
                                        id="email"
                                        type="email"
                                        required
                                        autoComplete="email"
                                        value={data.email}
                                        onChange={(event) => setData('email', event.target.value)}
                                        disabled={processing}
                                        placeholder="you@example.com"
                                        aria-invalid={Boolean(errors.email)}
                                        aria-describedby={errors.email ? 'recovery-email-error' : undefined}
                                        className="h-[50px] rounded-xl border-slate-200 bg-[#EFF4FF] pr-4 pl-11 text-sm text-[#0A2647] shadow-none placeholder:text-slate-400 focus-visible:border-[#2C74B3] focus-visible:ring-[#2C74B3]/25"
                                    />
                                </div>
                                <InputError id="recovery-email-error" message={errors.email} role="alert" />
                            </div>

                            <Button
                                type="submit"
                                disabled={processing}
                                className="h-[50px] w-full rounded-xl bg-[#003A78] text-sm font-semibold text-white shadow-md shadow-[#003A78]/15 transition-colors hover:bg-[#205295] focus-visible:ring-[#2C74B3] disabled:cursor-not-allowed"
                            >
                                {processing ? (
                                    <>
                                        <LoaderCircle className="size-[18px] animate-spin" aria-hidden="true" />
                                        Sending reset link...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="size-[18px]" aria-hidden="true" />
                                        Send Password Reset Link
                                    </>
                                )}
                            </Button>
                        </form>
                    </section>

                    <section id="cloud-archive-panel" role="tabpanel" aria-labelledby="cloud-archive-tab" hidden={activeMethod !== 'cloud-archive'}>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
                            <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-slate-200/70 text-slate-500">
                                <Cloud className="size-5" aria-hidden="true" />
                            </span>
                            <h2 className="text-sm font-semibold text-[#0A2647]">Cloud Archive is not available</h2>
                            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-600">
                                Lockr does not currently store recovery archives or provide cloud-based vault restoration. No archive data can be
                                retrieved here.
                            </p>
                        </div>
                    </section>

                    <p className="mt-6 border-t border-slate-200 pt-5 text-center text-sm text-slate-600">
                        <Link href={route('login')} className="inline-flex items-center gap-1.5 font-semibold text-[#205295] hover:text-[#003A78]">
                            <ArrowLeft className="size-4" aria-hidden="true" />
                            Return to Sign In
                        </Link>
                    </p>
                </div>

                <footer className="mt-5 text-center text-xs leading-5 text-slate-500">
                    Stored credential fields use Laravel application encryption. Recovery cannot restore data if the application encryption key is
                    unavailable.
                </footer>
            </section>
        </main>
    );
}
