<p align="center">
  <strong>LOCKR</strong>
</p>

<h1 align="center">Lockr — Personal Password Vault</h1>

<h3 align="center">Your Digital Life. Securely Stored.</h3>

<p align="center">
  A Laravel and React application for storing, organizing, and accessing personal credentials.
</p>

<p align="center">
  <a href="https://github.com/carlohestiada/Lockr"><img src="https://img.shields.io/badge/PHP-8.2%2B-777BB4?logo=php&logoColor=white" alt="PHP 8.2 or newer" /></a>
  <a href="https://github.com/carlohestiada/Lockr"><img src="https://img.shields.io/badge/Laravel-12-FF2D20?logo=laravel&logoColor=white" alt="Laravel 12" /></a>
  <a href="https://github.com/carlohestiada/Lockr"><img src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" alt="React 19" /></a>
  <a href="https://github.com/carlohestiada/Lockr"><img src="https://img.shields.io/badge/License-see%20repository-lightgrey" alt="License information: see repository" /></a>
</p>

---

## Overview

Lockr is a personal credential vault built with Laravel, React, and Inertia.js. It provides an authenticated interface for saving website credentials, organizing them into folders, and quickly returning to frequently used entries.

The application is under active development. Review the security and deployment limitations below before storing sensitive or production credentials.

### Logo

A Lockr-specific logo asset is not present in the repository. The existing `public/logo.svg` is Laravel branding, so this README intentionally does not use it as Lockr artwork. Add the approved Lockr logo when one is available.

## Features

| Module | What is implemented |
|---|---|
| **Dashboard** | Credential and favorite summaries, recent credentials, and navigation to vault modules. |
| **My Vault** | Create, edit, search, sort, and delete credentials; reveal or copy credential fields while the vault is unlocked. |
| **Folder Management** | Create and manage folders, filter credentials by folder, and retain credentials as unfiled when a folder is removed. |
| **Favorites** | A dedicated favorites view backed by the same favorite flag used elsewhere in the app, with search, folder filtering, and sorting. |
| **Website icons** | Display domain-based favicons beside credentials, with a saved preference to hide them and use the credential initial instead. |
| **Settings** | Manage profile and account password, appearance, vault auto-lock, and visual preferences. |
| **Authentication** | Registration, sign-in, sign-out, email verification, password confirmation, and password reset routes. |
| **Password generator** | Generate passwords in the browser using the Web Crypto API. |

### Dashboard

The dashboard gives signed-in users an overview of saved credentials and favorites, plus recently updated credentials and entry points to the vault.

### My Vault

Credential records can include a title, username, password, website, notes, folder, and favorite status. Passwords are masked by default. Revealing a credential requires an unlocked vault session; successful reveals are audit logged.

### Folder Management and Favorites

Folders organize credentials without creating a separate copy of their data. Favorites reuse the credential's existing `is_favorite` flag, so the dashboard, My Vault, and Favorites stay based on the same records.

### Website Icon Recognition

When enabled, Lockr requests a favicon from Google's favicon service using the normalized website domain. The credential title, username, password, and other fields are not included in that request. The **Website Icons** preference hides remote icons and shows the normal initial avatar instead.

## Security Architecture

- Credential passwords and notes use Laravel's encrypted Eloquent casts. The application key (`APP_KEY`) is used for encryption; the configured Laravel cipher is AES-256-CBC. This is server-side encryption, **not** client-side, end-to-end, or zero-knowledge encryption.
- Account passwords use Laravel's authentication and password hashing facilities.
- Credential access is authenticated and ownership-checked with Laravel policies. Reveal and copy actions are protected by the vault-unlock session requirement.
- Vault unlock state is stored in the server-side session and refreshed by protected vault requests. The inactivity timeout is configurable in Settings.
- Successful password reveals are written to `credential_audit_logs` with the user, credential, event, time, IP address, and user agent. Password values are not stored in these audit events.
- Website favicons are fetched from an external service. As with other third-party requests, the requested domain is disclosed to that service; users can disable website icons in Settings.

Protect `APP_KEY` and the database, use HTTPS in deployments, and keep backups and access to them secure. Losing or changing the application key can make existing encrypted credential values unreadable. Lockr has not been represented here as independently audited or production-ready.

## Technology Stack

| Technology | Role |
|---|---|
| PHP 8.2+ and Laravel 12 | Server application, authentication, sessions, routing, and persistence |
| React 19 and TypeScript | User interface |
| Inertia.js 2 | Server-driven React pages |
| Tailwind CSS 4 and Radix UI | Styling and accessible interface primitives |
| Vite 6 | Frontend development server and production build |
| SQLite / PostgreSQL | Database; the checked-in example environment defaults to SQLite |
| PHPUnit and Playwright | Backend and browser tests |

PostgreSQL is supported by the Laravel database configuration. It is not the default database in `.env.example`.

## Installation and Local Development

### Requirements

