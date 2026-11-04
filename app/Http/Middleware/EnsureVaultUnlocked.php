<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureVaultUnlocked
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $timeout = $user->preference()->value('auto_lock_minutes') ?? 15;
        $unlockedAt = $request->session()->get('vault_unlocked_at');
        $unlockedUserId = $request->session()->get('vault_unlocked_user_id');

        if (! $unlockedAt || (int) $unlockedUserId !== (int) $user->id) {
            $request->session()->forget([
                'vault_unlocked_at',
                'vault_unlocked_user_id',
            ]);

            return $this->lockedResponse();
        }

        if (
            $timeout > 0 &&
            now()->timestamp - (int) $unlockedAt >= $timeout * 60
        ) {
            $request->session()->forget([
                'vault_unlocked_at',
                'vault_unlocked_user_id',
            ]);

            return $this->lockedResponse();
        }

        // Refresh server-side activity time for protected vault requests.
        $request->session()->put('vault_unlocked_at', now()->timestamp);

        return $next($request);
    }

    private function lockedResponse(): Response
    {
        return response()->json([
            'message' => 'Your vault is locked. Unlock it to continue.',
            'code' => 'VAULT_LOCKED',
        ], 423);
    }
}
