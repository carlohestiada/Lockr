import { Check, Eye, Palette, Type } from 'lucide-react';
import type { PreferenceTabProps, UserPreferences } from './types';

const themes: { value: UserPreferences['theme']; label: string; detail: string }[] = [
    { value: 'light', label: 'Light', detail: 'Bright and clear' },
    { value: 'dark', label: 'Dark', detail: 'Low-light interface' },
    { value: 'system', label: 'System', detail: 'Follow your device' },
];

const fontSizes: { value: UserPreferences['font_size']; label: string }[] = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
];

export default function AppearanceTab({ value, onChange }: PreferenceTabProps) {
    return (
        <div className="grid gap-5 lg:grid-cols-12">
            <section className="space-y-5 lg:col-span-7">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF4FF] text-[#205295]">
                            <Palette className="size-5" aria-hidden="true" />
                        </span>
                        <div>
                            <h2 className="font-semibold text-[#0A2647] dark:text-slate-100">Theme</h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose the appearance used across Lockr.</p>
                        </div>
                    </div>
                    <fieldset className="mt-5">
                        <legend className="sr-only">Choose a theme</legend>
                        <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
                            {themes.map((theme) => (
                                <label
                                    key={theme.value}
                                    className={`relative flex min-h-28 cursor-pointer flex-col justify-between rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-[#2C74B3] ${
                                        value.theme === theme.value
                                            ? 'border-[#205295] bg-[#EFF4FF] dark:bg-slate-800'
                                            : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <span className="flex h-12 items-center gap-1 overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
                                        <span className="h-full w-1/4 rounded bg-[#0A2647]" />
                                        <span className="h-full flex-1 rounded bg-[#F8FAFC]" />
                                        <span className="h-1/2 w-1/4 rounded bg-[#EFF4FF]" />
                                    </span>
                                    <input
                                        type="radio"
                                        name="theme"
                                        value={theme.value}
                                        checked={value.theme === theme.value}
                                        onChange={() => onChange('theme', theme.value)}
                                        className="sr-only"
                                    />
                                    <span className="mt-3 flex items-center justify-between gap-2">
                                        <span>
                                            <span className="block text-sm font-semibold text-[#0A2647] dark:text-slate-100">{theme.label}</span>
                                            <span className="block text-xs text-slate-500 dark:text-slate-400">{theme.detail}</span>
                                        </span>
                                        {value.theme === theme.value && <Check className="size-4 text-[#205295]" aria-hidden="true" />}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <div className="mt-6 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2 dark:border-slate-800">
                        <div>
                            <label
                                htmlFor="accent-color"
                                className="mb-2 flex items-center gap-2 text-sm font-medium text-[#0A2647] dark:text-slate-100"
                            >
                                <Palette className="size-4 text-[#205295]" aria-hidden="true" />
                                Accent color
                            </label>
                            <div className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3">
                                <input
                                    id="accent-color"
                                    type="color"
                                    value={value.accent_color}
                                    onChange={(event) => onChange('accent_color', event.target.value)}
                                    className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
                                />
                                <span className="font-mono text-sm text-slate-600 uppercase dark:text-slate-300">{value.accent_color}</span>
                            </div>
                        </div>
                        <div>
                            <label
                                htmlFor="font-size"
                                className="mb-2 flex items-center gap-2 text-sm font-medium text-[#0A2647] dark:text-slate-100"
                            >
                                <Type className="size-4 text-[#205295]" aria-hidden="true" />
                                Text size
                            </label>
                            <select
                                id="font-size"
                                value={value.font_size}
                                onChange={(event) => onChange('font_size', event.target.value as UserPreferences['font_size'])}
                                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#2C74B3] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                                {fontSizes.map((size) => (
                                    <option key={size.value} value={size.value}>
                                        {size.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </article>
            </section>

            <aside className="space-y-5 lg:col-span-5">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF4FF] text-[#205295]">
                            <Eye className="size-5" aria-hidden="true" />
                        </span>
                        <div>
                            <h2 className="font-semibold text-[#0A2647] dark:text-slate-100">Visual preferences</h2>
                            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                Tune how credential details appear in your vault.
                            </p>
                        </div>
                    </div>
                    <div className="mt-5 flex min-h-14 items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <div>
                            <p className="text-sm font-medium text-[#0A2647] dark:text-slate-100">Website icons</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Secure favicon display is not implemented yet.</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">Coming soon</span>
                    </div>
                    <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        The existing preference is preserved, but icon fetching is disabled so credential website URLs are not sent to third parties.
                    </p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="font-semibold text-[#0A2647] dark:text-slate-100">Preview</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your chosen text size and accent color preview.</p>
                    <div
                        className={`mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[#0A2647] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${
                            value.font_size === 'small' ? 'text-xs' : value.font_size === 'large' ? 'text-base' : 'text-sm'
                        }`}
                    >
                        <p className="font-semibold">Lockr Personal Vault</p>
                        <p className="mt-1 text-slate-500">A clear view of your saved credentials.</p>
                        <span
                            className="mt-3 inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-white"
                            style={{ backgroundColor: value.accent_color }}
                        >
                            Sample action
                        </span>
                    </div>
                </article>
            </aside>
        </div>
    );
}
