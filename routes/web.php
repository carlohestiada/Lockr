<?php

use App\Http\Controllers\CredentialController;
use App\Http\Controllers\FolderController;
use App\Http\Controllers\UserPreferenceController;
use App\Http\Controllers\VaultLockController;
use App\Http\Middleware\EnsureVaultUnlocked;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function (Request $request) {
    return $request->user()
        ? to_route('dashboard')
        : to_route('login');
})->name('home');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard/index');
    })->name('dashboard');

    Route::get('vault', function () {
        return Inertia::render('vault/index');
    })->name('vault.index');
});

Route::middleware('auth')->prefix('api')->group(function () {
    Route::get('vault/status', [VaultLockController::class, 'status']);
    Route::post('vault/unlock', [VaultLockController::class, 'unlock'])
        ->middleware('throttle:5,1');
    Route::post('vault/lock', [VaultLockController::class, 'lock']);

    Route::post('credentials/bulk', [CredentialController::class, 'bulk'])
        ->middleware(EnsureVaultUnlocked::class);
    Route::post('credentials/{credential}/reveal', [CredentialController::class, 'reveal'])
        ->middleware([EnsureVaultUnlocked::class, 'throttle:20,1']);
    Route::get('credentials/{credential}/edit', [CredentialController::class, 'edit'])
        ->middleware(EnsureVaultUnlocked::class);

    Route::apiResource('credentials', CredentialController::class)
        ->only(['index', 'show', 'store', 'update', 'destroy'])
        ->middleware(EnsureVaultUnlocked::class);

    Route::apiResource('folders', FolderController::class)
        ->only(['index', 'store', 'update', 'destroy']);

    Route::get('preferences', [UserPreferenceController::class, 'show'])
        ->name('preferences.show');

    Route::put('preferences', [UserPreferenceController::class, 'update'])
        ->name('preferences.update');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
