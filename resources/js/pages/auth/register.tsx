import type { FormDataConvertible } from '@inertiajs/core';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RegisterForm extends Record<string, FormDataConvertible> {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
}

export default function Register() {
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm<RegisterForm>({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (event) => {
        event.preventDefault();
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <div className="min-h-svh bg-slate-50 text-slate-950">
            <Head title="Create account" />

            <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
                <aside className="relative hidden overflow-hidden bg-[#0A2647] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
                    <div aria-hidden="true" className="absolute -top-32 -right-32 size-[30rem] rounded-full border border-white/10" />
                    <div aria-hidden="true" className="absolute -right-10 -bottom-48 size-[34rem] rounded-full border border-white/10" />

                    <Link href={route('home')} className="relative flex w-fit items-center gap-3" aria-label="Lockr home">
                        <span className="flex size-11 items-center justify-center rounded-xl bg-white/10">
                            <KeyRound className="size-5" aria-hidden="true" />
                        </span>
                        <span className="text-xl font-semibold tracking-tight">Lockr</span>
                    </Link>

                    <div className="relative max-w-lg py-16">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
                            <ShieldCheck className="size-4 text-emerald-300" aria-hidden="true" />
                            Your private space
                        </div>
                        <h1 className="text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
                            Make room for a simpler, safer digital life.
                        </h1>
                        <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
                            Create your Lockr account and keep your passwords organized in one secure place.
                        </p>
                    </div>

                    <p className="relative text-sm text-slate-400">Private by design. Always yours.</p>
                </aside>

                <main className="flex items-center justify-center px-6 py-12 sm:px-10">
                    <section className="w-full max-w-md">
                        <Link href={route('home')} className="mb-10 flex w-fit items-center gap-3 lg:hidden" aria-label="Lockr home">
                            <span className="flex size-10 items-center justify-center rounded-xl bg-[#0A2647] text-white">
                                <KeyRound className="size-5" aria-hidden="true" />
                            </span>
                            <span className="text-xl font-semibold tracking-tight text-[#0A2647]">Lockr</span>
                        </Link>

                        <div className="mb-7">
                            <p className="mb-3 text-sm font-semibold tracking-wide text-[#176B87] uppercase">Get started</p>
                            <h2 className="text-3xl font-semibold tracking-tight">Create your account</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600">Set up your account to keep your secure vault close.</p>
                        </div>

                        <form className="flex flex-col gap-4" onSubmit={submit}>
                            <div className="grid gap-2">
                                <Label htmlFor="name" className="text-slate-700">
                                    Full name
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    required
                                    autoFocus
                                    autoComplete="name"
                                    value={data.name}
                                    onChange={(event) => setData('name', event.target.value)}
                                    disabled={processing}
                                    placeholder="Your full name"
                                    aria-invalid={Boolean(errors.name)}
                                    aria-describedby={errors.name ? 'name-error' : undefined}
                                    className="h-12 rounded-lg border-slate-300 bg-white px-4 shadow-none focus-visible:ring-[#176B87]"
                                />
                                <InputError id="name-error" message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email" className="text-slate-700">
                                    Email address
                                </Label>
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
                                    aria-describedby={errors.email ? 'email-error' : undefined}
                                    className="h-12 rounded-lg border-slate-300 bg-white px-4 shadow-none focus-visible:ring-[#176B87]"
                                />
                                <InputError id="email-error" message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password" className="text-slate-700">
                                    Password
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        autoComplete="new-password"
                                        value={data.password}
                                        onChange={(event) => setData('password', event.target.value)}
                                        disabled={processing}
                                        placeholder="Create a password"
                                        aria-invalid={Boolean(errors.password)}
                                        aria-describedby={errors.password ? 'password-error' : undefined}
                                        className="h-12 rounded-lg border-slate-300 bg-white px-4 pr-12 shadow-none focus-visible:ring-[#176B87]"
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-500 hover:text-[#0A2647] focus-visible:ring-2 focus-visible:ring-[#176B87] focus-visible:outline-none focus-visible:ring-inset disabled:opacity-50"
                                        onClick={() => setShowPassword((visible) => !visible)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        aria-pressed={showPassword}
                                        disabled={processing}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="size-4" aria-hidden="true" />
                                        ) : (
                                            <Eye className="size-4" aria-hidden="true" />
                                        )}
                                    </button>
                                </div>
                                <InputError id="password-error" message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation" className="text-slate-700">
                                    Confirm password
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="password_confirmation"
                                        type={showPasswordConfirmation ? 'text' : 'password'}
                                        required
                                        autoComplete="new-password"
                                        value={data.password_confirmation}
                                        onChange={(event) => setData('password_confirmation', event.target.value)}
                                        disabled={processing}
                                        placeholder="Re-enter your password"
                                        aria-invalid={Boolean(errors.password_confirmation)}
                                        aria-describedby={errors.password_confirmation ? 'password-confirmation-error' : undefined}
                                        className="h-12 rounded-lg border-slate-300 bg-white px-4 pr-12 shadow-none focus-visible:ring-[#176B87]"
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-500 hover:text-[#0A2647] focus-visible:ring-2 focus-visible:ring-[#176B87] focus-visible:outline-none focus-visible:ring-inset disabled:opacity-50"
                                        onClick={() => setShowPasswordConfirmation((visible) => !visible)}
                                        aria-label={showPasswordConfirmation ? 'Hide confirm password' : 'Show confirm password'}
                                        aria-pressed={showPasswordConfirmation}
                                        disabled={processing}
                                    >
                                        {showPasswordConfirmation ? (
                                            <EyeOff className="size-4" aria-hidden="true" />
                                        ) : (
                                            <Eye className="size-4" aria-hidden="true" />
                                        )}
                                    </button>
                                </div>
                                <InputError id="password-confirmation-error" message={errors.password_confirmation} />
                            </div>

                            <Button
                                type="submit"
                                className="mt-2 h-12 w-full rounded-lg bg-[#0A2647] text-base font-medium text-white hover:bg-[#12385e]"
                                disabled={processing}
                            >
                                {processing ? (
                                    <>
                                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                                        Creating account...
                                    </>
                                ) : (
                                    <>
                                        Create account
                                        <ArrowRight className="size-4" aria-hidden="true" />
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="mt-7 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
                            Already have an account?{' '}
                            <TextLink href={route('login')} className="font-semibold text-[#176B87] hover:text-[#0A2647]">
                                Log in
                            </TextLink>
                        </div>

                        <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-500">
                            <ShieldCheck className="size-4 text-[#176B87]" aria-hidden="true" />
                            Your account is protected with secure authentication.
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
