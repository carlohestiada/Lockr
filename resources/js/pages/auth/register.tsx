import type { FormDataConvertible } from '@inertiajs/core';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowRight,
    Check,
    CheckCircle2,
    Copy,
    Eye,
    EyeOff,
    KeyRound,
    LoaderCircle,
    LockKeyhole,
    Mail,
    RefreshCw,
    ShieldCheck,
    UserRound,
    X,
} from 'lucide-react';
import { FormEventHandler, useMemo, useState } from 'react';

import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface RegisterForm extends Record<string, FormDataConvertible> {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
}

const passwordCharacters = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.?',
};

function randomIndex(max: number): number {
    const limit = Math.floor(0x1_0000_0000 / max) * max;
    const value = new Uint32Array(1);

    do {
        window.crypto.getRandomValues(value);
    } while (value[0] >= limit);

    return value[0] % max;
}

function createSecurePassphrase(): string {
    const groups = Object.values(passwordCharacters);
    const alphabet = groups.join('');
    const characters = groups.map((group) => group[randomIndex(group.length)]);

    while (characters.length < 24) {
        characters.push(alphabet[randomIndex(alphabet.length)]);
    }

    for (let index = characters.length - 1; index > 0; index--) {
        const target = randomIndex(index + 1);
        [characters[index], characters[target]] = [characters[target], characters[index]];
    }

    return [0, 6, 12, 18].map((start) => characters.slice(start, start + 6).join('')).join('-');
}

const passwordRequirements = [
    { label: 'At least 14 characters', test: (password: string) => password.length >= 14 },
    { label: 'Uppercase and lowercase letters', test: (password: string) => /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'At least one number', test: (password: string) => /\d/.test(password) },
    { label: 'At least one symbol', test: (password: string) => /[^A-Za-z0-9]/.test(password) },
];

