import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';

const characterSets = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.?',
};

type CharacterCategory = keyof typeof characterSets;

function secureIndex(max: number): number {
    const limit = Math.floor(0x1_0000_0000 / max) * max;
    const value = new Uint32Array(1);

    do {
        crypto.getRandomValues(value);
    } while (value[0] >= limit);

    return value[0] % max;
}

function generatePassword(length: number, categories: CharacterCategory[]): string {
    if (categories.length === 0) {
        throw new Error('Select at least one character type.');
    }

    const sets = categories.map((category) => characterSets[category]);
    const characters = sets.join('');
    const password = sets.map((set) => set[secureIndex(set.length)]);

    while (password.length < length) {
        password.push(characters[secureIndex(characters.length)]);
    }

    for (let index = password.length - 1; index > 0; index--) {
        const target = secureIndex(index + 1);
        [password[index], password[target]] = [password[target], password[index]];
    }

    return password.join('');
}

export default function PasswordGenerator() {
    const [length, setLength] = useState(20);
    const [categories, setCategories] = useState<CharacterCategory[]>(['uppercase', 'lowercase', 'numbers', 'symbols']);
    const [password, setPassword] = useState('');
    const [feedback, setFeedback] = useState('');

    function toggleCategory(category: CharacterCategory) {
        setCategories((current) => (current.includes(category) ? current.filter((item) => item !== category) : [...current, category]));
        setFeedback('');
    }

    function createPassword() {
        try {
            setPassword(generatePassword(length, categories));
            setFeedback('');
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : 'Unable to generate a password.');
        }
    }

    async function copyPassword() {
        if (!password) return;

        try {
            await navigator.clipboard.writeText(password);
            setFeedback('Generated password copied.');
        } catch {
            setFeedback('Clipboard access failed. Check browser permissions.');
        }
    }

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-base text-[#0A2647]">Quick password generator</CardTitle>
                <CardDescription>Create a strong password locally for use in a credential.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <label className="sr-only" htmlFor="generated-password">
                        Generated password
                    </label>
                    <input
                        id="generated-password"
                        readOnly
                        value={password}
                        placeholder="Generate a password"
                        className="bg-background min-w-0 flex-1 rounded-md border px-3 py-2 font-mono text-sm"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Copy generated password"
                        disabled={!password}
                        onClick={copyPassword}
                    >
                        <Copy />
                    </Button>
                </div>
                <div className="space-y-2">
                    <label htmlFor="password-length" className="flex justify-between text-sm font-medium">
                        <span>Length</span>
                        <span className="font-mono">{length}</span>
                    </label>
                    <input
                        id="password-length"
                        type="range"
                        min={8}
                        max={32}
                        value={length}
                        onChange={(event) => setLength(Number(event.target.value))}
                        className="w-full accent-[#205295]"
                    />
                </div>
                <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
                    <legend className="mb-2 text-sm font-medium">Character types</legend>
                    {(
                        [
                            ['uppercase', 'Uppercase'],
                            ['lowercase', 'Lowercase'],
                            ['numbers', 'Numbers'],
                            ['symbols', 'Symbols'],
                        ] as const
                    ).map(([category, label]) => (
                        <label key={category} className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={categories.includes(category)}
                                onChange={() => toggleCategory(category)}
                                className="accent-[#205295]"
                            />
                            {label}
                        </label>
                    ))}
                </fieldset>
                <Button type="button" onClick={createPassword} disabled={categories.length === 0} className="w-full bg-[#144272] hover:bg-[#0A2647]">
                    <RefreshCw />
                    Generate password
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyPassword()} disabled={!password} className="w-full">
                    <Copy />
                    Copy &amp; Use
                </Button>
                {feedback && (
                    <p
                        role={feedback.includes('failed') || feedback.includes('Select') ? 'alert' : 'status'}
                        className="text-muted-foreground text-sm"
                    >
                        {feedback}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