- PHP 8.2 or newer with the extensions required by Laravel and your selected database driver
- [Composer](https://getcomposer.org/)
- [Node.js and npm](https://nodejs.org/)
- SQLite for the default configuration, or PostgreSQL if you choose that driver
- Git

The commands below use PowerShell syntax for the initial setup.

### 1. Get the project and install dependencies

```powershell
git clone https://github.com/carlohestiada/Lockr.git
Set-Location Lockr
composer install
npm install
```

### 2. Configure the environment

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
php artisan key:generate
```

The example environment uses SQLite. If using the default SQLite configuration, create the database file if it is missing:

```powershell
if (-not (Test-Path database/database.sqlite)) { New-Item -ItemType File -Path database/database.sqlite | Out-Null }
```

Ensure PHP has the `pdo_sqlite` extension enabled. The example sets `APP_NAME=Laravel`; set `APP_NAME=Lockr` in `.env` if you want Laravel-generated messages to use the application name.

To use PostgreSQL instead, create a database and configure `.env` with your own local connection details:

```dotenv
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=lockr
DB_USERNAME=your_local_database_user
DB_PASSWORD=your_local_database_password
```

Ensure PHP has `pdo_pgsql` enabled and that the PostgreSQL service and database are available. Do not copy real credentials into source control.

### 3. Create database tables

```powershell
php artisan migrate
```

### 4. Start the development services

```powershell
composer run dev
```

This project script starts Laravel, the queue listener, and the Vite development server. Open the local URL printed by Laravel, usually `http://127.0.0.1:8000`.

Alternatively, run the web server and Vite in separate terminals with `php artisan serve` and `npm run dev`. If changing database settings after bootstrapping configuration, run `php artisan config:clear`.

## Environment Configuration

Use `.env.example` as the source for supported environment variable names. Important settings include:

| Variable | Purpose |
|---|---|
| `APP_NAME`, `APP_ENV`, `APP_DEBUG`, `APP_URL` | Application identity, environment, diagnostics, and base URL |
| `APP_KEY` | Laravel encryption and application key; generate locally with `php artisan key:generate` |
| `DB_CONNECTION` and `DB_*` | Database driver and connection settings |
| `SESSION_DRIVER`, `CACHE_STORE`, `QUEUE_CONNECTION` | Session, cache, and queue backends |
| `MAIL_*` | Mail transport used by email verification and password reset |

Never commit `.env`, real database credentials, application keys, or personal credentials.

## Database and Migrations

The schema is managed by Laravel migrations under [`database/migrations/`](database/migrations/). The schema includes users, folders, credentials, user preferences, and credential audit events. Favorites use the `is_favorite` column on credentials; no separate favorites table is required.

Use `php artisan migrate` to apply migrations to the configured database. The automated Laravel tests use an in-memory SQLite database, regardless of the database selected for local development.

## Tests and Production Build

Run the backend tests:

```powershell
php artisan test
```

Build the frontend production assets:

```powershell
npm run build
```

The build script runs Vite. TypeScript is available as a separate check:

```powershell
npx tsc --noEmit
```

Run the browser tests:

```powershell
npm run test:e2e
```

## Project Structure

```text
app/
  Http/Controllers/       Laravel page, credential, folder, and preference controllers
  Http/Middleware/        Inertia and vault-unlock middleware
  Models/                 Eloquent models
  Policies/               Credential and folder authorization
database/
  migrations/             Database schema
resources/
  js/
    components/           Shared React components
    layouts/              Application, authentication, and settings layouts
    pages/                 Inertia pages, including auth, dashboard, folders, settings, and vault
  views/                  Laravel Blade application shell
routes/                   Web, authentication, settings, and console routes
tests/
  Feature/                Laravel feature tests
  browser/                Playwright browser tests
public/                   Public assets and application entry point
```

## Screenshots

No application screenshots are currently included. To avoid broken image links or presenting mockups as real UI, screenshots will appear here once genuine captures are added. See [`docs/screenshots/README.md`](docs/screenshots/README.md) for the requested filenames and instructions.

## Development Roadmap

The following gaps are directly reflected in the current implementation and are not represented as available features:

- Passkey sign-in and two-step authentication
- Emergency recovery kit and cloud archive
- Password breach checking
- Import/export and password expiration reminders

This list is informational, not a delivery commitment. Check the application and repository activity for current progress.

## Security Disclaimer

Lockr is a personal project and has not been independently security audited. Its server-side encryption model requires trusting the server and protecting its application key. Do not use it as the sole store for critical credentials or deploy it with real user data without first assessing the code, infrastructure, backups, access controls, and operational risks for your use case.

Report suspected security issues privately to the repository owner rather than posting sensitive details publicly.

## Developer

**Carlo Hestiada**

- GitHub: [@carlohestiada](https://github.com/carlohestiada)
- Repository: [carlohestiada/Lockr](https://github.com/carlohestiada/Lockr)

## License

The Composer project metadata declares `MIT`, but this repository currently has no root `LICENSE` file. The license text and distribution terms therefore need to be confirmed and documented by the project owner before redistribution.

---

<p align="center">
  <strong>Lockr</strong><br />
  Your credentials. Your vault. Your control.
</p>