export default function Register() {
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
    const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
    const [clipboardMessage, setClipboardMessage] = useState('');
    const [generatorError, setGeneratorError] = useState('');
    const [copyError, setCopyError] = useState('');
    const { data, setData, post, processing, errors, reset } = useForm<RegisterForm>({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const passwordChecks = useMemo(
        () => passwordRequirements.map((requirement) => ({ ...requirement, met: requirement.test(data.password) })),
        [data.password],
    );
    const strength = passwordChecks.filter((requirement) => requirement.met).length;
    const passwordsMatch = data.password_confirmation.length > 0 && data.password === data.password_confirmation;
    const passwordsMismatch = data.password_confirmation.length > 0 && data.password !== data.password_confirmation;

    const submit: FormEventHandler = (event) => {
        event.preventDefault();
        if (processing) return;

        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    const generatePassphrase = () => {
        setGeneratorError('');
        try {
            setData('password', createSecurePassphrase());
        } catch {
            setGeneratorError('Secure passphrase generation is unavailable in this browser.');
        }
    };

    const copyPassword = async () => {
        setCopyError('');
        if (!data.password) return;

        try {
            await navigator.clipboard.writeText(data.password);
            setClipboardMessage('Password copied to clipboard. Clear it after use.');
        } catch {
            setCopyError('Clipboard access failed. Check your browser permissions.');
        }
    };

    return (
        <main className="lockr-login-background lockr-login-font flex min-h-svh items-center justify-center px-4 py-8 text-[#0A2647] sm:px-6 sm:py-12">
            <Head title="Create account">
                <link rel="preconnect" href="https://fonts.bunny.net" />
                <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700|jetbrains-mono:400,500" rel="stylesheet" />
            </Head>

            <section className="w-full max-w-[560px]">
                <header className="mb-6 text-center sm:mb-7">
                    <Link
                        href={route('home')}
                        className="mx-auto mb-4 inline-flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#2C74B3] focus-visible:ring-offset-4"
                        aria-label="Lockr home"
                    >
                        <span className="flex size-11 items-center justify-center rounded-xl bg-[#0A2647] text-white shadow-lg shadow-[#0A2647]/15">
                            <ShieldCheck className="size-6" strokeWidth={2.2} aria-hidden="true" />
                        </span>
                        <span className="text-left">
                            <span className="block text-lg leading-5 font-bold tracking-tight text-[#0A2647]">Lockr</span>
                            <span className="block text-[10px] font-medium tracking-[0.16em] text-[#205295] uppercase">Vault Core</span>
                        </span>
                    </Link>
                    <h1 className="text-2xl font-semibold tracking-tight text-[#0A2647] sm:text-[28px]">Create Your Personal Vault</h1>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                        Create your account to organize credentials in your encrypted personal vault.
                    </p>
                </header>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-32px_rgba(10,38,71,0.32)] sm:p-8">
                    <aside className="mb-6 flex gap-3 rounded-xl border border-[#2C74B3]/20 bg-[#2C74B3]/[0.06] p-4">
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#205295]" aria-hidden="true" />
                        <div>
                            <h2 className="text-sm font-semibold text-[#0A2647]">Recovery information</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                                Lockr cannot reset a lost password. An Emergency Recovery Kit is not available yet; do not rely on a recovery download
                                during setup.
                            </p>
                        </div>
                    </aside>

                    <form className="space-y-5" onSubmit={submit}>
                        <div className="space-y-2">
                            <label htmlFor="name" className="block text-sm font-semibold text-[#0A2647]">
                                Full Name
                            </label>
                            <div className="relative">
                                <UserRound
                                    aria-hidden="true"
                                    className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[#2C74B3]"
                                />
                                <Input
                                    id="name"
                                    type="text"
                                    required
                                    autoFocus
                                    autoComplete="name"
                                    value={data.name}
                                    onChange={(event) => setData('name', event.target.value)}
                                    disabled={processing}
                                    placeholder="Alex Mercer"
                                    aria-invalid={Boolean(errors.name)}
                                    aria-describedby={errors.name ? 'name-error' : undefined}
                                    className="h-[50px] rounded-xl border-slate-200 bg-[#F1F5F9] pr-4 pl-11 text-sm text-[#0A2647] shadow-none placeholder:text-slate-400 focus-visible:border-[#2C74B3] focus-visible:ring-[#2C74B3]/25"
                                />
                            </div>
                            <InputError id="name-error" message={errors.name} role="alert" />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="email" className="block text-sm font-semibold text-[#0A2647]">
                                Master Email Address
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
                                    placeholder="alex.mercer@dev.io"
                                    aria-invalid={Boolean(errors.email)}
                                    aria-describedby={errors.email ? 'email-error' : undefined}
                                    className="h-[50px] rounded-xl border-slate-200 bg-[#F1F5F9] pr-4 pl-11 text-sm text-[#0A2647] shadow-none placeholder:text-slate-400 focus-visible:border-[#2C74B3] focus-visible:ring-[#2C74B3]/25"
                                />
                            </div>
                            <InputError id="email-error" message={errors.email} role="alert" />
                        </div>

                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <label htmlFor="password" className="text-sm font-semibold text-[#0A2647]">
                                    Master Password
                                </label>
                                <button
                                    type="button"
                                    onClick={generatePassphrase}
                                    disabled={processing}
                                    className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-[#205295] outline-none hover:text-[#003A78] focus-visible:ring-2 focus-visible:ring-[#2C74B3] disabled:opacity-50"
                                >
                                    <RefreshCw className="size-3.5" aria-hidden="true" />
                                    Generate Strong Passphrase
                                </button>
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
                                    autoComplete="new-password"
                                    value={data.password}
                                    onChange={(event) => {
                                        setData('password', event.target.value);
                                        setClipboardMessage('');
                                    }}
                                    disabled={processing}
                                    placeholder="At least 14 characters"
                                    aria-invalid={Boolean(errors.password)}
                                    aria-describedby="password-requirements password-strength password-error"
                                    className="h-[50px] rounded-xl border-slate-200 bg-[#F1F5F9] pr-24 pl-11 font-mono text-sm text-[#0A2647] shadow-none placeholder:font-sans placeholder:text-slate-400 focus-visible:border-[#2C74B3] focus-visible:ring-[#2C74B3]/25"
                                />
                                <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">
                                    <button
                                        type="button"
                                        onClick={() => void copyPassword()}
                                        disabled={!data.password || processing}
                                        aria-label="Copy master password"
                                        className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-white hover:text-[#144272] focus-visible:ring-2 focus-visible:ring-[#2C74B3] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <Copy className="size-4" aria-hidden="true" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((visible) => !visible)}
                                        disabled={processing}
                                        aria-label={showPassword ? 'Hide master password' : 'Show master password'}
                                        aria-pressed={showPassword}
                                        className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-white hover:text-[#144272] focus-visible:ring-2 focus-visible:ring-[#2C74B3] disabled:opacity-50"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="size-4" aria-hidden="true" />
                                        ) : (
                                            <Eye className="size-4" aria-hidden="true" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div id="password-strength" aria-live="polite">
                                <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-[11px] font-medium text-slate-500">Password strength</span>
                                    <span className="text-[11px] font-semibold text-slate-600">
                                        {data.password.length === 0
                                            ? 'Not set'
                                            : strength < 2
                                              ? 'Weak'
                                              : strength < 4
                                                ? 'Fair'
                                                : 'Meets requirements'}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-400">Composition checks only; this is not an entropy estimate.</p>
                                <div className="grid grid-cols-4 gap-1.5" aria-label={`${strength} of 4 password requirements met`}>
                                    {passwordChecks.map((requirement, index) => (
                                        <span
                                            key={requirement.label}
                                            className={`h-1 rounded-full ${index < strength ? (strength < 2 ? 'bg-[#EF4444]' : strength < 4 ? 'bg-[#F59E0B]' : 'bg-[#10B981]') : 'bg-slate-200'}`}
                                        />
                                    ))}
                                </div>
                            </div>

                            <ul id="password-requirements" className="grid gap-1.5 pt-1 sm:grid-cols-2" aria-label="Password requirements">
                                {passwordChecks.map((requirement) => (
                                    <li
                                        key={requirement.label}
                                        className={`flex items-center gap-1.5 text-xs ${requirement.met ? 'text-emerald-700' : 'text-slate-500'}`}
                                    >
                                        {requirement.met ? (
                                            <Check className="size-3.5 shrink-0" aria-hidden="true" />
                                        ) : (
                                            <span className="size-3.5 shrink-0 rounded-full border border-slate-300" aria-hidden="true" />
                                        )}
                                        {requirement.label}
                                    </li>
                                ))}
                            </ul>
                            <InputError id="password-error" message={errors.password} role="alert" />
                            {generatorError && (
                                <p role="alert" className="text-xs text-red-600">
                                    {generatorError}
                                </p>
                            )}
                            {copyError && (
                                <p role="alert" className="text-xs text-red-600">
                                    {copyError}
                                </p>
                            )}
                            {clipboardMessage && (
                                <p role="status" className="text-xs text-emerald-700">
                                    {clipboardMessage}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password_confirmation" className="block text-sm font-semibold text-[#0A2647]">
                                Confirm Master Password
                            </label>
                            <div className="relative">
                                <LockKeyhole
                                    aria-hidden="true"
                                    className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[#2C74B3]"
                                />
                                <Input
                                    id="password_confirmation"
                                    type={showPasswordConfirmation ? 'text' : 'password'}
                                    required
                                    autoComplete="new-password"
                                    value={data.password_confirmation}
                                    onChange={(event) => setData('password_confirmation', event.target.value)}
                                    disabled={processing}
                                    placeholder="Re-enter your master password"
                                    aria-invalid={Boolean(errors.password_confirmation) || passwordsMismatch}
                                    aria-describedby="password-match password-confirmation-error"
                                    className="h-[50px] rounded-xl border-slate-200 bg-[#F1F5F9] pr-12 pl-11 font-mono text-sm text-[#0A2647] shadow-none placeholder:font-sans placeholder:text-slate-400 focus-visible:border-[#2C74B3] focus-visible:ring-[#2C74B3]/25"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordConfirmation((visible) => !visible)}
                                    disabled={processing}
                                    aria-label={showPasswordConfirmation ? 'Hide confirmation password' : 'Show confirmation password'}
                                    aria-pressed={showPasswordConfirmation}
                                    className="absolute top-1/2 right-2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-white hover:text-[#144272] focus-visible:ring-2 focus-visible:ring-[#2C74B3] disabled:opacity-50"
                                >
                                    {showPasswordConfirmation ? (
                                        <EyeOff className="size-4" aria-hidden="true" />
                                    ) : (
                                        <Eye className="size-4" aria-hidden="true" />
                                    )}
                                </button>
                            </div>
                            <p
                                id="password-match"
                                aria-live="polite"
                                className={`flex items-center gap-1.5 text-xs ${passwordsMatch ? 'text-emerald-700' : passwordsMismatch ? 'text-red-600' : 'text-slate-500'}`}
                            >
                                {passwordsMatch ? (
                                    <>
                                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                                        Passwords match
                                    </>
                                ) : passwordsMismatch ? (
                                    <>
                                        <X className="size-3.5" aria-hidden="true" />
                                        Passwords do not match
                                    </>
                                ) : (
                                    'Enter the same password again'
                                )}
                            </p>
                            <InputError id="password-confirmation-error" message={errors.password_confirmation} role="alert" />
                        </div>

                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-slate-700">
                                <input
                                    type="checkbox"
                                    required
                                    checked={recoveryAcknowledged}
                                    onChange={(event) => setRecoveryAcknowledged(event.target.checked)}
                                    disabled={processing}
                                    className="mt-0.5 size-4 shrink-0 accent-[#205295] focus-visible:ring-2 focus-visible:ring-[#2C74B3]"
                                />
                                <span>
                                    I understand that Lockr cannot reset my Master Password, and that the Emergency Recovery Kit is not yet available.
                                </span>
                            </label>
                            <label className="flex cursor-not-allowed items-start gap-2.5 text-xs leading-5 text-slate-500">
                                <input type="checkbox" checked={false} disabled className="mt-0.5 size-4 shrink-0 accent-[#205295]" />
                                <span>
                                    Enable WebAuthn / Touch ID biometrics after creation{' '}
                                    <span className="font-medium text-slate-400">(not available yet)</span>
                                </span>
                            </label>
                        </div>

                        <Button
                            type="submit"
                            className="h-[50px] w-full rounded-xl bg-[#003A78] text-sm font-semibold text-white shadow-md shadow-[#003A78]/15 transition-colors hover:bg-[#205295] focus-visible:ring-[#2C74B3] disabled:cursor-not-allowed"
                            disabled={processing || !recoveryAcknowledged || strength !== 4 || !passwordsMatch}
                        >
                            {processing ? (
                                <>
                                    <LoaderCircle className="size-[18px] animate-spin" aria-hidden="true" />
                                    Creating secure vault...
                                </>
                            ) : (
                                <>
                                    Create Secure Vault
                                    <ArrowRight className="size-[18px]" aria-hidden="true" />
                                </>
                            )}
                        </Button>
                    </form>

                    <p className="mt-6 border-t border-slate-200 pt-5 text-center text-sm text-slate-600">
                        Already have a vault?{' '}
                        <Link href={route('login')} className="font-semibold text-[#205295] hover:text-[#003A78]">
                            Sign In
                        </Link>
                    </p>
                </div>

                <footer className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
                    <span>
                        Help Center <span className="text-slate-400">(coming soon)</span>
                    </span>
                    <span>
                        Security Whitepaper <span className="text-slate-400">(coming soon)</span>
                    </span>
                    <span>
                        Privacy Policy <span className="text-slate-400">(coming soon)</span>
                    </span>
                </footer>
                <p className="mt-3 text-center text-[10px] text-slate-400">Passwords are hashed by the application before storage.</p>
            </section>
        </main>
    );
}
