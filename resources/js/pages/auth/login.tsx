import type { FormDataConvertible } from '@inertiajs/core';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { FormEventHandler } from 'react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <div className="min-h-svh bg-slate-50 text-slate-950">
            <Head title="Log in" />

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
                            A safer place for everything you need to remember.
                        </h1>
                        <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
                            Sign in to securely access your passwords and keep your digital life in order.
                        </p>
                    </div>

                    <p className="relative text-sm text-slate-400">Private by design. Always yours.</p>
                </aside>

                <main className="flex items-center justify-center px-6 py-12 sm:px-10">
                    <section className="w-full max-w-md">
                        <Link href={route('home')} className="mb-12 flex w-fit items-center gap-3 lg:hidden" aria-label="Lockr home">
                            <span className="flex size-10 items-center justify-center rounded-xl bg-[#0A2647] text-white">
                                <KeyRound className="size-5" aria-hidden="true" />
                            </span>
                            <span className="text-xl font-semibold tracking-tight text-[#0A2647]">Lockr</span>
                        </Link>

                        <div className="mb-8">
                            <p className="mb-3 text-sm font-semibold tracking-wide text-[#176B87] uppercase">Welcome back</p>
                            <h2 className="text-3xl font-semibold tracking-tight">Sign in to Lockr</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600">Enter your credentials to access your secure vault.</p>
                        </div>

                        {status && (
                            <div
                                role="status"
                                className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
                            >
                                {status}
                            </div>
                        )}

                        <form className="flex flex-col gap-5" onSubmit={submit}>
                            <div className="grid gap-2">
                                <Label htmlFor="email" className="text-slate-700">
                                    Email address
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="you@example.com"
                                    disabled={processing}
                                    className="h-12 rounded-lg border-slate-300 bg-white px-4 shadow-none focus-visible:ring-[#176B87]"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-slate-700">
                                        Password
                                    </Label>
                                    {canResetPassword && (
                                        <TextLink
                                            href={route('password.request')}
                                            className="text-sm font-medium text-[#176B87] hover:text-[#0A2647]"
                                            tabIndex={5}
                                        >
                                            Forgot password?
                                        </TextLink>
                                    )}
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder="Enter your password"
                                    disabled={processing}
                                    className="h-12 rounded-lg border-slate-300 bg-white px-4 shadow-none focus-visible:ring-[#176B87]"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    tabIndex={3}
                                    checked={data.remember}
                                    onCheckedChange={(checked) => setData('remember', checked === true)}
                                    disabled={processing}
                                    className="rounded border-slate-300 data-[state=checked]:bg-[#0A2647]"
                                />
                                <Label htmlFor="remember" className="cursor-pointer text-sm font-normal text-slate-600">
                                    Keep me signed in
                                </Label>
                            </div>

                            <Button
                                type="submit"
                                className="mt-2 h-12 w-full rounded-lg bg-[#0A2647] text-base font-medium text-white hover:bg-[#12385e]"
                                tabIndex={4}
                                disabled={processing}
                            >
                                {processing ? (
                                    <>
                                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                                        Signing in...
                                    </>
                                ) : (
                                    <>
                                        Sign in
                                        <ArrowRight className="size-4" aria-hidden="true" />
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
                            New to Lockr?{' '}
                            <TextLink href={route('register')} tabIndex={6} className="font-semibold text-[#176B87] hover:text-[#0A2647]">
                                Create an account
                            </TextLink>
                        </div>

                        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
                            <ShieldCheck className="size-4 text-[#176B87]" aria-hidden="true" />
                            Your account is protected with secure authentication.
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
