<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class VaultLockController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        $timeout = $user->preference()->value('auto_lock_minutes') ?? 15;

        $unlockedAt = $request->session()->get('vault_unlocked_at');
        $unlockedUserId = $request->session()->get('vault_unlocked_user_id');

        $locked = ! $unlockedAt
            || (int) $unlockedUserId !== (int) $user->id;

        if ($locked) {
            $request->session()->forget([
                'vault_unlocked_at',
                'vault_unlocked_user_id',
            ]);
        }

        if (
            ! $locked &&
            $timeout > 0 &&
            now()->timestamp - (int) $unlockedAt >= $timeout * 60
        ) {
            $request->session()->forget([
                'vault_unlocked_at',
                'vault_unlocked_user_id',
            ]);

            $locked = true;
        }

        if (! $locked) {
            $request->session()->put('vault_unlocked_at', now()->timestamp);
        }

        return response()->json([
            'locked' => $locked,
            'auto_lock_minutes' => (int) $timeout,
        ]);
    }

    public function unlock(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'max:255'],
        ]);

        if (! Hash::check($validated['password'], $request->user()->password)) {
            return response()->json([
                'message' => 'The password is incorrect.',
            ], 422);
        }

        $request->session()->regenerate();

        $request->session()->put([
            'vault_unlocked_at' => now()->timestamp,
            'vault_unlocked_user_id' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Vault unlocked.',
            'locked' => false,
        ]);
    }

    public function lock(Request $request): JsonResponse
    {
        $request->session()->forget([
            'vault_unlocked_at',
            'vault_unlocked_user_id',
        ]);

        return response()->json([
            'message' => 'Vault locked.',
            'locked' => true,
        ]);
    }
}
