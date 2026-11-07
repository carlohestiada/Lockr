import { expect, test, type Page } from '@playwright/test';

const testPassword = 'Disposable-E2E-Password-7391';

async function registerUser(page: Page): Promise<{ email: string; password: string }> {
    const email = `vault-${crypto.randomUUID()}@example.test`;

    await page.goto('/register');
    await page.getByLabel('Full Name').fill('Vault E2E User');
    await page.getByLabel('Master Email Address').fill(email);
    await page.getByLabel('Master Password', { exact: true }).fill(testPassword);
    await page.getByLabel('Confirm Master Password').fill(testPassword);
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Create Secure Vault' }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    await page.goto('/vault');
    await expect(page.getByRole('heading', { name: 'Your Vault is Locked' })).toBeVisible({ timeout: 30_000 });

    return { email, password: testPassword };
}

async function openLockedVault(page: Page): Promise<void> {
    if (!new URL(page.url()).pathname.endsWith('/vault')) {
        await page.goto('/vault');
    }
    await expect(page.getByRole('heading', { name: 'Your Vault is Locked' })).toBeVisible({ timeout: 30_000 });
}

test('locked vault screen shows the account, offers password visibility, and logs out through Laravel', async ({ page }) => {
    await registerUser(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await openLockedVault(page);

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
    await expect(page.getByRole('link', { name: /Lockr/ })).toBeVisible();
    await expect(page.getByText('Vault E2E User')).toBeVisible();
    await expect(page.getByText('vault-', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot Master Password?' })).toHaveAttribute('href', /\/forgot-password$/);
    await expect(page.getByText(/encrypted at rest/)).toBeVisible();

    const password = page.getByLabel('Master Password', { exact: true });
    await password.fill(testPassword);
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show Master Password' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide Master Password' }).click();
    await expect(password).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Log out completely' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Sign In to Vault' })).toBeVisible();
});

async function unlockVault(page: Page, password = testPassword): Promise<void> {
    await page.getByLabel('Master Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Unlock Vault' }).click();
    await expect(page.getByRole('heading', { name: 'My Vault' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'My Vault' })).toBeVisible();
}

async function addCredential(page: Page, title: string, password: string): Promise<void> {
    await page.getByRole('button', { name: 'New Credential' }).click();
    await page.getByLabel('Title *').fill(title);
    await page.getByLabel('Password *').fill(password);
    await page.getByRole('button', { name: 'Save credential' }).click();
    await expect(page.getByRole('table').getByText(title, { exact: true })).toBeVisible({ timeout: 30_000 });
}

async function setAutoLock(page: Page, minutes: number): Promise<void> {
    const result = await page.evaluate(async (value) => {
        const token = document.cookie
            .split('; ')
            .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
            ?.slice('XSRF-TOKEN='.length);

        const response = await fetch('/api/preferences', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {}),
            },
            body: JSON.stringify({ auto_lock_minutes: value }),
        });

        return response.status;
    }, minutes);

    expect(result).toBe(200);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your Vault is Locked' })).toBeVisible({ timeout: 30_000 });
}

test('authenticated vault visit starts locked and correct account password unlocks', async ({ page }) => {
    await registerUser(page);
    await openLockedVault(page);
    await unlockVault(page);

    const response = await page.evaluate(() =>
        fetch('/api/credentials', { headers: { Accept: 'application/json' } }).then((result) => result.status),
    );
    expect(response).toBe(200);

    const csrfProtectedResponse = await page.evaluate(() =>
        fetch('/api/vault/lock', {
            method: 'POST',
            headers: { Accept: 'application/json' },
        }).then((result) => result.status),
    );
    expect(csrfProtectedResponse).toBe(419);
});

