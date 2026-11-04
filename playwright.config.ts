import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:8497',
        trace: 'retain-on-failure',
        ...devices['Desktop Chrome'],
    },
    webServer: {
        command: 'node tests/browser/start-server.mjs',
        url: 'http://127.0.0.1:8497/up',
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
