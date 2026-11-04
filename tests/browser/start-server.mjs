import { spawn, spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, mkdtempSync, openSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const databaseDirectory = mkdtempSync(join(tmpdir(), 'lockr-playwright-'));
const databasePath = join(databaseDirectory, 'test.sqlite');
const sessionDirectory = join(databaseDirectory, 'sessions');
mkdirSync(sessionDirectory);
const databaseFile = openSync(databasePath, 'w');
closeSync(databaseFile);

const env = {
    ...process.env,
    APP_DEBUG: 'false',
    APP_ENV: 'local',
    APP_URL: 'http://127.0.0.1:8497',
    CACHE_STORE: 'array',
    DB_CONNECTION: 'sqlite',
    DB_DATABASE: databasePath,
    MAIL_MAILER: 'array',
    QUEUE_CONNECTION: 'sync',
    SESSION_FILES: sessionDirectory,
    SESSION_DRIVER: 'file',
    LOG_CHANNEL: 'stderr',
};

const php = process.env.PHP_BINARY || 'php';
const buildOptions = {
    cwd: root,
    env,
    encoding: 'utf8',
};
const build =
    process.platform === 'win32'
        ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd run build'], buildOptions)
        : spawnSync('npm', ['run', 'build'], buildOptions);

if (build.status !== 0) {
    process.stderr.write(build.stdout || '');
    process.stderr.write(build.stderr || '');
    rmSync(databaseDirectory, { recursive: true, force: true });
    process.exit(build.status ?? 1);
}

process.stdout.write(build.stdout || '');

const migration = spawnSync(php, ['artisan', 'migrate', '--force', '--no-interaction'], {
    cwd: root,
    env,
    encoding: 'utf8',
});

if (migration.status !== 0) {
    process.stderr.write(migration.stdout || '');
    process.stderr.write(migration.stderr || '');
    rmSync(databaseDirectory, { recursive: true, force: true });
    process.exit(migration.status ?? 1);
}

process.stdout.write(migration.stdout || '');

const server = spawn(
    php,
    ['artisan', 'serve', '--host=127.0.0.1', '--port=8497', '--no-reload'],
    { cwd: root, env, stdio: 'inherit' },
);

let stopping = false;

function stop(signal) {
    if (stopping) return;
    stopping = true;
    server.kill(signal);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

server.on('error', (error) => {
    process.stderr.write(`${error.message}\n`);
    rmSync(databaseDirectory, { recursive: true, force: true });
    process.exitCode = 1;
});

server.on('exit', (code, signal) => {
    rmSync(databaseDirectory, { recursive: true, force: true });
    process.exitCode = code ?? (signal ? 1 : 0);
});