test('dashboard uses real credential metadata, searches safely, and generates passwords securely', async ({ page }) => {
    test.setTimeout(120_000);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await registerUser(page);
    await openLockedVault(page);
    await unlockVault(page);

    await page.getByRole('button', { name: 'New Credential' }).click();
    await page.getByLabel('Title *').fill('E2E dashboard mail');
    await page.getByLabel('Username or email').fill('dashboard-user@example.test');
    await page.getByLabel('Password *').fill('Disposable-dashboard-secret-33');
    await page.getByLabel('Secure note').fill('Disposable dashboard private note');
    await page.getByRole('button', { name: 'Save credential' }).click();
    await expect(page.getByRole('table').getByText('E2E dashboard mail', { exact: true })).toBeVisible({ timeout: 30_000 });

    const dashboardResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/dashboard');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Dashboard' }).click();
    await dashboardResponse;
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Your dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'E2E dashboard mail' })).toBeVisible({ timeout: 30_000 });
    const dashboardText = await page.locator('body').innerText();
    expect(dashboardText).not.toContain('Disposable-dashboard-secret-33');
    expect(dashboardText).not.toContain('Disposable dashboard private note');

    for (const width of [360, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const hasDashboardOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(hasDashboardOverflow).toBe(false);
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByRole('button', { name: 'Show E2E dashboard mail password' }).click();
    await expect(page.getByText('Disposable-dashboard-secret-33', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Hide E2E dashboard mail password' }).click();
    await expect(page.getByText('Disposable-dashboard-secret-33', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Copy E2E dashboard mail password' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('Disposable-dashboard-secret-33');

    await page.getByRole('textbox', { name: 'Search credentials' }).fill('dashboard-user');
    await expect(page.getByRole('heading', { name: 'E2E dashboard mail' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('textbox', { name: 'Search credentials' }).fill('no matching dashboard item');
    await expect(page.getByText('No matching credentials')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Generate password' }).click();
    await expect(page.getByRole('textbox', { name: 'Generated password' })).toHaveValue(/.{20}/);
    const generatedPassword = await page.getByRole('textbox', { name: 'Generated password' }).inputValue();
    expect(generatedPassword).toHaveLength(20);
    await page.getByRole('button', { name: 'Copy & Use' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(generatedPassword);

    await page.getByRole('textbox', { name: 'Search credentials' }).fill('dashboard-user');
    await page.getByRole('button', { name: 'Add E2E dashboard mail to favorites' }).click();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Favorites' }).click();
    await expect(page).toHaveURL(/\/favorites$/);
    await expect(page.getByRole('heading', { name: 'Favorites', exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Favorites' })).toHaveAttribute(
        'aria-current',
        'page',
    );
    await expect(page.getByRole('table').getByText('E2E dashboard mail', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('textbox', { name: 'Search favorites' })).toBeVisible();
    await page.locator('summary[aria-label="Actions for E2E dashboard mail"]').click();
    await page.getByRole('button', { name: 'View details' }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'E2E dashboard mail' })).toBeVisible();
    await page.getByRole('button', { name: 'Close credential details' }).click();

    for (const width of [360, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const hasVaultOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(hasVaultOverflow).toBe(false);
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByRole('button', { name: 'Remove E2E dashboard mail from favorites' }).click();
    await expect(page.getByRole('table').getByText('E2E dashboard mail', { exact: true })).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'My Vault' }).click();
    await expect(page.getByRole('heading', { name: 'My Vault' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('textbox', { name: 'Search credentials' }).fill('E2E dashboard mail');
    await expect(page.getByRole('table').getByText('E2E dashboard mail', { exact: true })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'New Credential' }).click();
    await expect(page.getByLabel('Title *')).toBeVisible({ timeout: 30_000 });
    await page.getByLabel('Title *').fill('E2E dashboard created item');
    await page.getByLabel('Password *').fill('Disposable-dashboard-secret-34');
    await page.getByRole('button', { name: 'Save credential' }).click();
    await expect(page.getByRole('heading', { name: 'E2E dashboard created item' })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'Lock Vault' }).first().click({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/vault$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Your Vault is Locked' })).toBeVisible({ timeout: 30_000 });
});

test('incorrect account password reports an error and leaves the vault locked', async ({ page }) => {
    await registerUser(page);
    await openLockedVault(page);
    await page.getByLabel('Master Password', { exact: true }).fill('incorrect-disposable-password');
    await page.getByRole('button', { name: 'Unlock Vault' }).click();

    await expect(page.getByRole('alert')).toContainText('password is incorrect');
    await expect(page.getByLabel('Master Password', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Master Password', { exact: true })).toHaveAttribute('aria-describedby', 'vault-unlock-error');
    await expect(page.getByRole('heading', { name: 'Your Vault is Locked' })).toBeVisible({ timeout: 30_000 });
    const status = await page.evaluate(() =>
        fetch('/api/vault/status', { headers: { Accept: 'application/json' } }).then((response) => response.json()),
    );
    expect(status.locked).toBe(true);
});

test('manual lock clears revealed credentials and protected API access', async ({ page }) => {
    await registerUser(page);
    await openLockedVault(page);
    await unlockVault(page);
    await addCredential(page, 'Disposable mail account', 'Never-a-real-password-992');

    const listResponse = await page.evaluate(() =>
        fetch('/api/credentials', { headers: { Accept: 'application/json' } }).then((result) => result.text()),
    );
    expect(listResponse).not.toContain('Never-a-real-password-992');

    await page.getByRole('button', { name: 'Reveal Disposable mail account password' }).click();
    await expect(page.getByRole('table').getByText('Never-a-real-password-992')).toBeVisible();
    await page.getByRole('button', { name: 'Lock Vault', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your Vault is Locked' })).toBeVisible();
    await expect(page.getByText('Never-a-real-password-992')).toHaveCount(0);

    const response = await page.evaluate(() =>
        fetch('/api/credentials', { headers: { Accept: 'application/json' } }).then((result) => result.status),
    );
    expect(response).toBe(423);
});

test('saved inactivity timeout locks the vault using browser clock control', async ({ page }) => {
    await registerUser(page);
    await setAutoLock(page, 1);
    await page.clock.install();
    await openLockedVault(page);
    await unlockVault(page);

    await page.clock.fastForward(60_001);
    await expect(page.getByRole('heading', { name: 'Your Vault is Locked' })).toBeVisible();
});

test('zero inactivity timeout does not bypass unlock or explicit locking', async ({ page }) => {
    await registerUser(page);
    await setAutoLock(page, 0);
    await page.clock.install();
    await openLockedVault(page);

    await page.clock.fastForward(60 * 60 * 1000);
    await expect(page.getByRole('heading', { name: 'Your Vault is Locked' })).toBeVisible();

    await unlockVault(page);
    await page.clock.fastForward(60 * 60 * 1000);
    await expect(page.getByRole('heading', { name: 'My Vault' })).toBeVisible();
    await page.getByRole('button', { name: 'Lock Vault', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your Vault is Locked' })).toBeVisible();
});

test('visibility change clears revealed passwords and locks the vault', async ({ page }) => {
    test.setTimeout(120_000);
    await registerUser(page);
    await openLockedVault(page);
    await unlockVault(page);
    await addCredential(page, 'Disposable hidden-tab account', 'Hidden-tab-test-secret');
    await page.getByRole('button', { name: 'Reveal Disposable hidden-tab account password' }).click();
    await expect(page.getByRole('table').getByText('Hidden-tab-test-secret')).toBeVisible();

    await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(page.getByRole('heading', { name: 'Your Vault is Locked' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Hidden-tab-test-secret')).toHaveCount(0);
});

test('logout and login as another user does not reuse unlocked vault state', async ({ page }) => {
    test.setTimeout(120_000);
    await registerUser(page);
    await openLockedVault(page);
    await unlockVault(page);

    const logoutStatus = await page.evaluate(async () => {
        const token = document.cookie
            .split('; ')
            .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
            ?.slice('XSRF-TOKEN='.length);
        const response = await fetch('/logout', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                ...(token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {}),
            },
        });
        return response.status;
    });
    expect(logoutStatus).toBeLessThan(400);

    await registerUser(page);
    await openLockedVault(page);
    const protectedResponse = await page.evaluate(() =>
        fetch('/api/credentials', { headers: { Accept: 'application/json' } }).then((result) => result.status),
    );
    expect(protectedResponse).toBe(423);
});

test('credential folders, favorites, search, update, and delete work after unlock', async ({ page }) => {
    await registerUser(page);
    await openLockedVault(page);
    await unlockVault(page);

    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Folders' }).click();
    await expect(page).toHaveURL(/\/folders/);
    await expect(page.getByRole('heading', { name: 'Folders', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Create Folder' }).first().click();
    await page.getByLabel('Folder name').fill('E2E Personal');
    await page.getByRole('button', { name: 'Create Folder', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'E2E Personal' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'My Vault' }).click();
    await expect(page.getByRole('heading', { name: 'Your Vault is Locked' })).toBeVisible();
    await unlockVault(page);
    await page.getByLabel('Filter by folder').selectOption({ label: 'E2E Personal (0)' });

    await page.getByRole('button', { name: 'New Credential' }).click();
    await page.getByLabel('Title *').fill('E2E searchable account');
    await page.getByLabel('Username or email').fill('e2e-user@example.test');
    await page.getByLabel('Password *').fill('Disposable-crud-secret-51');
    await page.getByLabel('Folder', { exact: true }).selectOption({ label: 'E2E Personal' });
    await page.getByRole('button', { name: 'Save credential' }).click();
    await expect(page.getByRole('table').getByText('E2E searchable account', { exact: true })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Add E2E searchable account to favorites' }).click();
    await page.getByRole('button', { name: 'Favorites', exact: true }).click();
    await expect(page.getByRole('table').getByText('E2E searchable account', { exact: true })).toBeVisible();

    await page.getByRole('textbox', { name: 'Search credentials' }).fill('');
    await page.getByRole('textbox', { name: 'Search credentials' }).fill('not a match');
    await expect(page.getByText('No matching credentials')).toBeVisible();
    await page.getByRole('textbox', { name: 'Search credentials' }).fill('searchable');
    await expect(page.getByRole('table').getByText('E2E searchable account', { exact: true })).toBeVisible();

    await page.locator('summary[aria-label="Actions for E2E searchable account"]').click();
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('textbox', { name: 'Search credentials' }).fill('');
    await page.getByLabel('Title *').fill('E2E updated account');
    await page.getByRole('button', { name: 'Save credential' }).click();
    await expect(page.getByRole('table').getByText('E2E updated account', { exact: true })).toBeVisible({ timeout: 30_000 });

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('summary[aria-label="Actions for E2E updated account"]').click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Your vault is empty', { exact: false })).toBeVisible();
});

test('security and appearance preferences save together and apply across the app', async ({ page }) => {
    await registerUser(page);
    await page.goto('/settings/security');

    await expect(page.getByRole('heading', { name: 'Security & Preferences' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Preferences' })).toBeDisabled();
    await page.locator('input[name="auto-lock"][value="5"]').check();
    await expect(page.getByRole('button', { name: 'Save Preferences' })).toBeEnabled();
    await page.getByRole('button', { name: 'Save Preferences' }).click();
    await expect(page.getByRole('status')).toContainText('Preferences saved');

    await page.getByRole('tab', { name: 'Appearance' }).click();
    await expect(page).toHaveURL(/tab=appearance/);
    await page.getByText('Dark', { exact: true }).click();
    await page.locator('#accent-color').fill('#205295');
    await page.getByLabel('Text size').selectOption('large');
    await page.getByRole('button', { name: 'Save Preferences' }).click();
    await expect(page.getByRole('status')).toContainText('Preferences saved');
    await expect(page.locator('html')).toHaveClass(/dark/);

    const savedPreferences = await page.evaluate(async () => {
        const response = await fetch('/api/preferences', { headers: { Accept: 'application/json' } });
        return (await response.json()).data;
    });

    expect(savedPreferences.auto_lock_minutes).toBe(5);
    expect(savedPreferences.theme).toBe('dark');
    expect(savedPreferences.accent_color).toBe('#205295');
    expect(savedPreferences.font_size).toBe('large');

    await page.setViewportSize({ width: 360, height: 800 });
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);
    await page.getByLabel('Text size').selectOption('medium');
    await page.getByRole('button', { name: 'Save Preferences' }).click();
    await expect(page.getByRole('status')).toContainText('Preferences saved');
});

test('folder management creates, renames, opens, and safely deletes folders', async ({ page }) => {
    test.setTimeout(120_000);
    await registerUser(page);
    await page.goto('/folders');

    await expect(page.getByRole('heading', { name: 'Folders', exact: true })).toBeVisible();
    await expect(page.getByText('No folders yet. Create your first folder to organize your credentials.')).toBeVisible();
    for (const width of [360, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(hasHorizontalOverflow).toBe(false);
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByRole('button', { name: 'Create Folder' }).first().click();
    await page.getByLabel('Folder name').fill('E2E Travel');
    await page.getByRole('button', { name: 'Create Folder', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'E2E Travel' })).toBeVisible();
    await expect(page.getByText('“E2E Travel” was created.')).toBeVisible();

    await page.locator('summary[aria-label="More actions for E2E Travel"]').click();
    await page.getByRole('button', { name: 'Rename' }).click();
    await page.getByLabel('Folder name').fill('E2E Trips');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { name: 'E2E Trips' })).toBeVisible();

    await page.getByRole('button', { name: 'Create Folder' }).first().click();
    await page.getByLabel('Folder name').fill('e2e trips');
    await page.getByRole('button', { name: 'Create Folder', exact: true }).last().click();
    await expect(page.getByRole('alert')).toContainText('already have a folder');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('link', { name: 'Open Folder' }).click();
    await expect(page).toHaveURL(/\/vault\?folder=\d+$/);
    const folderId = new URL(page.url()).searchParams.get('folder');
    await unlockVault(page);
    await page.getByRole('button', { name: 'New Credential' }).click();
    await page.getByLabel('Title *').fill('E2E folder-owned credential');
    await page.getByLabel('Password *').fill('Disposable-folder-secret-11');
    await expect(page.getByLabel('Folder', { exact: true })).toHaveValue(folderId);
    await page.getByRole('button', { name: 'Save credential' }).click();
    await expect(page.getByRole('table').getByText('E2E folder-owned credential', { exact: true })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'My Vault' }).click();
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Folders' }).click();
    await expect(page).toHaveURL(/\/folders$/);

    await expect(page.getByText('1 credential', { exact: true })).toBeVisible();
    await page.locator('summary[aria-label="More actions for E2E Trips"]').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Its credentials will remain in your vault and become unfiled.')).toBeVisible();
    await page.getByRole('button', { name: 'Delete Folder' }).click();
    await expect(page.getByRole('heading', { name: 'E2E Trips' })).toHaveCount(0);

    await page.getByRole('link', { name: 'View unfiled credentials' }).click();
    await expect(page.getByRole('table').getByText('E2E folder-owned credential', { exact: true })).toBeVisible();
});
