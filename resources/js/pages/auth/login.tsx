import type { FormDataConvertible } from '@inertiajs/core';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, Check, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { FormEventHandler, useEffect, useState } from 'react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const rememberedEmailKey = 'lockr.rememberedEmail';

interface LoginForm extends Record<string, FormDataConvertible> {
    email: string;
    password: string;
    remember: boolean;
}

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const { data, setData, post, processing, errors, reset } = useForm<LoginForm>({
        email: '',
        password: '',
        remember: false,
    });
    const [rememberEmail, setRememberEmail] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [storageError, setStorageError] = useState('');

    useEffect(() => {
        try {
            const rememberedEmail = window.localStorage.getItem(rememberedEmailKey);
            if (rememberedEmail) {
                setData('email', rememberedEmail);
                setRememberEmail(true);
            }
        } catch {
            setStorageError('This browser does not allow saving a remembered email on this device.');
        }
    }, [setData]);

    const changeRememberEmail = (checked: boolean) => {
        setRememberEmail(checked);
        setStorageError('');

        if (!checked) {
            try {
                window.localStorage.removeItem(rememberedEmailKey);
            } catch {
                setStorageError('The remembered email could not be removed from this device.');
            }
        }
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (processing) return;

        setStorageError('');
        try {
            if (rememberEmail && data.email) {
                window.localStorage.setItem(rememberedEmailKey, data.email);
            } else {
                window.localStorage.removeItem(rememberedEmailKey);
            }
        } catch {
            setStorageError('Your email could not be saved on this device. You can still sign in.');
        }

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <main className="lockr-login-background lockr-login-font flex min-h-svh items-center justify-center px-4 py-10 text-[#0A2647] sm:px-6 sm:py-12">
            <Head title="Log in">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700|jetbrains-mono:400,500" rel="stylesheet" />
            </Head>

            <section className="w-full max-w-[460px]">
                <header className="mb-7 text-center sm:mb-8">
                    <Link
                        href={route('home')}
                        className="mx-auto mb-4 inline-flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-4"
                        aria-label="Lockr home"
                    >
                        <span className="flex size-12 items-center justify-center rounded-xl bg-[#003A78] text-white shadow-lg shadow-[#003A78]/15">
                            <ShieldCheck className="size-7" strokeWidth={2.2} aria-hidden="true" />
                        </span>
                        <span className="text-3xl font-bold tracking-[-0.06em] text-[#0A2647]">Lockr</span>
                    </Link>
                    <p className="lockr-login-mono text-[10px] font-medium tracking-[0.2em] text-[#205295] sm:text-[11px]">SECURE CREDENTIAL VAULT</p>
                    <h1 className="mt-4 text-xl font-semibold tracking-tight text-[#0A2647] sm:text-2xl">Welcome back</h1>
                    <p className="mt-2 text-sm text-slate-600">Sign in to access your encrypted personal vault</p>
                </header>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-32px_rgba(10,38,71,0.32)] sm:p-8">
                    {status && (
                        <div
                            role="status"
                            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
                        >
                            {status}
                        </div>
                    )}
                    {storageError && (
                        <div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            {storageError}
                        </div>
                    )}

                    <form className="space-y-5" onSubmit={submit}>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <Label htmlFor="email" className="text-sm font-semibold text-[#0A2647]">
                                    Vault Email Address
                                </Label>
                                <span className="text-xs text-slate-500">Registered Identity</span>
                            </div>
                            <div className="relative">
                                <Mail
                                    aria-hidden="true"
                                    className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[#2C74B3]"
                                />
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    autoFocus
                                    autoComplete="email"
                                    value={data.email}
                                    onChange={(event) => setData('email', event.target.value)}
                                    placeholder="operator@cryptovault.internal"
                                    disabled={processing}
                                    aria-invalid={Boolean(errors.email)}
                                    aria-describedby={errors.email ? 'email-error' : undefined}
                                    className="h-[50px] rounded-xl border-slate-200 bg-[#EFF4FF] pr-4 pl-11 text-sm text-[#0A2647] shadow-none placeholder:text-slate-400 focus-visible:border-[#2C74B3] focus-visible:ring-[#2C74B3]/25"
                                />
                            </div>
                            <InputError id="email-error" message={errors.email} role="alert" />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <Label htmlFor="password" className="text-sm font-semibold text-[#0A2647]">
                                    Master Password
                                </Label>
                                {canResetPassword && (
                                    <TextLink href={route('password.request')} className="text-xs font-medium text-[#205295] hover:text-[#003A78]">
                                        Forgot password?
                                    </TextLink>
                                )}
                            </div>
                            <div className="relative">
                                <KeyRound
                                    aria-hidden="true"
                                    className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[#2C74B3]"
                                />
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    autoComplete="current-password"
                                    value={data.password}
                                    onChange={(event) => setData('password', event.target.value)}
                                    onKeyDown={(event) => setCapsLockOn(event.getModifierState('CapsLock'))}
                                    onKeyUp={(event) => setCapsLockOn(event.getModifierState('CapsLock'))}
                                    onBlur={() => setCapsLockOn(false)}
                                    disabled={processing}
                                    aria-invalid={Boolean(errors.password)}
                                    aria-describedby={
                                        [errors.password ? 'password-error' : '', capsLockOn ? 'caps-lock-warning' : ''].filter(Boolean).join(' ') ||
                                        undefined
                                    }
                                    className="h-[50px] rounded-xl border-slate-200 bg-[#EFF4FF] pr-12 pl-11 text-sm text-[#0A2647] shadow-none placeholder:text-slate-400 focus-visible:border-[#2C74B3] focus-visible:ring-[#2C74B3]/25"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((visible) => !visible)}
                                    aria-label={showPassword ? 'Hide master password' : 'Show master password'}
                                    aria-pressed={showPassword}
                                    disabled={processing}
                                    className="absolute top-1/2 right-2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-white hover:text-[#144272] focus-visible:ring-2 focus-visible:ring-[#2C74B3] disabled:opacity-50"
                                >
                                    {showPassword ? (
                                        <EyeOff className="size-[18px]" aria-hidden="true" />
                                    ) : (
                                        <Eye className="size-[18px]" aria-hidden="true" />
                                    )}
                                </button>
                            </div>
                            {capsLockOn && (
                                <p id="caps-lock-warning" role="status" className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                                    Caps Lock is on
                                </p>
                            )}
                            <InputError id="password-error" message={errors.password} role="alert" />
                        </div>

                        <div className="space-y-3 pt-0.5">
                            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={rememberEmail}
                                    onChange={(event) => changeRememberEmail(event.target.checked)}
                                    disabled={processing}
                                    className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-[#205295] focus-visible:ring-2 focus-visible:ring-[#2C74B3]"
                                />
                                <span>Remember email on this secure device</span>
                            </label>
                            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={data.remember}
                                    onChange={(event) => setData('remember', event.target.checked)}
                                    disabled={processing}
                                    className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-[#205295] focus-visible:ring-2 focus-visible:ring-[#2C74B3]"
                                />
                                <span>Keep me signed in</span>
                            </label>
                        </div>

                        <Button
                            type="submit"
                            className="h-[50px] w-full rounded-xl bg-[#003A78] text-sm font-semibold text-white shadow-md shadow-[#003A78]/15 transition-colors hover:bg-[#205295] focus-visible:ring-[#2C74B3] disabled:cursor-not-allowed"
                            disabled={processing}
                        >
                            {processing ? (
                                <>
                                    <LoaderCircle className="size-[18px] animate-spin" aria-hidden="true" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <LockKeyhole className="size-[18px]" aria-hidden="true" />
                                    Sign In to Vault
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="relative my-5 flex items-center" aria-hidden="true">
                        <span className="h-px flex-1 bg-slate-200" />
                        <span className="px-3 text-[10px] font-medium tracking-[0.14em] text-slate-400 uppercase">or</span>
                        <span className="h-px flex-1 bg-slate-200" />
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        disabled
                        aria-describedby="passkey-unavailable"
                        className="h-[48px] w-full rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-500"
                    >
                        <KeyRound className="size-[17px]" aria-hidden="true" />
                        Sign in with Passkey / WebAuthn
                    </Button>
                    <p id="passkey-unavailable" className="mt-2 text-center text-xs text-slate-500">
                        Passkey sign-in is not available yet.
                    </p>
                </div>

                <p className="mt-5 text-center text-sm text-slate-600">
                    Don&apos;t have a Lockr vault yet?{' '}
                    <TextLink href={route('register')} className="inline-flex items-center gap-1 font-semibold text-[#205295] hover:text-[#003A78]">
                        Create an account <ArrowRight className="size-4" aria-hidden="true" />
                    </TextLink>
                </p>

                <footer className="mt-8 flex flex-col items-center gap-3 text-center">
                    <div className="flex max-w-md items-start justify-center gap-2.5 text-xs leading-5 text-slate-500">
                        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#2C74B3]" aria-hidden="true" />
                        <p>
                            Credential passwords and notes are encrypted at rest by the application. Sign-in and vault access use your account
                            session.
                        </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#205295]/15 bg-white/75 px-3 py-1 text-[10px] font-medium tracking-wide text-[#205295]">
                        <Check className="size-3.5" aria-hidden="true" />
                        ENCRYPTED AT REST
                    </span>
                </footer>
            </section>
        </main>
    );
}
